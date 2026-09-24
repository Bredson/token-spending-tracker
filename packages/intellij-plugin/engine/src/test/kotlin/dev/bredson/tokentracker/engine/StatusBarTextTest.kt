package dev.bredson.tokentracker.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class StatusBarTextTest {
    @Test
    fun `formats zero records`() {
        assertEquals("$ 0.00 · 0 tok", formatStatusBarText(emptyList()))
    }

    @Test
    fun `sums cost and every token kind`() {
        val text = formatStatusBarText(
            listOf(
                record(costUsd = 0.1, tokensInput = 100, tokensOutput = 50),
                record(costUsd = 0.32, tokensInput = 0, tokensOutput = 0, tokensCacheRead = 200, tokensCacheWrite = 50),
            ),
        )
        assertEquals("$ 0.42 · 400 tok", text)
    }

    @Test
    fun `abbreviates thousands as Nk`() {
        assertEquals("$ 0.42 · 12.3k tok", formatStatusBarText(listOf(record(costUsd = 0.42, tokensInput = 12300, tokensOutput = 0))))
    }

    @Test
    fun `tooltip without records says there is no session`() {
        val tooltip = formatStatusBarTooltip(emptyList(), emptyMap())
        assertTrue("Token Tracker" in tooltip)
        assertTrue("brak sesji" in tooltip)
    }

    @Test
    fun `tooltip names the most recently active session by title with id, and lists models once`() {
        val tooltip = formatStatusBarTooltip(
            listOf(
                record(id = "r1", sessionId = "old-1", timestamp = "2026-01-01T08:00:00.000Z", model = "claude-sonnet-5"),
                record(id = "r2", sessionId = "new-2", timestamp = "2026-01-01T09:00:00.000Z", model = "claude-haiku-4-5"),
                record(id = "r3", sessionId = "new-2", timestamp = "2026-01-01T08:30:00.000Z", model = "claude-sonnet-5"),
            ),
            mapOf("new-2" to "Naprawa cennika"),
        )
        assertTrue("Naprawa cennika (new-2)" in tooltip)
        assertFalse("old-1" in tooltip)
        assertTrue("claude-haiku-4-5, claude-sonnet-5" in tooltip)
    }

    @Test
    fun `tooltip falls back to the session id without a title`() {
        assertTrue("sess-x" in formatStatusBarTooltip(listOf(record(sessionId = "sess-x")), emptyMap()))
    }
}
