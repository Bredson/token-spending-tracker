package dev.bredson.tokentracker.engine.claudecode

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

class ParseLineTest {
    @Test
    fun `returns null for non-JSON lines`() {
        assertNull(parseLine("not json"))
    }

    @Test
    fun `returns null for blank lines`() {
        assertNull(parseLine("   "))
    }

    @Test
    fun `skips irrelevant entry types (attachment, queue-operation, mode, last-prompt)`() {
        val skipped = Fixtures.sampleSessionLines.count { parseLine(it) == null }
        assertEquals(4, skipped)
    }

    @Test
    fun `marks the human message entries with isHumanMessage`() {
        val human = Fixtures.sampleSessionParsed.filter { it.isHumanMessage }
        assertEquals(listOf("u1", "u3"), human.map { it.uuid })
    }

    @Test
    fun `does not mark tool_result user entries as human messages`() {
        val toolResult = Fixtures.sampleSessionParsed.first { it.uuid == "u2" }
        assertFalse(toolResult.isHumanMessage)
    }

    @Test
    fun `extracts model and token usage from assistant entries`() {
        val entry = Fixtures.sampleSessionParsed.first { it.uuid == "a2" }
        assertEquals(EntryType.ASSISTANT, entry.type)
        assertEquals("claude-sonnet-5", entry.model)
        assertEquals(
            ParsedUsage(inputTokens = 1000, outputTokens = 200, cacheCreationInputTokens = 500, cacheReadInputTokens = 0),
            entry.usage,
        )
    }

    @Test
    fun `does not attach usage or model to non-assistant entries`() {
        val user = Fixtures.sampleSessionParsed.first { it.uuid == "u1" }
        assertNull(user.usage)
        assertNull(user.model)
    }

    @Test
    fun `returns null when a grouping field is missing`() {
        assertNull(parseLine("""{"type":"user","sessionId":"s","uuid":"u","cwd":"/p"}"""))
        assertNull(parseLine("""{"type":"user","sessionId":"s","timestamp":"t","cwd":"/p"}"""))
    }

    @Test
    fun `ignores assistant usage when any token field is missing`() {
        val entry = parseLine(
            """{"type":"assistant","sessionId":"s","uuid":"a","timestamp":"t","cwd":"/p",
               "message":{"model":"claude-sonnet-5","usage":{"input_tokens":1,"output_tokens":2}}}""".trimIndent(),
        )
        assertEquals(EntryType.ASSISTANT, entry?.type)
        assertNull(entry?.usage)
        assertNull(entry?.model)
    }
}
