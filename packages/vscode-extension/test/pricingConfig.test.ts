import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPricingRows,
  defaultPricingTable,
  modelsToImport,
  overridesFromEditedRows,
  parsePricingOverrides,
  resolvePricingTable,
} from "../src/pricingConfig";

const validEntry = { inputPer1M: 1, outputPer1M: 2, cacheReadPer1M: 0.1, cacheWritePer1M: 1.25 };

describe("resolvePricingTable", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "token-tracker-pricing-config-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns the bundled table when nothing is configured", () => {
    const { table, rejectedModels } = resolvePricingTable({}, dir);
    expect(table["claude-sonnet-5"]).toBeDefined();
    expect(rejectedModels).toEqual([]);
  });

  it("loads a custom pricing file, expanding a leading `~` to the given home dir", async () => {
    await writeFile(join(dir, "prices.json"), JSON.stringify({ "openai/gpt-6-astra": validEntry }));
    const { table } = resolvePricingTable({ pricingFile: "~/prices.json" }, dir);
    expect(table["openai/gpt-6-astra"]).toEqual(validEntry);
    expect(table["claude-sonnet-5"]).toBeDefined();
  });

  it("applies inline overrides on top of the file, so inline wins for the same model", async () => {
    await writeFile(
      join(dir, "prices.json"),
      JSON.stringify({ "claude-sonnet-5": { ...validEntry, inputPer1M: 111 } }),
    );
    const { table } = resolvePricingTable(
      {
        pricingFile: join(dir, "prices.json"),
        pricingOverrides: { "claude-sonnet-5": { ...validEntry, inputPer1M: 222 } },
      },
      dir,
    );
    expect(table["claude-sonnet-5"].inputPer1M).toBe(222);
  });

  it("rejects override entries that are not four finite non-negative numbers, keeping the default", () => {
    const { table, rejectedModels } = resolvePricingTable(
      {
        pricingOverrides: {
          "claude-sonnet-5": { inputPer1M: "2", outputPer1M: 10, cacheReadPer1M: 0.2, cacheWritePer1M: 2.5 },
          "claude-opus-5": { inputPer1M: -1, outputPer1M: 25, cacheReadPer1M: 0.5, cacheWritePer1M: 6.25 },
          "claude-haiku-4-5": { inputPer1M: 1, outputPer1M: 5 },
          "good-model": validEntry,
        },
      },
      dir,
    );
    expect(rejectedModels).toEqual(["claude-haiku-4-5", "claude-opus-5", "claude-sonnet-5"]);
    expect(table["claude-sonnet-5"].inputPer1M).toBe(2);
    expect(table["good-model"]).toEqual(validEntry);
  });

  it("ignores overrides that are not a plain object at all", () => {
    const { table, rejectedModels } = resolvePricingTable({ pricingOverrides: "nope" }, dir);
    expect(table["claude-sonnet-5"]).toBeDefined();
    expect(rejectedModels).toEqual([]);
  });

  it("treats an empty pricingFile string as not configured", () => {
    const { table } = resolvePricingTable({ pricingFile: "   " }, dir);
    expect(table["claude-sonnet-5"].inputPer1M).toBe(2);
  });
});

