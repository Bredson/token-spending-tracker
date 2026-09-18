import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLine } from "../src/sources/claude-code/parseLine";
import { TaskGrouper } from "../src/sources/claude-code/taskGrouping";

const fixturePath = join(__dirname, "fixtures", "sample-session.jsonl");
const fixtureLines = readFileSync(fixturePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim().length > 0);
const parsedFixture = fixtureLines.map(parseLine).filter((p) => p !== null);

describe("TaskGrouper", () => {
  it("groups the human message and its tool_result/assistant continuations into one task", () => {
    const grouper = new TaskGrouper();
    const taskIds = new Map(parsedFixture.map((p) => [p!.uuid, grouper.assignTaskId(p!)]));

    // Task A: u1 (human) -> a2 -> u2 (tool_result) -> a3
    expect(taskIds.get("u1")).toBe("u1");
    expect(taskIds.get("a2")).toBe("u1");
    expect(taskIds.get("u2")).toBe("u1");
    expect(taskIds.get("a3")).toBe("u1");
  });

  it("starts a new task at the next human message, ignoring promptId changes", () => {
    const grouper = new TaskGrouper();
    const taskIds = new Map(parsedFixture.map((p) => [p!.uuid, grouper.assignTaskId(p!)]));

    // Task B: u3 (human) -> a4 -> a5 (sidechain/subagent) -> u4 (tool_result) -> a6
    // Note: u4 has a different promptId than u3/a4, confirming promptId is NOT
    // the grouping key (see spec.md 4.2) — it must still belong to task B.
    expect(taskIds.get("u3")).toBe("u3");
    expect(taskIds.get("a4")).toBe("u3");
    expect(taskIds.get("a5")).toBe("u3");
    expect(taskIds.get("u4")).toBe("u3");
    expect(taskIds.get("a6")).toBe("u3");
  });

  it("attributes subagent (isSidechain: true) usage to the parent task", () => {
    const grouper = new TaskGrouper();
    const taskIds = new Map(parsedFixture.map((p) => [p!.uuid, grouper.assignTaskId(p!)]));
    expect(taskIds.get("a5")).toBe(taskIds.get("a4"));
  });

  it("falls back to a placeholder task when no human message has been seen yet", () => {
    const grouper = new TaskGrouper();
    const orphan = parseLine(
      JSON.stringify({
        type: "assistant",
        sessionId: "orphan-session",
        uuid: "orphan-1",
        timestamp: "2026-01-01T00:00:00.000Z",
        cwd: "/tmp/project",
        message: {
          model: "claude-sonnet-5",
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        },
      }),
    )!;
    expect(grouper.assignTaskId(orphan)).toBe("orphan-session:pre");
  });

  it("keeps task grouping state independent per session", () => {
    const grouper = new TaskGrouper();
    const humanA = parseLine(
      JSON.stringify({
        type: "user",
        sessionId: "session-a",
        uuid: "a-human",
        timestamp: "2026-01-01T00:00:00.000Z",
        cwd: "/tmp/project",
        origin: { kind: "human" },
      }),
    )!;
    const humanB = parseLine(
      JSON.stringify({
        type: "user",
        sessionId: "session-b",
        uuid: "b-human",
        timestamp: "2026-01-01T00:00:00.000Z",
        cwd: "/tmp/project",
        origin: { kind: "human" },
      }),
    )!;

    expect(grouper.assignTaskId(humanA)).toBe("a-human");
    expect(grouper.assignTaskId(humanB)).toBe("b-human");
  });
});
