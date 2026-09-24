package dev.bredson.tokentracker.engine

import kotlin.test.Test
import kotlin.test.assertEquals

class AggregateTest {
    @Test
    fun `sumTotals sums all records ignoring grouping keys`() {
        val totals = sumTotals(
            listOf(
                record(id = "r1", tokensInput = 100, costUsd = 1.0),
                record(id = "r2", tokensInput = 200, costUsd = 2.0, taskId = "task-2"),
            ),
        )
        assertEquals(UsageTotals(300, 100, 0, 0, 3.0, 2), totals)
    }

    @Test
    fun `sumTotals of nothing is all zeros`() {
        assertEquals(UsageTotals(0, 0, 0, 0, 0.0, 0), sumTotals(emptyList()))
    }

    @Test
    fun `aggregateByTask sums tokens and cost across records sharing a taskId`() {
        val byKey = aggregateByTask(
            listOf(
                record(id = "r1", taskId = "task-1", tokensInput = 100, costUsd = 1.0),
                record(id = "r2", taskId = "task-1", tokensInput = 200, costUsd = 2.0),
                record(id = "r3", taskId = "task-2", tokensInput = 50, costUsd = 0.5),
            ),
        ).associate { it.key to it.totals }

        assertEquals(300, byKey.getValue("task-1").tokensInput)
        assertEquals(3.0, byKey.getValue("task-1").costUsd, 1e-9)
        assertEquals(2, byKey.getValue("task-1").recordCount)
        assertEquals(1, byKey.getValue("task-2").recordCount)
    }

    @Test
    fun `aggregateByTask of nothing is empty`() {
        assertEquals(emptyList(), aggregateByTask(emptyList()))
    }

    @Test
    fun `aggregateBySession groups by sessionId`() {
        val keys = aggregateBySession(listOf(record(id = "r1", sessionId = "s1"), record(id = "r2", sessionId = "s2")))
            .map { it.key }.sorted()
        assertEquals(listOf("s1", "s2"), keys)
    }

    @Test
    fun `aggregateByProject groups by projectPath`() {
        val byKey = aggregateByProject(
            listOf(
                record(id = "r1", projectPath = "/tmp/project-a"),
                record(id = "r2", projectPath = "/tmp/project-b"),
                record(id = "r3", projectPath = "/tmp/project-a"),
            ),
        ).associate { it.key to it.totals }
        assertEquals(2, byKey.getValue("/tmp/project-a").recordCount)
        assertEquals(1, byKey.getValue("/tmp/project-b").recordCount)
    }

    @Test
    fun `aggregateByModel groups per model id`() {
        val groups = aggregateByModel(
            listOf(
                record(id = "r1", model = "claude-sonnet-5", costUsd = 1.0, tokensInput = 100),
                record(id = "r2", model = "claude-haiku-4-5", costUsd = 0.1, tokensInput = 10),
                record(id = "r3", model = "claude-sonnet-5", costUsd = 2.0, tokensInput = 200),
            ),
        )
        assertEquals(listOf("claude-haiku-4-5", "claude-sonnet-5"), groups.map { it.key }.sorted())
        val sonnet = groups.first { it.key == "claude-sonnet-5" }.totals
        assertEquals(3.0, sonnet.costUsd, 1e-9)
        assertEquals(300, sonnet.tokensInput)
        assertEquals(2, sonnet.recordCount)
    }

    @Test
    fun `periodKey formats a day key as YYYY-MM-DD in UTC`() {
        assertEquals("2026-03-10", periodKey("2026-03-10T23:59:59.000Z", PeriodGranularity.DAY))
    }

    @Test
    fun `periodKey formats a month key as YYYY-MM`() {
        assertEquals("2026-03", periodKey("2026-03-10T00:00:00.000Z", PeriodGranularity.MONTH))
    }

    @Test
    fun `periodKey formats an ISO week key including the first week of the year`() {
        assertEquals("2026-W01", periodKey("2026-01-01T00:00:00.000Z", PeriodGranularity.WEEK))
    }

    @Test
    fun `periodKey attributes late December to week 1 of the next ISO year when applicable`() {
        assertEquals("2026-W01", periodKey("2025-12-29T00:00:00.000Z", PeriodGranularity.WEEK))
    }

    @Test
    fun `aggregateByPeriod groups records into day buckets`() {
        val byKey = aggregateByPeriod(
            listOf(
                record(id = "r1", timestamp = "2026-03-10T08:00:00.000Z", costUsd = 1.0),
                record(id = "r2", timestamp = "2026-03-10T20:00:00.000Z", costUsd = 2.0),
                record(id = "r3", timestamp = "2026-03-11T08:00:00.000Z", costUsd = 3.0),
            ),
            PeriodGranularity.DAY,
        ).associate { it.key to it.totals }
        assertEquals(3.0, byKey.getValue("2026-03-10").costUsd, 1e-9)
        assertEquals(3.0, byKey.getValue("2026-03-11").costUsd, 1e-9)
    }
}
