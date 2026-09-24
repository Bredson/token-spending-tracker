package dev.bredson.tokentracker.engine

import java.time.Instant
import java.time.ZoneOffset
import java.time.temporal.IsoFields

data class UsageTotals(
    val tokensInput: Long,
    val tokensOutput: Long,
    val tokensCacheRead: Long,
    val tokensCacheWrite: Long,
    val costUsd: Double,
    val recordCount: Int,
) {
    operator fun plus(record: UsageRecord) = UsageTotals(
        tokensInput + record.tokensInput,
        tokensOutput + record.tokensOutput,
        tokensCacheRead + record.tokensCacheRead,
        tokensCacheWrite + record.tokensCacheWrite,
        costUsd + record.costUsd,
        recordCount + 1,
    )

    companion object {
        val ZERO = UsageTotals(0, 0, 0, 0, 0.0, 0)
    }
}

data class AggregatedGroup(val key: String, val totals: UsageTotals)

enum class PeriodGranularity { DAY, WEEK, MONTH }

fun sumTotals(records: List<UsageRecord>): UsageTotals =
    records.fold(UsageTotals.ZERO) { acc, record -> acc + record }

private fun groupBy(records: List<UsageRecord>, keyOf: (UsageRecord) -> String): List<AggregatedGroup> {
    val totalsByKey = LinkedHashMap<String, UsageTotals>()
    for (record in records) {
        val key = keyOf(record)
        totalsByKey[key] = (totalsByKey[key] ?: UsageTotals.ZERO) + record
    }
    return totalsByKey.map { (key, totals) -> AggregatedGroup(key, totals) }
}

fun aggregateByTask(records: List<UsageRecord>) = groupBy(records) { it.taskId }
fun aggregateBySession(records: List<UsageRecord>) = groupBy(records) { it.sessionId }
fun aggregateByProject(records: List<UsageRecord>) = groupBy(records) { it.projectPath }
fun aggregateByModel(records: List<UsageRecord>) = groupBy(records) { it.model }

fun aggregateByPeriod(records: List<UsageRecord>, granularity: PeriodGranularity) =
    groupBy(records) { periodKey(it.timestamp, granularity) }

/** Klucz okresu w UTC: `YYYY-MM-DD`, `YYYY-Www` (tydzień ISO 8601) lub `YYYY-MM`. */
fun periodKey(timestamp: String, granularity: PeriodGranularity): String {
    val date = Instant.parse(timestamp).atOffset(ZoneOffset.UTC).toLocalDate()
    return when (granularity) {
        PeriodGranularity.DAY -> "%04d-%02d-%02d".format(date.year, date.monthValue, date.dayOfMonth)
        PeriodGranularity.MONTH -> "%04d-%02d".format(date.year, date.monthValue)
        PeriodGranularity.WEEK -> "%04d-W%02d".format(
            date.get(IsoFields.WEEK_BASED_YEAR),
            date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR),
        )
    }
}
