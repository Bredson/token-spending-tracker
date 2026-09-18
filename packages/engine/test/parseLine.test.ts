import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLine } from "../src/sources/claude-code/parseLine";

const fixturePath = join(__dirname, "fixtures", "sample-session.jsonl");
const fixtureLines = readFileSync(fixturePath, "utf-8")
  .split("\n")
  .filter((line) => line.trim().length > 0);

describe("parseLine", () => {
  it("returns null for non-JSON lines", () => {
    expect(parseLine("not json")).toBeNull();
  });

  it("returns null for blank lines", () => {
    expect(parseLine("   ")).toBeNull();
  });

  it("skips irrelevant entry types (queue-operation, attachment, mode, last-prompt)", () => {
    const results = fixtureLines.map(parseLine);
    const skippedCount = results.filter((r) => r === null).length;
    // fixture has 4 irrelevant entries: attachment, queue-operation, mode, last-prompt
    expect(skippedCount).toBe(4);
  });

  it("marks the human message entry with isHumanMessage: true", () => {
    const parsed = fixtureLines.map(parseLine).filter((p) => p !== null);
    const humanMessages = parsed.filter((p) => p!.isHumanMessage);
    expect(humanMessages).toHaveLength(2);
    expect(humanMessages.map((p) => p!.uuid)).toEqual(["u1", "u3"]);
  });

  it("does not mark tool_result 'user' entries as human messages", () => {
    const parsed = fixtureLines.map(parseLine).filter((p) => p !== null);
    const toolResultEntry = parsed.find((p) => p!.uuid === "u2");
    expect(toolResultEntry?.isHumanMessage).toBe(false);
  });

  it("extracts model and token usage from assistant entries", () => {
    const parsed = fixtureLines.map(parseLine).filter((p) => p !== null);
    const assistantEntry = parsed.find((p) => p!.uuid === "a2");
    expect(assistantEntry).toMatchObject({
      type: "assistant",
      model: "claude-sonnet-5",
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        cacheCreationInputTokens: 500,
        cacheReadInputTokens: 0,
      },
    });
  });

  it("does not attach usage to non-assistant entries", () => {
    const parsed = fixtureLines.map(parseLine).filter((p) => p !== null);
    const userEntry = parsed.find((p) => p!.uuid === "u1");
    expect(userEntry?.usage).toBeUndefined();
    expect(userEntry?.model).toBeUndefined();
  });
});
