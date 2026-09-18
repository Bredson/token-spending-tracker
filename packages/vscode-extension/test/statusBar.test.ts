import { describe, expect, it } from "vitest";
import { formatStatusBarText } from "../src/statusBar";
import type { UsageRecord } from "@token-tracker/engine";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: "rec",
    source: "claude-code",
    sessionId: "session-1",
    taskId: "task-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    model: "claude-sonnet-5",
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    costUsd: 0,
    projectPath: "/tmp/project",
    ...overrides,
  };
}

describe("formatStatusBarText", () => {
  it("formats zero records as $0.00 · 0 tok", () => {
    expect(formatStatusBarText([])).toBe("$ 0.00 · 0 tok");
  });

  it("sums cost and all token kinds across records", () => {
    const records = [
      makeRecord({ costUsd: 0.1, tokensInput: 100, tokensOutput: 50 }),
      makeRecord({ costUsd: 0.32, tokensCacheRead: 200, tokensCacheWrite: 50 }),
    ];
    expect(formatStatusBarText(records)).toBe("$ 0.42 · 400 tok");
  });

  it("abbreviates token counts >= 1000 as Nk", () => {
    const records = [makeRecord({ costUsd: 0.42, tokensInput: 12300 })];
    expect(formatStatusBarText(records)).toBe("$ 0.42 · 12.3k tok");
  });
});
