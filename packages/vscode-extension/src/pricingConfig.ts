import { join } from "node:path";
import { loadPricingTable, type ModelPricing, type PricingTable } from "@token-tracker/engine";

/** Kształt sekcji `tokenTracker.*` z ustawień VS Code — surowe, niezaufane dane użytkownika. */
export interface PricingConfig {
  pricingFile?: string;
  pricingOverrides?: unknown;
}

export interface ResolvedPricing {
  table: PricingTable;
  /** Klucze z `pricingOverrides`, które miały niepoprawny kształt i zostały pominięte. */
  rejectedModels: string[];
}

const PRICE_FIELDS: readonly (keyof ModelPricing)[] = [
  "inputPer1M",
  "outputPer1M",
  "cacheReadPer1M",
  "cacheWritePer1M",
];

export function resolvePricingTable(config: PricingConfig, homeDir: string): ResolvedPricing {
  const filePath = config.pricingFile?.trim();
  const table = loadPricingTable(filePath ? expandHome(filePath, homeDir) : undefined);

  const rejectedModels: string[] = [];
  if (isPlainObject(config.pricingOverrides)) {
    for (const [model, entry] of Object.entries(config.pricingOverrides)) {
      if (isModelPricing(entry)) {
        table[model] = entry;
      } else {
        rejectedModels.push(model);
      }
    }
  }

  return { table, rejectedModels: rejectedModels.sort() };
}

function expandHome(path: string, homeDir: string): string {
  return path === "~" || path.startsWith("~/") ? join(homeDir, path.slice(1)) : path;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isModelPricing(value: unknown): value is ModelPricing {
  return (
    isPlainObject(value) &&
    PRICE_FIELDS.every((field) => {
      const price = value[field];
      return typeof price === "number" && Number.isFinite(price) && price >= 0;
    })
  );
}
