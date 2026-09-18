import { describe, expect, it } from "vitest";
import {
  aggregateByPeriod,
  aggregateByProject,
  aggregateBySession,
  aggregateByTask,
  periodKey,
} from "../src/aggregate";
import type { UsageRecord } from "../src/types";

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

describe("aggregateByTask", () => {
  it("sums tokens and cost across records sharing the same taskId", () => {
    const records = [
      makeRecord({ id: "r1", taskId: "task-1", tokensInput: 100, costUsd: 1 }),
      makeRecord({ id: "r2", taskId: "task-1", tokensInput: 200, costUsd: 2 }),
      makeRecord({ id: "r3", taskId: "task-2", tokensInput: 50, costUsd: 0.5 }),
    ];

    const result = aggregateByTask(records);
    const byKey = new Map(result.map((group) => [group.key, group.totals]));

    expect(byKey.get("task-1")).toMatchObject({
      tokensInput: 300,
      costUsd: 3,
      recordCount: 2,
    });
    expect(byKey.get("task-2")).toMatchObject({
      tokensInput: 50,
      costUsd: 0.5,
      recordCount: 1,
    });
  });

  it("returns an empty array for no records", () => {
    expect(aggregateByTask([])).toEqual([]);
  });
});

describe("aggregateBySession", () => {
  it("groups by sessionId", () => {
    const records = [
      makeRecord({ id: "r1", sessionId: "s1" }),
      makeRecord({ id: "r2", sessionId: "s2" }),
    ];
    const result = aggregateBySession(records);
    expect(result.map((g) => g.key).sort()).toEqual(["s1", "s2"]);
  });
});

describe("aggregateByProject", () => {
  it("groups by projectPath", () => {
    const records = [
      makeRecord({ id: "r1", projectPath: "/tmp/project-a" }),
      makeRecord({ id: "r2", projectPath: "/tmp/project-b" }),
      makeRecord({ id: "r3", projectPath: "/tmp/project-a" }),
    ];
    const result = aggregateByProject(records);
    const byKey = new Map(result.map((group) => [group.key, group.totals]));
    expect(byKey.get("/tmp/project-a")?.recordCount).toBe(2);
    expect(byKey.get("/tmp/project-b")?.recordCount).toBe(1);
  });
});

describe("periodKey", () => {
  it("formats a day key as YYYY-MM-DD in UTC", () => {
    expect(periodKey("2026-03-10T23:59:59.000Z", "day")).toBe("2026-03-10");
  });

  it("formats a month key as YYYY-MM", () => {
    expect(periodKey("2026-03-10T00:00:00.000Z", "month")).toBe("2026-03");
  });

  it("formats an ISO week key, correctly attributing the first week of the year", () => {
    // 2026-01-01 is a Thursday, so it's in ISO week 1 of 2026.
    expect(periodKey("2026-01-01T00:00:00.000Z", "week")).toBe("2026-W01");
  });

  it("attributes the last days of December to week 1 of the next year when applicable", () => {
    // 2025-12-29 is a Monday; ISO week containing it belongs to week 1 of 2026
    // because its Thursday (2026-01-01) falls in 2026.
    expect(periodKey("2025-12-29T00:00:00.000Z", "week")).toBe("2026-W01");
  });
});

describe("aggregateByPeriod", () => {
  it("groups records into day buckets", () => {
    const records = [
      makeRecord({ id: "r1", timestamp: "2026-03-10T08:00:00.000Z", costUsd: 1 }),
      makeRecord({ id: "r2", timestamp: "2026-03-10T20:00:00.000Z", costUsd: 2 }),
      makeRecord({ id: "r3", timestamp: "2026-03-11T08:00:00.000Z", costUsd: 3 }),
    ];

    const result = aggregateByPeriod(records, "day");
    const byKey = new Map(result.map((group) => [group.key, group.totals]));

    expect(byKey.get("2026-03-10")?.costUsd).toBe(3);
    expect(byKey.get("2026-03-11")?.costUsd).toBe(3);
  });
});
