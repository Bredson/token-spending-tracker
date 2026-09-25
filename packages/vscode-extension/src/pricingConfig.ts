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
  const { valid, rejected } = parsePricingOverrides(config.pricingOverrides);
  return { table: { ...defaultPricingTable(config, homeDir), ...valid }, rejectedModels: rejected };
}

/** Ceny bez nadpisań z ustawień: wbudowane + opcjonalny plik użytkownika. */
export function defaultPricingTable(config: PricingConfig, homeDir: string): PricingTable {
  const filePath = config.pricingFile?.trim();
  return loadPricingTable(filePath ? expandHome(filePath, homeDir) : undefined);
}

export interface ParsedOverrides {
  valid: PricingTable;
  /** Klucze z niepoprawnym kształtem wpisu (posortowane). */
  rejected: string[];
}

export function parsePricingOverrides(raw: unknown): ParsedOverrides {
  const valid: PricingTable = {};
  const rejected: string[] = [];
  if (isPlainObject(raw)) {
    for (const [model, entry] of Object.entries(raw)) {
      if (isModelPricing(entry)) {
        valid[model] = entry;
      } else {
        rejected.push(model);
      }
    }
  }
  return { valid, rejected: rejected.sort() };
}

/**
 * Wiersz edytora cennika: brak `defaultPricing` oznacza model dodany przez użytkownika,
 * `pricing === null` — model widziany w logach, który jeszcze nie ma ceny.
 */
export interface PricingRow {
  model: string;
  pricing: ModelPricing | null;
  defaultPricing?: ModelPricing;
}

/** Modele z cenami domyślnymi (z naniesionymi nadpisaniami), modele własne, na końcu niewycenione z logów. */
export function buildPricingRows(
  defaults: PricingTable,
  overrides: PricingTable,
  unpricedModels: readonly string[] = [],
): PricingRow[] {
  const rows: PricingRow[] = Object.entries(defaults).map(([model, defaultPricing]) => ({
    model,
    pricing: overrides[model] ?? defaultPricing,
    defaultPricing,
  }));
  for (const [model, pricing] of Object.entries(overrides)) {
    if (!(model in defaults)) {
      rows.push({ model, pricing });
    }
  }
  for (const model of unpricedModels) {
    if (!(model in defaults) && !(model in overrides)) {
      rows.push({ model, pricing: null });
    }
  }
  return rows;
}

export type EditedOverridesResult =
  | { ok: true; overrides: PricingTable }
  | { ok: false; error: string };

/**
 * Wiersze odesłane przez edytor (niezaufane) → nadpisania do zapisu: nowe modele
 * i te, których cena różni się od domyślnej.
 */
export function overridesFromEditedRows(rows: unknown, defaults: PricingTable): EditedOverridesResult {
  if (!Array.isArray(rows)) {
    return { ok: false, error: "Niepoprawne dane z edytora." };
  }
  const overrides: PricingTable = {};
  const seen = new Set<string>();
  for (const row of rows) {
    const model = isPlainObject(row) && typeof row.model === "string" ? row.model.trim() : "";
    if (model === "") {
      return { ok: false, error: "Każdy model musi mieć nazwę." };
    }
    if (seen.has(model)) {
      return { ok: false, error: `Model „${model}” występuje więcej niż raz.` };
    }
    seen.add(model);
    const pricing = isPlainObject(row) ? row.pricing : undefined;
    if (!isModelPricing(pricing)) {
      return { ok: false, error: `Ceny modelu „${model}” muszą być liczbami ≥ 0.` };
    }
    const entry = pickPrices(pricing);
    const defaultPricing = defaults[model];
    if (!defaultPricing || PRICE_FIELDS.some((field) => defaultPricing[field] !== entry[field])) {
      overrides[model] = entry;
    }
  }
  return { ok: true, overrides };
}

function pickPrices(pricing: ModelPricing): ModelPricing {
  return {
    inputPer1M: pricing.inputPer1M,
    outputPer1M: pricing.outputPer1M,
    cacheReadPer1M: pricing.cacheReadPer1M,
    cacheWritePer1M: pricing.cacheWritePer1M,
  };
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
