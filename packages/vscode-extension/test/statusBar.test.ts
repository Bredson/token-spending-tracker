import { describe, expect, it } from "vitest";
import { formatStatusBarText, formatStatusBarTooltip } from "../src/statusBar";
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

describe("formatStatusBarTooltip", () => {
  it("explains the numbers and says there is no session yet when there are no records", () => {
    const tooltip = formatStatusBarTooltip([], new Map());
    expect(tooltip).toContain("Token Tracker");
    expect(tooltip).toContain("dziś");
    expect(tooltip).toContain("brak sesji");
  });

  it("names the most recently active session by its title, with the id alongside", () => {
    const records = [
      makeRecord({ id: "r1", sessionId: "old-1", timestamp: "2026-01-01T08:00:00.000Z" }),
      makeRecord({ id: "r2", sessionId: "new-2", timestamp: "2026-01-01T09:00:00.000Z" }),
    ];
    const tooltip = formatStatusBarTooltip(records, new Map([["new-2", "Naprawa cennika"]]));
    expect(tooltip).toContain("Naprawa cennika");
    expect(tooltip).toContain("new-2");
    expect(tooltip).not.toContain("old-1");
  });

  it("falls back to the session id when no title is known", () => {
    const records = [makeRecord({ sessionId: "sess-x" })];
    expect(formatStatusBarTooltip(records, new Map())).toContain("sess-x");
  });

  it("lists the models used today", () => {
    const records = [
      makeRecord({ id: "r1", model: "claude-sonnet-5" }),
      makeRecord({ id: "r2", model: "claude-haiku-4-5" }),
      makeRecord({ id: "r3", model: "claude-sonnet-5" }),
    ];
    const tooltip = formatStatusBarTooltip(records, new Map());
    expect(tooltip).toContain("claude-sonnet-5");
    expect(tooltip).toContain("claude-haiku-4-5");
    expect(tooltip.match(/claude-sonnet-5/g)).toHaveLength(1);
  });
});
