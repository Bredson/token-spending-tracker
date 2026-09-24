import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyPricing,
  loadPricingTable,
  normalizeModelId,
  type PricingTable,
} from "../src/pricing";
import type { UsageRecord } from "../src/types";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    id: "rec-1",
    source: "claude-code",
    sessionId: "session-1",
    taskId: "task-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    model: "claude-sonnet-5",
    tokensInput: 1_000_000,
    tokensOutput: 1_000_000,
    tokensCacheRead: 1_000_000,
    tokensCacheWrite: 1_000_000,
    costUsd: 0,
    projectPath: "/tmp/project",
    ...overrides,
  };
}

describe("loadPricingTable", () => {
  it("returns the default bundled table when no custom path is given", () => {
    const table = loadPricingTable();
    expect(table["claude-sonnet-5"]).toBeDefined();
    expect(table["claude-opus-5"]).toBeDefined();
    expect(table["claude-haiku-4-5"]).toBeDefined();
  });

  it("merges a custom pricing file over the defaults, per-model", () => {
    const table = loadPricingTable();
    expect(table["claude-sonnet-5"].inputPer1M).toBe(2);
    expect(table["claude-opus-5"]).toBeDefined();
  });
});

describe("loadPricingTable with a custom file on disk", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "token-tracker-pricing-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("overrides a known model and adds a new one, keeping other defaults intact", async () => {
    const customPath = join(dir, "custom-pricing.json");
    await writeFile(
      customPath,
      JSON.stringify({
        "claude-sonnet-5": {
          inputPer1M: 999,
          outputPer1M: 999,
          cacheReadPer1M: 999,
          cacheWritePer1M: 999,
        },
        "some-future-model": {
          inputPer1M: 1,
          outputPer1M: 2,
          cacheReadPer1M: 0.1,
          cacheWritePer1M: 0.5,
        },
      }),
    );

    const table = loadPricingTable(customPath);
    expect(table["claude-sonnet-5"].inputPer1M).toBe(999);
    expect(table["some-future-model"]).toEqual({
      inputPer1M: 1,
      outputPer1M: 2,
      cacheReadPer1M: 0.1,
      cacheWritePer1M: 0.5,
    });
    // untouched default model still present
    expect(table["claude-opus-5"]).toBeDefined();
  });

  it("falls back to defaults without throwing if the custom file is missing", () => {
    const table = loadPricingTable(join(dir, "does-not-exist.json"));
    expect(table["claude-sonnet-5"]).toBeDefined();
  });

  it("falls back to defaults without throwing if the custom file has invalid JSON", async () => {
    const customPath = join(dir, "broken.json");
    await writeFile(customPath, "{ not valid json");

    const table = loadPricingTable(customPath);
    expect(table["claude-sonnet-5"]).toBeDefined();
  });
});

describe("applyPricing", () => {
  const table: PricingTable = {
    "claude-sonnet-5": {
      inputPer1M: 2,
      outputPer1M: 10,
      cacheReadPer1M: 0.2,
      cacheWritePer1M: 2.5,
    },
  };

  it("computes costUsd from tokens and per-1M rates", () => {
    const record = makeRecord();
    const priced = applyPricing(record, table);
    // 1M tokens of each kind at the rates above: 2 + 10 + 0.2 + 2.5
    expect(priced.costUsd).toBeCloseTo(14.7, 6);
  });

  it("does not mutate the input record", () => {
    const record = makeRecord();
    applyPricing(record, table);
    expect(record.costUsd).toBe(0);
  });

  it("returns costUsd = 0 and never throws for an unknown model", () => {
    const record = makeRecord({ model: "claude-unreleased-model" });
    expect(() => applyPricing(record, table)).not.toThrow();
    expect(applyPricing(record, table).costUsd).toBe(0);
  });

  it("calls onUnknownModel with the model name when the model is missing from the table", () => {
    const record = makeRecord({ model: "claude-unreleased-model" });
    const seen: string[] = [];
    applyPricing(record, table, (model) => seen.push(model));
    expect(seen).toEqual(["claude-unreleased-model"]);
  });

  it("does not call onUnknownModel for a known model", () => {
    const record = makeRecord();
    const seen: string[] = [];
    applyPricing(record, table, (model) => seen.push(model));
    expect(seen).toEqual([]);
  });

  it("prices a gateway-style id `anthropic/<model>[1m]` as the bare model", () => {
    const record = makeRecord({ model: "anthropic/claude-sonnet-5[1m]" });
    const seen: string[] = [];
    const priced = applyPricing(record, table, (model) => seen.push(model));
    expect(priced.costUsd).toBeCloseTo(14.7, 6);
    expect(seen).toEqual([]);
  });

  it("prices the bare `<synthetic>` model at 0 without reporting it as unknown", () => {
    const record = makeRecord({ model: "<synthetic>" });
    const seen: string[] = [];
    expect(applyPricing(record, table, (model) => seen.push(model)).costUsd).toBe(0);
    expect(seen).toEqual([]);
  });

  it("keeps `model` on the returned record untouched (only the lookup is normalized)", () => {
    const record = makeRecord({ model: "anthropic/claude-sonnet-5[1m]" });
    expect(applyPricing(record, table).model).toBe("anthropic/claude-sonnet-5[1m]");
  });
});

describe("normalizeModelId", () => {
  it("strips the `anthropic/` provider prefix", () => {
    expect(normalizeModelId("anthropic/claude-opus-5")).toBe("claude-opus-5");
  });

  it("strips the `[1m]` context-window suffix", () => {
    expect(normalizeModelId("claude-sonnet-5[1m]")).toBe("claude-sonnet-5");
  });

  it("maps bare family aliases used by Claude Code to a concrete current model", () => {
    expect(normalizeModelId("sonnet")).toBe("claude-sonnet-5");
    expect(normalizeModelId("opus")).toBe("claude-opus-5");
    expect(normalizeModelId("haiku")).toBe("claude-haiku-4-5");
    expect(normalizeModelId("fable")).toBe("claude-fable-5-1");
  });

  it("leaves an already-canonical id unchanged", () => {
    expect(normalizeModelId("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001");
  });

  it("leaves a non-Anthropic id like `openai/gpt-6-astra` unchanged", () => {
    expect(normalizeModelId("openai/gpt-6-astra")).toBe("openai/gpt-6-astra");
  });
});

describe("applyPricing with the bundled table and real-world model ids", () => {
  const table = loadPricingTable();

  it.each(["sonnet", "opus", "haiku", "fable", "anthropic/claude-fable-5-1[1m]"])(
    "prices %s above zero without reporting it as unknown",
    (model) => {
      const seen: string[] = [];
      const priced = applyPricing(makeRecord({ model }), table, (m) => seen.push(m));
      expect(priced.costUsd).toBeGreaterThan(0);
      expect(seen).toEqual([]);
    },
  );
});