describe("pricing editor helpers", () => {
  const base = { inputPer1M: 1, outputPer1M: 2, cacheReadPer1M: 0.1, cacheWritePer1M: 1.25 };
  const changed = { ...base, inputPer1M: 9 };
  const defaults = { kept: base, changed: base };

  it("defaultPricingTable ignores overrides and prices claude-opus-5-5", async () => {
    const dir = await mkdtemp(join(tmpdir(), "token-tracker-pricing-defaults-"));
    try {
      expect(defaultPricingTable({ pricingOverrides: { x: base } }, dir).x).toBeUndefined();
      expect(defaultPricingTable({}, dir)["claude-opus-5-5"]).toEqual({
        inputPer1M: 4,
        outputPer1M: 20,
        cacheReadPer1M: 0.2,
        cacheWritePer1M: 5,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parsePricingOverrides splits valid entries from rejected ones", () => {
    expect(parsePricingOverrides({ good: base, bad: { inputPer1M: 1 } })).toEqual({
      valid: { good: base },
      rejected: ["bad"],
    });
    expect(parsePricingOverrides(undefined)).toEqual({ valid: {}, rejected: [] });
  });

  it("buildPricingRows lists defaults with overrides applied, then custom models", () => {
    expect(buildPricingRows(defaults, { changed, custom: base })).toEqual([
      { model: "kept", pricing: base, defaultPricing: base },
      { model: "changed", pricing: changed, defaultPricing: base },
      { model: "custom", pricing: base },
    ]);
  });

  it("buildPricingRows appends unpriced models seen in logs, skipping ones that already have a price", () => {
    expect(buildPricingRows(defaults, { custom: base }, ["openai/gpt-6-astra", "kept", "custom"])).toEqual([
      { model: "kept", pricing: base, defaultPricing: base },
      { model: "changed", pricing: base, defaultPricing: base },
      { model: "custom", pricing: base },
      { model: "openai/gpt-6-astra", pricing: null },
    ]);
  });

  it("overridesFromEditedRows keeps only changed and custom rows", () => {
    const result = overridesFromEditedRows(
      [
        { model: "kept", pricing: base },
        { model: "changed", pricing: changed },
        { model: " custom ", pricing: base },
      ],
      defaults,
    );
    expect(result).toEqual({ ok: true, overrides: { changed, custom: base } });
  });

  it("overridesFromEditedRows rejects empty names, duplicates and invalid prices", () => {
    expect(overridesFromEditedRows([{ model: "  ", pricing: base }], defaults)).toMatchObject({ ok: false });
    expect(
      overridesFromEditedRows(
        [
          { model: "a", pricing: base },
          { model: "a", pricing: base },
        ],
        defaults,
      ),
    ).toMatchObject({ ok: false });
    expect(
      overridesFromEditedRows([{ model: "a", pricing: { ...base, outputPer1M: -1 } }], defaults),
    ).toMatchObject({ ok: false });
    expect(overridesFromEditedRows("nope", defaults)).toMatchObject({ ok: false });
  });
});

describe("modelsToImport", () => {
  const gatewayListing = `
Endpoint : https://llm-api.tools.procountor.com
User     : someone@example.com

🤖 GPT Models:
  ○ openai/gpt-5         (EU)       →  /model openai/gpt-5
  ○ openai/gpt-6-astra              →  /model openai/gpt-6-astra

🔮 Claude Models:
  ○ anthropic/claude-fable-5-1       (1M)  →  /model anthropic/claude-fable-5-1[1m]
  ○ anthropic/claude-opus-4-5              →  /model anthropic/claude-opus-4-5

📦 Other Models:
  ○ openai/DeepSeek-V4-Flash             →  /model openai/DeepSeek-V4-Flash
`;

  it("extracts provider/model ids, normalizes Claude ids and skips models already in the table", () => {
    expect(modelsToImport(gatewayListing, ["claude-fable-5-1", "openai/gpt-6-astra"])).toEqual({
      added: ["openai/gpt-5", "claude-opus-4-5", "openai/DeepSeek-V4-Flash"],
      skipped: 2,
    });
  });

  it("matches existing rows by their normalized id and ignores trailing punctuation", () => {
    expect(modelsToImport("anthropic/claude-sonnet-5[1m], openai/gpt-5.", ["anthropic/claude-sonnet-5"])).toEqual({
      added: ["openai/gpt-5"],
      skipped: 1,
    });
  });

  it("returns nothing for text without model ids", () => {
    expect(modelsToImport("brak modeli tutaj https://example.com", [])).toEqual({ added: [], skipped: 0 });
  });
});
