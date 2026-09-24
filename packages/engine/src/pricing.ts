import { readFileSync } from "node:fs";
import type { UsageRecord } from "./types";
import bundledPricingTable from "./pricing.json";

/**
 * Cennik — spec.md sekcja 3.3.
 * Ceny w USD za 1M tokenów, per model.
 */
export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  cacheReadPer1M: number;
  cacheWritePer1M: number;
}

export type PricingTable = Record<string, ModelPricing>;

// Ceny bazowe (input/output) wg oficjalnego cennika Anthropic (stan: wrzesień 2026).
// Ceny cache write/read wyliczone wg udokumentowanej reguły Anthropic dla cache
// o TTL 5 minut: cache write = 1.25x cena input, cache read = 0.1x cena input.
const defaultPricingTable = bundledPricingTable as PricingTable;

// Claude Code zapisuje ten pseudo-model dla komunikatów generowanych lokalnie
// (bez wywołania API) — zerowy koszt jest tu poprawny, nie "nieznany".
const SYNTHETIC_MODEL = "<synthetic>";

// Claude Code zapisuje samą nazwę rodziny, gdy użytkownik wybrał model aliasem
// (`/model sonnet`). Alias wskazuje aktualnie najnowszy model danej rodziny.
const MODEL_FAMILY_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
  haiku: "claude-haiku-4-5",
  fable: "claude-fable-5-1",
};

/**
 * Sprowadza ID modelu z logów do klucza tabeli cen: zdejmuje prefix dostawcy
 * `anthropic/` i sufiks okna kontekstu `[1m]` (oba dodawane przez bramki
 * API / `/model anthropic/...[1m]`), rozwiązuje aliasy rodzin. ID innych
 * dostawców (np. `openai/...`) zwraca bez zmian.
 */
export function normalizeModelId(model: string): string {
  let id = model;
  if (id.startsWith("anthropic/")) {
    id = id.slice("anthropic/".length);
  }
  if (id.endsWith("[1m]")) {
    id = id.slice(0, -"[1m]".length);
  }
  return MODEL_FAMILY_ALIASES[id] ?? id;
}

/**
 * Wylicza `costUsd` dla rekordu na podstawie tabeli cen i zwraca nową kopię
 * rekordu z ustawionym polem. Nigdy nie rzuca wyjątku: dla nieznanego modelu
 * zwraca `costUsd = 0` i (opcjonalnie) informuje przez `onUnknownModel`
 * (spec.md 3.3 — "nigdy nie przerywa działania").
 */
export function applyPricing(
  record: UsageRecord,
  table: PricingTable,
  onUnknownModel?: (model: string) => void,
): UsageRecord {
  if (record.model === SYNTHETIC_MODEL) {
    return { ...record, costUsd: 0 };
  }

  const pricing = table[record.model] ?? table[normalizeModelId(record.model)];
  if (!pricing) {
    onUnknownModel?.(record.model);
    return { ...record, costUsd: 0 };
  }

  const costUsd =
    (record.tokensInput / 1_000_000) * pricing.inputPer1M +
    (record.tokensOutput / 1_000_000) * pricing.outputPer1M +
    (record.tokensCacheRead / 1_000_000) * pricing.cacheReadPer1M +
    (record.tokensCacheWrite / 1_000_000) * pricing.cacheWritePer1M;

  return { ...record, costUsd };
}

/**
 * Wczytuje tabelę cen: domyślną wbudowaną, scaloną z opcjonalnym plikiem
 * użytkownika (nadpisanie per-model, patrz spec.md 3.3). Jeśli `customPath`
 * nie istnieje lub zawiera niepoprawny JSON, cicho pomija nadpisanie i zwraca
 * samą domyślną tabelę — nigdy nie rzuca wyjątku.
 */
export function loadPricingTable(customPath?: string): PricingTable {
  if (!customPath) {
    return { ...defaultPricingTable };
  }

  let custom: PricingTable;
  try {
    custom = JSON.parse(readFileSync(customPath, "utf-8")) as PricingTable;
  } catch {
    return { ...defaultPricingTable };
  }

  return { ...defaultPricingTable, ...custom };
}
