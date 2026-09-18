import { describe, expect, it } from "vitest";
import type { UsageRecord } from "@token-tracker/engine";
import { buildDashboardData } from "../src/dashboard/dataProvider";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: "rec",
    source: "claude-code",
    sessionId: "session-1",
    taskId: "task-1",
    timestamp: "2026-03-10T12:00:00.000Z",
    model: "claude-sonnet-5",
    tokensInput: 100,
    tokensOutput: 50,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    costUsd: 1,
    projectPath: "/tmp/project-a",
    ...overrides,
  };
}

describe("buildDashboardData", () => {
  const now = new Date("2026-03-10T18:00:00.000Z");

  it("computes today/week/month totals relative to `now`", () => {
    const records = [
      makeRecord({ id: "r1", timestamp: "2026-03-10T08:00:00.000Z", costUsd: 1 }),
      makeRecord({ id: "r2", timestamp: "2026-02-01T08:00:00.000Z", costUsd: 5 }),
    ];
    const data = buildDashboardData(records, now);
    expect(data.overview.today.costUsd).toBe(1);
    expect(data.overview.today.recordCount).toBe(1);
    expect(data.overview.month.costUsd).toBe(1);
  });

  it("builds a 30-point daily cost series ending at `now`, filling zero-cost gaps", () => {
    const records = [makeRecord({ timestamp: "2026-03-10T08:00:00.000Z", costUsd: 2 })];
    const data = buildDashboardData(records, now);
    expect(data.overview.dailyCostSeries).toHaveLength(30);
    expect(data.overview.dailyCostSeries[29]).toEqual({ date: "2026-03-10", costUsd: 2 });
    expect(data.overview.dailyCostSeries[0].costUsd).toBe(0);
  });

  it("groups sessions and nested tasks with correct totals, sorted by most recent activity", () => {
    const records = [
      makeRecord({
        id: "r1",
        sessionId: "s1",
        taskId: "t1",
        timestamp: "2026-03-10T08:00:00.000Z",
        costUsd: 1,
      }),
      makeRecord({
        id: "r2",
        sessionId: "s1",
        taskId: "t2",
        timestamp: "2026-03-10T09:00:00.000Z",
        costUsd: 2,
      }),
      makeRecord({
        id: "r3",
        sessionId: "s2",
        taskId: "t3",
        timestamp: "2026-03-10T10:00:00.000Z",
        costUsd: 3,
      }),
    ];
    const data = buildDashboardData(records, now);

    expect(data.sessions.map((s) => s.sessionId)).toEqual(["s2", "s1"]);

    const s1 = data.sessions.find((s) => s.sessionId === "s1");
    expect(s1?.totals.costUsd).toBe(3);
    expect(s1?.tasks.map((t) => t.taskId)).toEqual(["t2", "t1"]);
    expect(s1?.tasks.find((t) => t.taskId === "t1")?.totals.costUsd).toBe(1);
  });

  it("returns empty sessions and zero totals for no records", () => {
    const data = buildDashboardData([], now);
    expect(data.sessions).toEqual([]);
    expect(data.overview.today.recordCount).toBe(0);
  });
});
