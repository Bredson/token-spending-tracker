import { describe, expect, it, vi } from "vitest";
import { Engine } from "../src/engine";
import type { Disposable, UsageRecord, UsageSource } from "../src/types";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: "rec-1",
    source: "fake",
    sessionId: "session-1",
    taskId: "task-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    model: "claude-sonnet-5",
    tokensInput: 100,
    tokensOutput: 50,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    costUsd: 1,
    projectPath: "/tmp/project",
    ...overrides,
  };
}

class FakeSource implements UsageSource {
  readonly id = "fake";
  readonly displayName = "Fake source";

  private watchCallback: ((records: UsageRecord[]) => void) | undefined;
  disposed = false;

  constructor(
    private readonly available: boolean,
    private readonly initialRecords: UsageRecord[],
  ) {}

  async detect(): Promise<boolean> {
    return this.available;
  }

  async loadAll(): Promise<UsageRecord[]> {
    return this.initialRecords;
  }

  watch(onUpdate: (newRecords: UsageRecord[]) => void): Disposable {
    this.watchCallback = onUpdate;
    return {
      dispose: () => {
        this.disposed = true;
      },
    };
  }

  /** Test helper: simulate the source's watcher pushing new records. */
  emit(records: UsageRecord[]): void {
    this.watchCallback?.(records);
  }

  getSessionTitles(): Map<string, string> {
    return this.titles ?? new Map();
  }

  titles: Map<string, string> | undefined;

  getUnknownModels(): string[] {
    return this.unknownModels ?? [];
  }

  unknownModels: string[] | undefined;
}

class MinimalSource implements UsageSource {
  readonly id = "minimal";
  readonly displayName = "Minimal source";
  async detect(): Promise<boolean> {
    return true;
  }
  async loadAll(): Promise<UsageRecord[]> {
    return [];
  }
  watch(): Disposable {
    return { dispose: () => {} };
  }
}

describe("Engine.start", () => {
  it("loads initial records only from sources that detect() as available", async () => {
    const available = new FakeSource(true, [makeRecord({ id: "r1" })]);
    const unavailable = new FakeSource(false, [makeRecord({ id: "r2" })]);

    const engine = new Engine({ sources: [available, unavailable] });
    await engine.start();

    expect(engine.getRecords().map((r) => r.id)).toEqual(["r1"]);
  });

  it("is idempotent — calling start() twice does not reload or double-watch", async () => {
    const source = new FakeSource(true, [makeRecord({ id: "r1" })]);
    const engine = new Engine({ sources: [source] });

    await engine.start();
    await engine.start();

    expect(engine.getRecords()).toHaveLength(1);
  });
});

describe("Engine ingest via watch()", () => {
  it("appends newly emitted records to the store", async () => {
    const source = new FakeSource(true, [makeRecord({ id: "r1" })]);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    source.emit([makeRecord({ id: "r2" })]);

    expect(engine.getRecords().map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });

  it("deduplicates records by id, ignoring re-emitted duplicates", async () => {
    const source = new FakeSource(true, [makeRecord({ id: "r1" })]);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    source.emit([makeRecord({ id: "r1" })]);

    expect(engine.getRecords()).toHaveLength(1);
  });

  it("notifies onChange listeners only when new records are actually added", async () => {
    const source = new FakeSource(true, [makeRecord({ id: "r1" })]);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    const listener = vi.fn();
    engine.onChange(listener);

    source.emit([makeRecord({ id: "r1" })]); // duplicate, should not notify
    expect(listener).not.toHaveBeenCalled();

    source.emit([makeRecord({ id: "r2" })]); // new, should notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("treats an explicitly empty batch as a metadata change and notifies listeners", async () => {
    const source = new FakeSource(true, []);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    let notifications = 0;
    engine.onChange(() => notifications++);

    source.emit([]);

    expect(notifications).toBe(1);
    expect(engine.getRecords()).toEqual([]);
  });

  it("stops notifying a listener after its subscription is disposed", async () => {
    const source = new FakeSource(true, []);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    const listener = vi.fn();
    const subscription = engine.onChange(listener);
    subscription.dispose();

    source.emit([makeRecord({ id: "r1" })]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Engine aggregation delegation", () => {
  it("aggregateByTask/Session/Project/Period reflect the current store", async () => {
    const source = new FakeSource(true, [
      makeRecord({ id: "r1", taskId: "t1", sessionId: "s1", projectPath: "/p1", costUsd: 1 }),
      makeRecord({ id: "r2", taskId: "t1", sessionId: "s1", projectPath: "/p1", costUsd: 2 }),
    ]);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    const byTask = engine.aggregateByTask();
    expect(byTask).toHaveLength(1);
    expect(byTask[0].totals.costUsd).toBe(3);

    const bySession = engine.aggregateBySession();
    expect(bySession).toHaveLength(1);
    expect(bySession[0].totals.recordCount).toBe(2);

    const byProject = engine.aggregateByProject();
    expect(byProject).toHaveLength(1);

    const byDay = engine.aggregateByPeriod("day");
    expect(byDay).toHaveLength(1);
  });
});

describe("Engine.getSessionTitles", () => {
  it("returns an empty map when no source implements getSessionTitles", async () => {
    const source = new FakeSource(true, []);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    expect(engine.getSessionTitles().size).toBe(0);
  });

  it("merges titles from sources that implement getSessionTitles", async () => {
    const source = new FakeSource(true, []);
    source.titles = new Map([["session-1", "Tytuł sesji"]]);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    expect(engine.getSessionTitles().get("session-1")).toBe("Tytuł sesji");
  });

  it("lets a later source override an earlier source's title for the same session", async () => {
    const first = new FakeSource(true, []);
    first.titles = new Map([["session-1", "Pierwszy tytuł"]]);
    const second = new FakeSource(true, []);
    second.titles = new Map([["session-1", "Drugi tytuł"]]);
    const engine = new Engine({ sources: [first, second] });
    await engine.start();

    expect(engine.getSessionTitles().get("session-1")).toBe("Drugi tytuł");
  });
});

describe("Engine.getUnknownModels", () => {
  it("returns an empty list when no source implements getUnknownModels", async () => {
    const engine = new Engine({ sources: [new MinimalSource()] });
    await engine.start();
    expect(engine.getUnknownModels()).toEqual([]);
  });

  it("merges and deduplicates unknown models across sources, sorted", async () => {
    const first = new FakeSource(true, []);
    first.unknownModels = ["zeta", "alpha"];
    const second = new FakeSource(true, []);
    second.unknownModels = ["alpha", "mid"];
    const engine = new Engine({ sources: [first, second] });
    await engine.start();
    expect(engine.getUnknownModels()).toEqual(["alpha", "mid", "zeta"]);
  });
});

describe("Engine.dispose", () => {
  it("disposes every source's watch subscription", async () => {
    const source = new FakeSource(true, []);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    engine.dispose();

    expect(source.disposed).toBe(true);
  });

  it("stops notifying listeners after dispose", async () => {
    const source = new FakeSource(true, []);
    const engine = new Engine({ sources: [source] });
    await engine.start();

    const listener = vi.fn();
    engine.onChange(listener);
    engine.dispose();

    source.emit([makeRecord({ id: "r1" })]);
    expect(listener).not.toHaveBeenCalled();
  });
});
