/**
 * Parsowanie pojedynczej linii pliku JSONL Claude Code — spec.md sekcja 4.2.
 *
 * Zwraca tylko strukturalne pola potrzebne dalej w potoku (grupowanie
 * w zadania, budowa UsageRecord). Wpisy o typach innych niż "user"/"assistant"
 * (np. "queue-operation", "attachment", "mode", "last-prompt") są pomijane —
 * nie definiują granicy zadania ani nie niosą danych o zużyciu tokenów.
 */

export interface ParsedUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ParsedEntry {
  type: "user" | "assistant";
  sessionId: string;
  uuid: string;
  isHumanMessage: boolean;
  timestamp: string;
  cwd: string;
  /** Obecne wyłącznie dla type: "assistant" z policzalnym zużyciem tokenów. */
  model?: string;
  usage?: ParsedUsage;
}

/**
 * Parsuje jedną linię JSONL. Zwraca `null`, jeśli linia:
 * - nie parsuje się jako JSON,
 * - ma `type` inny niż "user"/"assistant",
 * - brakuje jej pól wymaganych do grupowania (`sessionId`, `uuid`, `timestamp`).
 */
export function parseLine(line: string): ParsedEntry | null {
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

  const type = entry.type;
  if (type !== "user" && type !== "assistant") {
    return null;
  }

  const sessionId = entry.sessionId;
  const uuid = entry.uuid;
  const timestamp = entry.timestamp;
  const cwd = entry.cwd;
  if (
    typeof sessionId !== "string" ||
    typeof uuid !== "string" ||
    typeof timestamp !== "string" ||
    typeof cwd !== "string"
  ) {
    return null;
  }

  const origin = entry.origin as Record<string, unknown> | undefined;
  const isHumanMessage = type === "user" && origin?.kind === "human";

  const parsed: ParsedEntry = {
    type,
    sessionId,
    uuid,
    isHumanMessage,
    timestamp,
    cwd,
  };

  if (type === "assistant") {
    const message = entry.message as Record<string, unknown> | undefined;
    const model = message?.model;
    const usage = message?.usage as Record<string, unknown> | undefined;
    if (typeof model === "string" && usage) {
      const inputTokens = usage.input_tokens;
      const outputTokens = usage.output_tokens;
      const cacheCreation = usage.cache_creation_input_tokens;
      const cacheRead = usage.cache_read_input_tokens;
      if (
        typeof inputTokens === "number" &&
        typeof outputTokens === "number" &&
        typeof cacheCreation === "number" &&
        typeof cacheRead === "number"
      ) {
        parsed.model = model;
        parsed.usage = {
          inputTokens,
          outputTokens,
          cacheCreationInputTokens: cacheCreation,
          cacheReadInputTokens: cacheRead,
        };
      }
    }
  }

  return parsed;
}
