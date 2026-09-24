import {
  aggregateByPeriod,
  aggregateByProject,
  aggregateBySession,
  aggregateByTask,
  type AggregatedGroup,
  type PeriodGranularity,
} from "./aggregate";
import type { Disposable, UsageRecord, UsageSource } from "./types";

export interface EngineOptions {
  sources: UsageSource[];
}

/**
 * Silnik — spec.md sekcja 5. Niezależny od `vscode`: rejestruje `UsageSource`,
 * scala ich strumienie w jeden magazyn `UsageRecord[]` w pamięci i udostępnia
 * agregację. Nie liczy kosztu samodzielnie — rekordy przychodzące z
 * `UsageSource` są już wycenione (patrz korekta w spec.md sekcja 5).
 */
export class Engine implements Disposable {
  private readonly sources: UsageSource[];
  private readonly records: UsageRecord[] = [];
  private readonly recordIndexById = new Map<string, number>();
  private readonly changeListeners = new Set<() => void>();
  private readonly watchDisposables: Disposable[] = [];
  private started = false;

  constructor(options: EngineOptions) {
    this.sources = options.sources;
  }

  /**
   * Wykrywa dostępne źródła, wczytuje ich pełną historię i zaczyna je
   * obserwować. Bezpieczne do wywołania tylko raz na instancję.
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    for (const source of this.sources) {
      const available = await source.detect();
      if (!available) {
        continue;
      }

      const initialRecords = await source.loadAll();
      this.ingest(initialRecords);

      const disposable = source.watch((newRecords) => {
        this.ingest(newRecords);
      });
      this.watchDisposables.push(disposable);
    }
  }

  /** Subskrybuje zmiany magazynu (nowe rekordy przyjęte z dowolnego źródła). */
  onChange(listener: () => void): Disposable {
    this.changeListeners.add(listener);
    return {
      dispose: () => {
        this.changeListeners.delete(listener);
      },
    };
  }

  /** Aktualny, pełny zrzut magazynu rekordów (kopia — nie do mutacji). */
  getRecords(): UsageRecord[] {
    return [...this.records];
  }

  aggregateByTask(): AggregatedGroup<string>[] {
    return aggregateByTask(this.records);
  }

  aggregateBySession(): AggregatedGroup<string>[] {
    return aggregateBySession(this.records);
  }

  aggregateByProject(): AggregatedGroup<string>[] {
    return aggregateByProject(this.records);
  }

  aggregateByPeriod(granularity: PeriodGranularity): AggregatedGroup<string>[] {
    return aggregateByPeriod(this.records, granularity);
  }

  /**
   * Rozpoznawalne tytuły sesji zebrane ze wszystkich źródeł, które je udostępniają
   * (patrz `UsageSource.getSessionTitles`). Jeśli więcej niż jedno źródło zna tytuł
   * tej samej sesji, wygrywa ostatnie w kolejności rejestracji źródeł.
   */
  getSessionTitles(): Map<string, string> {
    const merged = new Map<string, string>();
    for (const source of this.sources) {
      const titles = source.getSessionTitles?.();
      if (titles) {
        for (const [sessionId, title] of titles) {
          merged.set(sessionId, title);
        }
      }
    }
    return merged;
  }

  /** Nieznane (niewycenione) modele ze wszystkich źródeł — bez duplikatów, posortowane. */
  getUnknownModels(): string[] {
    const merged = new Set<string>();
    for (const source of this.sources) {
      for (const model of source.getUnknownModels?.() ?? []) {
        merged.add(model);
      }
    }
    return [...merged].sort();
  }

  /** Zatrzymuje wszystkie obserwatory źródeł. */
  dispose(): void {
    for (const disposable of this.watchDisposables) {
      disposable.dispose();
    }
    this.watchDisposables.length = 0;
    this.changeListeners.clear();
  }

  /**
   * Dopisuje nowe rekordy do magazynu (deduplikując po `id`, na wypadek gdyby
   * to samo źródło kiedyś zwróciło ten sam rekord dwa razy) i powiadamia
   * subskrybentów, jeśli faktycznie coś nowego przybyło. Jawnie pusta partia
   * to sygnał ze źródła "zmieniły się metadane" (np. tytuł sesji) — też
   * powiadamia, bo UI musi się przerysować mimo braku nowych rekordów.
   */
  private ingest(newRecords: UsageRecord[]): void {
    let addedAny = newRecords.length === 0;

    for (const record of newRecords) {
      if (this.recordIndexById.has(record.id)) {
        continue;
      }
      this.recordIndexById.set(record.id, this.records.length);
      this.records.push(record);
      addedAny = true;
    }

    if (addedAny) {
      for (const listener of this.changeListeners) {
        listener();
      }
    }
  }
}
