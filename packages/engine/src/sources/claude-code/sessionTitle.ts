/**
 * Parsowanie wpisów tytułów sesji Claude Code — `type: "ai-title"` (tytuł wygenerowany
 * automatycznie) i `type: "custom-title"` (tytuł nadany ręcznie przez użytkownika).
 * Odkryte przy inspekcji realnych logów (`~/.claude/projects`) — nie są udokumentowane
 * w spec.md 4.2, bo nie niosą danych o zużyciu tokenów, ale pozwalają rozpoznawalnie
 * nazwać sesję zamiast samego `sessionId`.
 *
 * W przeciwieństwie do wpisów `user`/`assistant` te wpisy nie mają pola `timestamp` —
 * kolejność napotkania w pliku jest jedynym sygnałem "świeżości".
 */
export interface ParsedSessionTitle {
  sessionId: string;
  kind: "ai" | "custom";
  title: string;
}

export function parseSessionTitleLine(line: string): ParsedSessionTitle | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const entry = raw as Record<string, unknown>;

  const sessionId = entry.sessionId;
  if (typeof sessionId !== "string") {
    return null;
  }

  if (entry.type === "ai-title" && typeof entry.aiTitle === "string") {
    return { sessionId, kind: "ai", title: entry.aiTitle };
  }
  if (entry.type === "custom-title" && typeof entry.customTitle === "string") {
    return { sessionId, kind: "custom", title: entry.customTitle };
  }

  return null;
}
