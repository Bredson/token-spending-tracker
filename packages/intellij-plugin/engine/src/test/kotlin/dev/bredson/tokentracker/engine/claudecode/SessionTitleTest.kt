package dev.bredson.tokentracker.engine.claudecode

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SessionTitleTest {
    @Test
    fun `parses an ai-title entry`() {
        assertEquals(
            ParsedSessionTitle("s1", TitleKind.AI, "Tytuł"),
            parseSessionTitleLine("""{"type":"ai-title","sessionId":"s1","aiTitle":"Tytuł"}"""),
        )
    }

    @Test
    fun `parses a custom-title entry`() {
        assertEquals(
            ParsedSessionTitle("s1", TitleKind.CUSTOM, "Mój tytuł"),
            parseSessionTitleLine("""{"type":"custom-title","sessionId":"s1","customTitle":"Mój tytuł"}"""),
        )
    }

    @Test
    fun `returns null for unrelated entry types`() {
        assertNull(parseSessionTitleLine("""{"type":"user","sessionId":"s1","uuid":"u1"}"""))
    }

    @Test
    fun `returns null for malformed JSON`() {
        assertNull(parseSessionTitleLine("not json"))
    }

    @Test
    fun `returns null when sessionId is missing`() {
        assertNull(parseSessionTitleLine("""{"type":"ai-title","aiTitle":"Tytuł"}"""))
    }

    @Test
    fun `returns null for an empty line`() {
        assertNull(parseSessionTitleLine("   "))
    }
}
