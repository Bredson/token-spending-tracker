import {
  aggregateBySession,
  aggregateByTask,
  periodKey,
  sumTotals,
  type UsageRecord,
  type UsageTotals,
} from "@token-tracker/engine";

/** Rozbicie tokenów jest już zawarte w `UsageTotals` (input/output/cache-read/cache-write). */
export interface TaskSummary {
  taskId: string;
  model: string;
  lastActivity: string;
  totals: UsageTotals;
}

export interface SessionSummary {
  sessionId: string;
  projectPath: string;
  lastActivity: string;
  totals: UsageTotals;
  tasks: TaskSummary[];
}

export interface DailyCostPoint {
  date: string;
  costUsd: number;
}

export interface DashboardOverview {
  today: UsageTotals;
  week: UsageTotals;
  month: UsageTotals;
  dailyCostSeries: DailyCostPoint[];
}

export interface DashboardData {
  generatedAt: string;
  overview: DashboardOverview;
  sessions: SessionSummary[];
}

const DAILY_SERIES_LENGTH = 30;

/**
 * Buduje pełen, gotowy do wyrenderowania widok dashboardu z płaskiej listy rekordów.
 * Webview nie wykonuje żadnej agregacji (spec.md 6.3) — cała ciężka praca dzieje się tutaj.
 */
export function buildDashboardData(records: UsageRecord[], now: Date = new Date()): DashboardData {
  const todayKey = periodKey(now.toISOString(), "day");
  const weekKey = periodKey(now.toISOString(), "week");
  const monthKey = periodKey(now.toISOString(), "month");

  const todayRecords = records.filter((r) => periodKey(r.timestamp, "day") === todayKey);
  const weekRecords = records.filter((r) => periodKey(r.timestamp, "week") === weekKey);
  const monthRecords = records.filter((r) => periodKey(r.timestamp, "month") === monthKey);

  return {
    generatedAt: now.toISOString(),
    overview: {
      today: sumTotals(todayRecords),
      week: sumTotals(weekRecords),
      month: sumTotals(monthRecords),
      dailyCostSeries: buildDailyCostSeries(records, now),
    },
    sessions: buildSessionSummaries(records),
  };
}

function buildDailyCostSeries(records: UsageRecord[], now: Date): DailyCostPoint[] {
  const totalsByDay = new Map<string, number>();
  for (const record of records) {
    const key = periodKey(record.timestamp, "day");
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + record.costUsd);
  }

  const series: DailyCostPoint[] = [];
  for (let offset = DAILY_SERIES_LENGTH - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - offset);
    const key = periodKey(date.toISOString(), "day");
    series.push({ date: key, costUsd: totalsByDay.get(key) ?? 0 });
  }
  return series;
}

function buildSessionSummaries(records: UsageRecord[]): SessionSummary[] {
  const sessionGroups = aggregateBySession(records);
  const recordsBySession = new Map<string, UsageRecord[]>();
  for (const record of records) {
    const list = recordsBySession.get(record.sessionId);
    if (list) {
      list.push(record);
    } else {
      recordsBySession.set(record.sessionId, [record]);
    }
  }

  const summaries = sessionGroups.map((group): SessionSummary => {
    const sessionRecords = recordsBySession.get(group.key) ?? [];
    const lastActivity = latestTimestamp(sessionRecords);
    return {
      sessionId: group.key,
      projectPath: sessionRecords[0]?.projectPath ?? "",
      lastActivity,
      totals: group.totals,
      tasks: buildTaskSummaries(sessionRecords),
    };
  });

  summaries.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return summaries;
}

function buildTaskSummaries(sessionRecords: UsageRecord[]): TaskSummary[] {
  const taskGroups = aggregateByTask(sessionRecords);
  const recordsByTask = new Map<string, UsageRecord[]>();
  for (const record of sessionRecords) {
    const list = recordsByTask.get(record.taskId);
    if (list) {
      list.push(record);
    } else {
      recordsByTask.set(record.taskId, [record]);
    }
  }

  const summaries = taskGroups.map((group): TaskSummary => {
    const taskRecords = recordsByTask.get(group.key) ?? [];
    return {
      taskId: group.key,
      model: taskRecords[taskRecords.length - 1]?.model ?? "",
      lastActivity: latestTimestamp(taskRecords),
      totals: group.totals,
    };
  });

  summaries.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  return summaries;
}

function latestTimestamp(records: UsageRecord[]): string {
  return records.reduce(
    (latest, record) => (record.timestamp > latest ? record.timestamp : latest),
    records[0]?.timestamp ?? "",
  );
}
