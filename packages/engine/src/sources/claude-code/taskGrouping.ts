import type { ParsedEntry } from "./parseLine";

/**
 * Grupowanie wpisów w zadania — spec.md sekcja 4.2.
 *
 * Zasada (zweryfikowana na realnych logach): plik JSONL jest przetwarzany
 * sekwencyjnie. Nowe zadanie zaczyna się dokładnie przy wpisie
 * `type: "user"` z `origin.kind === "human"`. Wszystkie kolejne wpisy —
 * łącznie z wpisami "user" będącymi w rzeczywistości `tool_result` oraz
 * z wpisami subagentów (`isSidechain: true`) — należą do tego samego
 * zadania, aż do napotkania kolejnego wpisu z `origin.kind === "human"`.
 *
 * Stan jest utrzymywany per `sessionId`, ponieważ silnik odczytuje logi
 * przyrostowo (nowe linie mogą trafiać do parsera w osobnych wywołaniach)
 * i musi pamiętać, jakie zadanie jest aktualnie "aktywne" w danej sesji.
 */
export class TaskGrouper {
  private readonly currentTaskIdBySession = new Map<string, string>();

  /**
   * Zwraca `taskId`, do którego należy dany wpis, aktualizując stan grupera
   * w miarę przetwarzania kolejnych wpisów tej samej sesji.
   */
  assignTaskId(entry: ParsedEntry): string {
    if (entry.isHumanMessage) {
      this.currentTaskIdBySession.set(entry.sessionId, entry.uuid);
      return entry.uuid;
    }

    const current = this.currentTaskIdBySession.get(entry.sessionId);
    if (current !== undefined) {
      return current;
    }

    // Skrajny przypadek: wpis dotarł przed jakąkolwiek wiadomością człowieka
    // w tej sesji (nieobserwowane w próbkach, ale nie do wykluczenia).
    return `${entry.sessionId}:pre`;
  }
}
