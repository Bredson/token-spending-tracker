import { mkdtemp, rm, writeFile, appendFile, truncate } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileCursorStore } from "../src/sources/claude-code/fileCursor";

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "token-tracker-filecursor-"));
  filePath = join(dir, "session.jsonl");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("FileCursorStore", () => {
  it("returns all lines on first read of a new file", async () => {
    await writeFile(filePath, "line1\nline2\n");
    const store = new FileCursorStore();
    const lines = await store.readNewLines(filePath);
    expect(lines).toEqual(["line1", "line2"]);
  });

  it("returns an empty array when the file has not changed", async () => {
    await writeFile(filePath, "line1\n");
    const store = new FileCursorStore();
    await store.readNewLines(filePath);
    const second = await store.readNewLines(filePath);
    expect(second).toEqual([]);
  });

  it("returns only newly appended lines, not the whole file again", async () => {
    await writeFile(filePath, "line1\nline2\n");
    const store = new FileCursorStore();
    const first = await store.readNewLines(filePath);
    expect(first).toEqual(["line1", "line2"]);

    await appendFile(filePath, "line3\nline4\n");
    const second = await store.readNewLines(filePath);
    expect(second).toEqual(["line3", "line4"]);
  });

  it("withholds an incomplete trailing line until it is terminated by a newline", async () => {
    await writeFile(filePath, "line1\n");
    const store = new FileCursorStore();
    await store.readNewLines(filePath);

    await appendFile(filePath, "partial-line-being-wri");
    const midWrite = await store.readNewLines(filePath);
    expect(midWrite).toEqual([]);

    await appendFile(filePath, "tten\n");
    const completed = await store.readNewLines(filePath);
    expect(completed).toEqual(["partial-line-being-written"]);
  });

  it("re-reads from the start if the file was truncated/overwritten", async () => {
    await writeFile(filePath, "line1\nline2\nline3\n");
    const store = new FileCursorStore();
    await store.readNewLines(filePath);

    await truncate(filePath, 0);
    await writeFile(filePath, "new-line1\n");
    const afterTruncate = await store.readNewLines(filePath);
    expect(afterTruncate).toEqual(["new-line1"]);
  });

  it("returns an empty array for a file that no longer exists", async () => {
    const store = new FileCursorStore();
    const lines = await store.readNewLines(join(dir, "does-not-exist.jsonl"));
    expect(lines).toEqual([]);
  });

  it("tracks cursors independently per file", async () => {
    const otherPath = join(dir, "other-session.jsonl");
    await writeFile(filePath, "a\n");
    await writeFile(otherPath, "b\n");
    const store = new FileCursorStore();

    expect(await store.readNewLines(filePath)).toEqual(["a"]);
    expect(await store.readNewLines(otherPath)).toEqual(["b"]);
    expect(await store.readNewLines(filePath)).toEqual([]);

    await appendFile(otherPath, "c\n");
    expect(await store.readNewLines(otherPath)).toEqual(["c"]);
    expect(await store.readNewLines(filePath)).toEqual([]);
  });
});
