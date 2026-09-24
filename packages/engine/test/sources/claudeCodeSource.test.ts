import { mkdtemp, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeCodeSource } from "../../src/sources/claude-code";
import type { UsageRecord } from "../../src/types";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "token-tracker-source-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function humanLine(opts: { uuid: string; sessionId: string }): string {
  return JSON.stringify({
    type: "user",
    sessionId: opts.sessionId,
    uuid: opts.uuid,
    timestamp: "2026-01-01T00:00:00.000Z",
    cwd: "/tmp/example-project",
    origin: { kind: "human" },
  });
}

function assistantLine(opts: {
  uuid: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): string {
  return JSON.stringify({
    type: "assistant",
    sessionId: opts.sessionId,
    uuid: opts.uuid,
    timestamp: "2026-01-01T00:00:01.000Z",
    cwd: "/tmp/example-project",
    message: {
      model: opts.model,
      usage: {
        input_tokens: opts.inputTokens,
        output_tokens: opts.outputTokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
  });
}

describe("ClaudeCodeSource.detect", () => {
  it("returns false when the projects dir does not exist", async () => {
    const source = new ClaudeCodeSource({ projectsDir: join(dir, "missing") });
    expect(await source.detect()).toBe(false);
  });

  it("returns true when the projects dir exists", async () => {
    const source = new ClaudeCodeSource({ projectsDir: dir });
    expect(await source.detect()).toBe(true);
  });
});

describe("ClaudeCodeSource.loadAll", () => {
  it("parses a session file into a priced UsageRecord grouped under its task", async () => {
    const sessionFile = join(dir, "session-1.jsonl");
    const lines = [
      humanLine({ uuid: "u1", sessionId: "session-1" }),
      assistantLine({
        uuid: "a1",
        sessionId: "session-1",
        model: "claude-sonnet-5",
        inputTokens: 100,
        outputTokens: 50,
      }),
    ];
    await writeFile(sessionFile, lines.join("\n") + "\n");

    const source = new ClaudeCodeSource({ projectsDir: dir });
    const records = await source.loadAll();

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sessionId: "session-1",
      taskId: "u1",
      model: "claude-sonnet-5",
      tokensInput: 100,
      tokensOutput: 50,
      tokensCacheRead: 0,
      tokensCacheWrite: 0,
      projectPath: "/tmp/example-project",
    });
    expect(records[0].costUsd).toBeGreaterThan(0);
  });

  it("returns an empty array when the projects dir does not exist", async () => {
    const source = new ClaudeCodeSource({ projectsDir: join(dir, "missing") });
    expect(await source.loadAll()).toEqual([]);
  });

  it("sets costUsd = 0 without throwing for an unknown model, and reports it once", async () => {
    const sessionFile = join(dir, "session-unknown.jsonl");
    await writeFile(
      sessionFile,
      humanLine({ uuid: "u1", sessionId: "session-unknown" }) +
        "\n" +
        assistantLine({
          uuid: "a1",
          sessionId: "session-unknown",
          model: "claude-unreleased-model",
          inputTokens: 10,
          outputTokens: 5,
        }) +
        "\n",
    );

    const seenUnknownModels: string[] = [];
    const source = new ClaudeCodeSource({
      projectsDir: dir,
      onUnknownModel: (model) => seenUnknownModels.push(model),
    });

    const records = await source.loadAll();

    expect(records).toHaveLength(1);
    expect(records[0].costUsd).toBe(0);
    expect(seenUnknownModels).toEqual(["claude-unreleased-model"]);
  });
});

describe("ClaudeCodeSource.getUnknownModels", () => {
  it("returns an empty list when every model was priced", async () => {
    await writeFile(
      join(dir, "s.jsonl"),
      assistantLine({ uuid: "a1", sessionId: "s", model: "claude-sonnet-5", inputTokens: 1, outputTokens: 1 }) + "\n",
    );
    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();
    expect(source.getUnknownModels()).toEqual([]);
  });

  it("lists each unpriced model once, sorted, even when a custom onUnknownModel callback is given", async () => {
    await writeFile(
      join(dir, "s.jsonl"),
      [
        assistantLine({ uuid: "a1", sessionId: "s", model: "zeta-model", inputTokens: 1, outputTokens: 1 }),
        assistantLine({ uuid: "a2", sessionId: "s", model: "alpha-model", inputTokens: 1, outputTokens: 1 }),
        assistantLine({ uuid: "a3", sessionId: "s", model: "zeta-model", inputTokens: 1, outputTokens: 1 }),
      ].join("\n") + "\n",
    );
    const source = new ClaudeCodeSource({ projectsDir: dir, onUnknownModel: () => {} });
    await source.loadAll();
    expect(source.getUnknownModels()).toEqual(["alpha-model", "zeta-model"]);
  });
});

describe("ClaudeCodeSource.getSessionTitles", () => {
  it("returns nothing when no title entries were ever seen", async () => {
    const sessionFile = join(dir, "session-notitle.jsonl");
    await writeFile(
      sessionFile,
      humanLine({ uuid: "u1", sessionId: "session-notitle" }) + "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();

    expect(source.getSessionTitles().get("session-notitle")).toBeUndefined();
  });

  it("picks up an ai-title entry alongside the usual usage lines", async () => {
    const sessionFile = join(dir, "session-ai-title.jsonl");
    await writeFile(
      sessionFile,
      [
        humanLine({ uuid: "u1", sessionId: "session-ai-title" }),
        JSON.stringify({
          type: "ai-title",
          sessionId: "session-ai-title",
          aiTitle: "Ranking źródeł wiedzy o AI",
        }),
      ].join("\n") + "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();

    expect(source.getSessionTitles().get("session-ai-title")).toBe("Ranking źródeł wiedzy o AI");
  });

  it("prefers a custom-title over an ai-title for the same session", async () => {
    const sessionFile = join(dir, "session-custom-title.jsonl");
    await writeFile(
      sessionFile,
      [
        JSON.stringify({
          type: "ai-title",
          sessionId: "session-custom-title",
          aiTitle: "Tytuł automatyczny",
        }),
        JSON.stringify({
          type: "custom-title",
          sessionId: "session-custom-title",
          customTitle: "Tytuł nadany ręcznie",
        }),
      ].join("\n") + "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();

    expect(source.getSessionTitles().get("session-custom-title")).toBe("Tytuł nadany ręcznie");
  });

  it("does not turn a title entry into a UsageRecord", async () => {
    const sessionFile = join(dir, "session-title-only.jsonl");
    await writeFile(
      sessionFile,
      JSON.stringify({
        type: "ai-title",
        sessionId: "session-title-only",
        aiTitle: "Tylko tytuł, bez zużycia",
      }) + "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    const records = await source.loadAll();

    expect(records).toEqual([]);
  });
});

describe("ClaudeCodeSource.watch", () => {
  it("emits only newly appended records, never re-emitting what loadAll already returned", async () => {
    const sessionFile = join(dir, "session-2.jsonl");
    await writeFile(
      sessionFile,
      humanLine({ uuid: "u1", sessionId: "session-2" }) +
        "\n" +
        assistantLine({
          uuid: "a1",
          sessionId: "session-2",
          model: "claude-sonnet-5",
          inputTokens: 10,
          outputTokens: 5,
        }) +
        "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();

    const received: UsageRecord[] = [];
    const disposable = source.watch((records) => {
      received.push(...records);
    });

    try {
      // Give chokidar's initial directory scan time to finish registering
      // watches before we append — otherwise the append can race the setup.
      await new Promise((resolve) => setTimeout(resolve, 300));

      await appendFile(
        sessionFile,
        assistantLine({
          uuid: "a2",
          sessionId: "session-2",
          model: "claude-sonnet-5",
          inputTokens: 20,
          outputTokens: 10,
        }) + "\n",
      );

      await vi.waitFor(
        () => {
          expect(received).toHaveLength(1);
        },
        { timeout: 5000, interval: 50 },
      );

      expect(received[0]).toMatchObject({
        taskId: "u1",
        tokensInput: 20,
        tokensOutput: 10,
      });
    } finally {
      disposable.dispose();
    }
  }, 8000);

  it("picks up a custom-title appended while watching and signals the change with an empty batch", async () => {
    const sessionFile = join(dir, "session-retitle.jsonl");
    await writeFile(
      sessionFile,
      [
        humanLine({ uuid: "u1", sessionId: "session-retitle" }),
        JSON.stringify({ type: "ai-title", sessionId: "session-retitle", aiTitle: "Tytuł automatyczny" }),
      ].join("\n") + "\n",
    );

    const source = new ClaudeCodeSource({ projectsDir: dir });
    await source.loadAll();
    expect(source.getSessionTitles().get("session-retitle")).toBe("Tytuł automatyczny");

    const batches: UsageRecord[][] = [];
    const disposable = source.watch((records) => {
      batches.push(records);
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));

      await appendFile(
        sessionFile,
        JSON.stringify({ type: "custom-title", sessionId: "session-retitle", customTitle: "Nazwa ręczna" }) + "\n",
      );

      await vi.waitFor(
        () => {
          expect(batches).toHaveLength(1);
        },
        { timeout: 5000, interval: 50 },
      );

      expect(batches[0]).toEqual([]);
      expect(source.getSessionTitles().get("session-retitle")).toBe("Nazwa ręczna");
    } finally {
      disposable.dispose();
    }
  }, 8000);
});
