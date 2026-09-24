package dev.bredson.tokentracker.engine

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Odpowiednik `dataProvider.ts` — gotowy widok dla współdzielonego HTML dashboardu. */
@Serializable
data class SerializableTotals(
    val tokensInput: Long,
    val tokensOutput: Long,
    val tokensCacheRead: Long,
    val tokensCacheWrite: Long,
    val costUsd: Double,
    val recordCount: Int,
)

@Serializable
data class ModelBreakdown(val model: String, val totals: SerializableTotals)

@Serializable
data class TaskSummary(
    val taskId: String,
    val lastActivity: String,
    val totals: SerializableTotals,
    val byModel: List<ModelBreakdown>,
)

@Serializable
data class SessionSummary(
    val sessionId: String,
    val title: String? = null,
    val projectPath: String,
    val lastActivity: String,
    val totals: SerializableTotals,
    val byModel: List<ModelBreakdown>,
    val tasks: List<TaskSummary>,
)

@Serializable
data class DailyCostPoint(val date: String, val costUsd: Double)

@Serializable
data class DashboardOverview(
    val today: SerializableTotals,
    val week: SerializableTotals,
    val month: SerializableTotals,
    val dailyCostSeries: List<DailyCostPoint>,
)

@Serializable
data class DashboardData(
    val generatedAt: String,
    val overview: DashboardOverview,
    val sessions: List<SessionSummary>,
    val unknownModels: List<String>,
) {
    fun toJson(): String = dashboardJson.encodeToString(serializer(), this)
}

private val dashboardJson = Json { encodeDefaults = true; explicitNulls = false }
private const val DAILY_SERIES_LENGTH = 30
private val ISO_MILLIS: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

private fun UsageTotals.serializable() =
    SerializableTotals(tokensInput, tokensOutput, tokensCacheRead, tokensCacheWrite, costUsd, recordCount)

fun buildDashboardData(
    records: List<UsageRecord>,
    now: Instant = Instant.now(),
    sessionTitles: Map<String, String> = emptyMap(),
    unknownModels: List<String> = emptyList(),
): DashboardData {
    val nowIso = ISO_MILLIS.format(now)
    fun inPeriod(granularity: PeriodGranularity) =
        records.filter { periodKey(it.timestamp, granularity) == periodKey(nowIso, granularity) }

    return DashboardData(
        generatedAt = nowIso,
        overview = DashboardOverview(
            today = sumTotals(inPeriod(PeriodGranularity.DAY)).serializable(),
            week = sumTotals(inPeriod(PeriodGranularity.WEEK)).serializable(),
            month = sumTotals(inPeriod(PeriodGranularity.MONTH)).serializable(),
            dailyCostSeries = dailyCostSeries(records, now),
        ),
        sessions = sessionSummaries(records, sessionTitles),
        unknownModels = unknownModels,
    )
}

private fun dailyCostSeries(records: List<UsageRecord>, now: Instant): List<DailyCostPoint> {
    val costByDay = HashMap<String, Double>()
    for (record in records) {
        val key = periodKey(record.timestamp, PeriodGranularity.DAY)
        costByDay[key] = (costByDay[key] ?: 0.0) + record.costUsd
    }
    val today: LocalDate = now.atOffset(ZoneOffset.UTC).toLocalDate()
    return (DAILY_SERIES_LENGTH - 1 downTo 0).map { offset ->
        val key = today.minusDays(offset.toLong()).toString()
        DailyCostPoint(key, costByDay[key] ?: 0.0)
    }
}

private fun modelBreakdown(records: List<UsageRecord>): List<ModelBreakdown> =
    aggregateByModel(records)
        .map { ModelBreakdown(it.key, it.totals.serializable()) }
        .sortedByDescending { it.totals.costUsd }

private fun latestTimestamp(records: List<UsageRecord>): String = records.maxOfOrNull { it.timestamp } ?: ""

private fun sessionSummaries(records: List<UsageRecord>, titles: Map<String, String>): List<SessionSummary> {
    val bySession = records.groupBy { it.sessionId }
    return aggregateBySession(records).map { group ->
        val sessionRecords = bySession.getValue(group.key)
        SessionSummary(
            sessionId = group.key,
            title = titles[group.key],
            projectPath = sessionRecords.first().projectPath,
            lastActivity = latestTimestamp(sessionRecords),
            totals = group.totals.serializable(),
            byModel = modelBreakdown(sessionRecords),
            tasks = taskSummaries(sessionRecords),
        )
    }.sortedByDescending { it.lastActivity }
}

private fun taskSummaries(sessionRecords: List<UsageRecord>): List<TaskSummary> {
    val byTask = sessionRecords.groupBy { it.taskId }
    return aggregateByTask(sessionRecords).map { group ->
        val taskRecords = byTask.getValue(group.key)
        TaskSummary(
            taskId = group.key,
            lastActivity = latestTimestamp(taskRecords),
            totals = group.totals.serializable(),
            byModel = modelBreakdown(taskRecords),
        )
    }.sortedByDescending { it.lastActivity }
}
