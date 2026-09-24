package dev.bredson.tokentracker.engine

import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DashboardDataTest {
    private val now = Instant.parse("2026-03-10T18:00:00.000Z")

    @Test
    fun `computes today, week and month totals relative to now`() {
        val data = buildDashboardData(
            listOf(
                record(id = "r1", timestamp = "2026-03-10T08:00:00.000Z", costUsd = 1.0),
                record(id = "r2", timestamp = "2026-02-01T08:00:00.000Z", costUsd = 5.0),
            ),
            now,
        )
        assertEquals(1.0, data.overview.today.costUsd, 1e-9)
        assertEquals(1, data.overview.today.recordCount)
        assertEquals(1.0, data.overview.month.costUsd, 1e-9)
    }

    @Test
    fun `builds a 30-point daily series ending at now, filling gaps with zero`() {
        val data = buildDashboardData(listOf(record(timestamp = "2026-03-10T08:00:00.000Z", costUsd = 2.0)), now)
        assertEquals(30, data.overview.dailyCostSeries.size)
        assertEquals(DailyCostPoint("2026-03-10", 2.0), data.overview.dailyCostSeries.last())
        assertEquals(DailyCostPoint("2026-02-09", 0.0), data.overview.dailyCostSeries.first())
    }

    @Test
    fun `groups sessions and nested tasks with totals, most recent first`() {
        val data = buildDashboardData(
            listOf(
                record(id = "r1", sessionId = "s1", taskId = "t1", timestamp = "2026-03-10T08:00:00.000Z", costUsd = 1.0),
                record(id = "r2", sessionId = "s1", taskId = "t2", timestamp = "2026-03-10T09:00:00.000Z", costUsd = 2.0),
                record(id = "r3", sessionId = "s2", taskId = "t3", timestamp = "2026-03-10T10:00:00.000Z", costUsd = 3.0),
            ),
            now,
        )
        assertEquals(listOf("s2", "s1"), data.sessions.map { it.sessionId })
        val s1 = data.sessions.first { it.sessionId == "s1" }
        assertEquals(3.0, s1.totals.costUsd, 1e-9)
        assertEquals(listOf("t2", "t1"), s1.tasks.map { it.taskId })
        assertEquals(1.0, s1.tasks.first { it.taskId == "t1" }.totals.costUsd, 1e-9)
        assertEquals("2026-03-10T09:00:00.000Z", s1.lastActivity)
    }

    @Test
    fun `attaches session titles when known`() {
        val data = buildDashboardData(
            listOf(record(id = "r1", sessionId = "s1"), record(id = "r2", sessionId = "s2")),
            now,
            sessionTitles = mapOf("s1" to "Rozpoznawalny tytuł"),
        )
        assertEquals("Rozpoznawalny tytuł", data.sessions.first { it.sessionId == "s1" }.title)
        assertNull(data.sessions.first { it.sessionId == "s2" }.title)
    }

    @Test
    fun `breaks sessions and tasks down per model, most expensive first`() {
        val data = buildDashboardData(
            listOf(
                record(id = "r1", sessionId = "s1", taskId = "t1", model = "claude-haiku-4-5", costUsd = 0.1),
                record(id = "r2", sessionId = "s1", taskId = "t1", model = "claude-sonnet-5", costUsd = 2.0),
                record(id = "r3", sessionId = "s1", taskId = "t2", model = "claude-sonnet-5", costUsd = 1.0),
            ),
            now,
        )
        val s1 = data.sessions.single()
        assertEquals(listOf("claude-sonnet-5", "claude-haiku-4-5"), s1.byModel.map { it.model })
        assertEquals(3.0, s1.byModel[0].totals.costUsd, 1e-9)
        assertEquals(listOf("claude-sonnet-5", "claude-haiku-4-5"), s1.tasks.first { it.taskId == "t1" }.byModel.map { it.model })
        assertEquals(1, s1.tasks.first { it.taskId == "t2" }.byModel.size)
    }

    @Test
    fun `passes unknown models through and is empty for no records`() {
        val empty = buildDashboardData(emptyList(), now)
        assertTrue(empty.sessions.isEmpty())
        assertEquals(0, empty.overview.today.recordCount)
        assertEquals(emptyList(), empty.unknownModels)
        assertEquals(listOf("mystery"), buildDashboardData(emptyList(), now, unknownModels = listOf("mystery")).unknownModels)
    }

    @Test
    fun `serializes to the JSON shape the shared dashboard HTML expects`() {
        val json = buildDashboardData(
            listOf(record(id = "r1", sessionId = "s1", taskId = "t1", projectPath = "/p")),
            now,
            sessionTitles = mapOf("s1" to "T"),
            unknownModels = listOf("x"),
        ).toJson()
        for (key in listOf(
            "\"generatedAt\"", "\"overview\"", "\"today\"", "\"week\"", "\"month\"", "\"dailyCostSeries\"",
            "\"sessions\"", "\"sessionId\"", "\"title\":\"T\"", "\"projectPath\":\"/p\"", "\"lastActivity\"",
            "\"totals\"", "\"tokensInput\"", "\"tokensCacheWrite\"", "\"costUsd\"", "\"recordCount\"",
            "\"byModel\"", "\"model\"", "\"tasks\"", "\"taskId\"", "\"unknownModels\":[\"x\"]",
        )) {
            assertTrue(key in json, "missing $key in $json")
        }
    }
}
