import { open, stat } from "node:fs/promises";

/**
 * Inkrementalne czytanie plików JSONL — spec.md sekcja 4.1 (twardy wymóg).
 *
 * Znany błąd konkurencyjnego narzędzia (`vscode-claude-status`, issue #47):
 * parser czytał i parsował całą historię logów przy każdym zdarzeniu
 * file-watchera, co przy dużym katalogu logów zawieszało edytor.
 *
 * FileCursorStore trzyma dla każdego pliku pozycję ostatnio przeczytanego
 * bajtu (offset) razem z mtime/size widzianymi przy tamtym odczycie, żeby:
 * - nigdy nie otwierać pliku, który się nie zmienił (sprawdzenie przez `stat`),
 * - gdy plik się zmienił, czytać tylko przyrost (append) od `lastOffset`,
 *   nigdy pliku od nowa.
 */

interface CursorState {
  lastOffset: number;
  lastMtimeMs: number;
  lastSize: number;
}

export class FileCursorStore {
  private readonly cursors = new Map<string, CursorState>();

  /**
   * Zwraca nowe, kompletne linie dopisane do pliku od ostatniego odczytu
   * (dla nowego pliku: wszystkie linie od początku). Zwraca `[]` bez
   * otwierania pliku, jeśli `mtime`/`size` nie zmieniły się od ostatniego
   * razu.
   *
   * Ostatnia, niedokończona linia w pliku (brak końcowego `\n` — plik może
   * być właśnie dopisywany) jest celowo pozostawiana nieprzeczytana; zostanie
   * odczytana w kolejnym wywołaniu, gdy zapis się zakończy.
   */
  async readNewLines(path: string): Promise<string[]> {
    let stats;
    try {
      stats = await stat(path);
    } catch {
      // Plik zniknął (np. usunięty) między zdarzeniem watchera a odczytem.
      return [];
    }

    const previous = this.cursors.get(path);
    if (
      previous &&
      previous.lastMtimeMs === stats.mtimeMs &&
      previous.lastSize === stats.size
    ) {
      return [];
    }

    const startOffset = previous?.lastOffset ?? 0;
    if (stats.size < startOffset) {
      // Plik został skrócony/nadpisany (nietypowe dla logów Claude Code,
      // które tylko rosną przez append) — czytamy od zera, żeby nie zgubić
      // danych i nie próbować czytać poza końcem pliku.
      this.cursors.delete(path);
      return this.readNewLines(path);
    }
    if (stats.size === startOffset) {
      this.cursors.set(path, {
        lastOffset: startOffset,
        lastMtimeMs: stats.mtimeMs,
        lastSize: stats.size,
      });
      return [];
    }

    const handle = await open(path, "r");
    let chunk: Buffer;
    try {
      const length = stats.size - startOffset;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, startOffset);
      chunk = buffer;
    } finally {
      await handle.close();
    }

    const text = chunk.toString("utf-8");
    const lastNewline = text.lastIndexOf("\n");
    if (lastNewline === -1) {
      // Brak choćby jednej kompletnej linii w przyroście — poczekaj na kolejny odczyt.
      return [];
    }

    const completeText = text.slice(0, lastNewline);
    const consumedBytes = Buffer.byteLength(text.slice(0, lastNewline + 1), "utf-8");

    this.cursors.set(path, {
      lastOffset: startOffset + consumedBytes,
      lastMtimeMs: stats.mtimeMs,
      lastSize: stats.size,
    });

    return completeText.split("\n").filter((line) => line.length > 0);
  }

  /** Usuwa zapamiętany kursor dla pliku (np. gdy plik został skasowany). */
  forget(path: string): void {
    this.cursors.delete(path);
  }
}
