import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePricingTable } from "../src/pricingConfig";

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
