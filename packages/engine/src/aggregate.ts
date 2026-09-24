import type { UsageRecord } from "./types";

/**
 * Sumaryczne pola tokenowe + koszt dla grupy rekordów — spec.md sekcja 3.2/5.
 */
export interface UsageTotals {
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  costUsd: number;
  recordCount: number;
}

export interface AggregatedGroup<K extends string> {
  key: K;
  totals: UsageTotals;
}

function emptyTotals(): UsageTotals {
  return {
    tokensInput: 0,
    tokensOutput: 0,
    tokensCacheRead: 0,
    tokensCacheWrite: 0,
    costUsd: 0,
    recordCount: 0,
  };
}

function addRecordToTotals(totals: UsageTotals, record: UsageRecord): void {
  totals.tokensInput += record.tokensInput;
  totals.tokensOutput += record.tokensOutput;
  totals.tokensCacheRead += record.tokensCacheRead;
  totals.tokensCacheWrite += record.tokensCacheWrite;
  totals.costUsd += record.costUsd;
  totals.recordCount += 1;
}

/** Sumuje pola tokenowe + koszt po wszystkich rekordach, bez grupowania. */
export function sumTotals(records: UsageRecord[]): UsageTotals {
  const totals = emptyTotals();
  for (const record of records) {
    addRecordToTotals(totals, record);
  }
  return totals;
}

function groupBy(
  records: UsageRecord[],
  keyOf: (record: UsageRecord) => string,
): AggregatedGroup<string>[] {
  const totalsByKey = new Map<string, UsageTotals>();

  for (const record of records) {
    const key = keyOf(record);
    let totals = totalsByKey.get(key);
    if (totals === undefined) {
      totals = emptyTotals();
      totalsByKey.set(key, totals);
    }
    addRecordToTotals(totals, record);
  }

  return Array.from(totalsByKey.entries()).map(([key, totals]) => ({ key, totals }));
}

/** Agreguje rekordy per `taskId` — spec.md sekcja 3.2/5. */
export function aggregateByTask(records: UsageRecord[]): AggregatedGroup<string>[] {
  return groupBy(records, (record) => record.taskId);
}

/** Agreguje rekordy per `sessionId` — spec.md sekcja 3.2/5. */
export function aggregateBySession(records: UsageRecord[]): AggregatedGroup<string>[] {
  return groupBy(records, (record) => record.sessionId);
}

/** Agreguje rekordy per `model` — rozbicie kosztu zadania/sesji, gdy mieszają się modele. */
export function aggregateByModel(records: UsageRecord[]): AggregatedGroup<string>[] {
  return groupBy(records, (record) => record.model);
}

/** Agreguje rekordy per `projectPath` — spec.md sekcja 3.2/5. */
export function aggregateByProject(records: UsageRecord[]): AggregatedGroup<string>[] {
  return groupBy(records, (record) => record.projectPath);
}

export type PeriodGranularity = "day" | "week" | "month";

/**
 * Klucz przedziału czasowego dla danego znacznika czasu (ISO 8601, UTC).
 * - "day": `YYYY-MM-DD`
 * - "week": `YYYY-Www` (numer tygodnia ISO 8601, tydzień zaczyna się w poniedziałek)
 * - "month": `YYYY-MM`
 */
export function periodKey(timestamp: string, granularity: PeriodGranularity): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if (granularity === "day") {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (granularity === "month") {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  // ISO 8601 week: Thursday of the same week determines the week-year;
  // week 1 is the week containing the year's first Thursday.
  const thursday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (thursday.getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  thursday.setUTCDate(thursday.getUTCDate() - dayNumber + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNumber + 3);
  const weekNumber =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
}

/** Agreguje rekordy per przedział czasowy (dzień/tydzień/miesiąc) — spec.md sekcja 3.2/5. */
export function aggregateByPeriod(
  records: UsageRecord[],
  granularity: PeriodGranularity,
): AggregatedGroup<string>[] {
  return groupBy(records, (record) => periodKey(record.timestamp, granularity));
}
