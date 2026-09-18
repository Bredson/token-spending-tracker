import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import fg from "fast-glob";
import { applyPricing, loadPricingTable, type PricingTable } from "../../pricing";
import type { Disposable, UsageRecord, UsageSource } from "../../types";
import { FileCursorStore } from "./fileCursor";
import { parseLine } from "./parseLine";
import { TaskGrouper } from "./taskGrouping";

export interface ClaudeCodeSourceOptions {
  /** Katalog logów Claude Code. Domyślnie `~/.claude/projects` (spec.md 4.2). */
  projectsDir?: string;
  /** Tabela cen. Domyślnie wynik `loadPricingTable()` (spec.md 3.3). */
  pricingTable?: PricingTable;
  /** Wywoływane dla każdego napotkanego nieznanego modelu (raz na model). */
  onUnknownModel?: (model: string) => void;
}

/**
 * Implementacja `UsageSource` dla Claude Code — spec.md sekcja 4.2.
 *
 * Spina parser (`parseLine`), grupowanie zadań (`TaskGrouper`), inkrementalne
 * czytanie plików (`FileCursorStore`) i cennik (`applyPricing`) w jeden
 * kontrakt `UsageSource`. Jeden plik `.jsonl` = jedna sesja; grouper jest
 * utrzymywany per sesja (`sessionId`), więc pliki mogą być czytane w
 * dowolnej kolejności bez mieszania stanu zadań między sesjami.
 */
export class ClaudeCodeSource implements UsageSource {
  readonly id = "claude-code";
  readonly displayName = "Claude Code";

  private readonly projectsDir: string;
  private readonly pricingTable: PricingTable;
  private readonly onUnknownModel: (model: string) => void;
  private readonly warnedModels = new Set<string>();
  private readonly cursorStore = new FileCursorStore();
  private readonly grouper = new TaskGrouper();

  constructor(options: ClaudeCodeSourceOptions = {}) {
    this.projectsDir = options.projectsDir ?? join(homedir(), ".claude", "projects");
    this.pricingTable = options.pricingTable ?? loadPricingTable();
    this.onUnknownModel =
      options.onUnknownModel ??
      ((model) => {
        if (this.warnedModels.has(model)) {
          return;
        }
        this.warnedModels.add(model);
        console.warn(
          `[token-tracker] Nieznany model "${model}" — koszt nieprzeliczony (costUsd = 0).`,
        );
      });
  }

  async detect(): Promise<boolean> {
    return existsSync(this.projectsDir);
  }

  async loadAll(): Promise<UsageRecord[]> {
    if (!existsSync(this.projectsDir)) {
      return [];
    }

    const files = await fg("**/*.jsonl", { cwd: this.projectsDir, absolute: true });
    const records: UsageRecord[] = [];
    for (const file of files) {
      const lines = await this.cursorStore.readNewLines(file);
      records.push(...this.processLines(lines));
    }
    return records;
  }

  watch(onUpdate: (newRecords: UsageRecord[]) => void): Disposable {
    // chokidar v4 dropped glob support (README "v4" changelog) — it watches
    // directories recursively by default, so we watch the directory itself
    // and filter to `.jsonl` files ourselves in the event handler.
    const watcher: FSWatcher = chokidar.watch(this.projectsDir, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 50,
      },
    });

    const handleFileEvent = (filePath: string): void => {
      if (!filePath.endsWith(".jsonl")) {
        return;
      }
      void this.cursorStore.readNewLines(filePath).then((lines) => {
        if (lines.length === 0) {
          return;
        }
        const records = this.processLines(lines);
        if (records.length > 0) {
          onUpdate(records);
        }
      });
    };

    watcher.on("add", handleFileEvent);
    watcher.on("change", handleFileEvent);

    return {
      dispose: () => {
        void watcher.close();
      },
    };
  }

  /**
   * Parsuje przyrost linii jednego pliku (sekwencyjnie, w kolejności zapisu),
   * aktualizuje grupowanie zadań i zwraca `UsageRecord[]` wyłącznie dla
   * wpisów niosących policzalne zużycie tokenów (`type: "assistant"` z
   * `model`/`usage`). Wpisy "user" są nadal przepuszczane przez grouper —
   * wyznaczają granice zadań — ale same nie tworzą rekordów.
   */
  private processLines(lines: string[]): UsageRecord[] {
    const records: UsageRecord[] = [];

    for (const line of lines) {
      const entry = parseLine(line);
      if (entry === null) {
        continue;
      }

      const taskId = this.grouper.assignTaskId(entry);

      if (entry.type !== "assistant" || entry.model === undefined || entry.usage === undefined) {
        continue;
      }

      const record: UsageRecord = {
        id: `${entry.sessionId}:${entry.uuid}`,
        source: this.id,
        sessionId: entry.sessionId,
        taskId,
        timestamp: entry.timestamp,
        model: entry.model,
        tokensInput: entry.usage.inputTokens,
        tokensOutput: entry.usage.outputTokens,
        tokensCacheRead: entry.usage.cacheReadInputTokens,
        tokensCacheWrite: entry.usage.cacheCreationInputTokens,
        costUsd: 0,
        projectPath: entry.cwd,
      };

      records.push(applyPricing(record, this.pricingTable, this.onUnknownModel));
    }

    return records;
  }
}
