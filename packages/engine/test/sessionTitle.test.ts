import { describe, expect, it } from "vitest";
import { parseSessionTitleLine } from "../src/sources/claude-code/sessionTitle";

describe("parseSessionTitleLine", () => {
  it("parses an ai-title entry", () => {
    expect(
      parseSessionTitleLine(
        JSON.stringify({ type: "ai-title", sessionId: "s1", aiTitle: "Tytuł" }),
      ),
    ).toEqual({ sessionId: "s1", kind: "ai", title: "Tytuł" });
  });

  it("parses a custom-title entry", () => {
    expect(
      parseSessionTitleLine(
        JSON.stringify({ type: "custom-title", sessionId: "s1", customTitle: "Mój tytuł" }),
      ),
    ).toEqual({ sessionId: "s1", kind: "custom", title: "Mój tytuł" });
  });

  it("returns null for unrelated entry types", () => {
    expect(
      parseSessionTitleLine(JSON.stringify({ type: "user", sessionId: "s1", uuid: "u1" })),
    ).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseSessionTitleLine("not json")).toBeNull();
  });

  it("returns null when sessionId is missing", () => {
    expect(
      parseSessionTitleLine(JSON.stringify({ type: "ai-title", aiTitle: "Tytuł" })),
    ).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(parseSessionTitleLine("   ")).toBeNull();
  });
});
