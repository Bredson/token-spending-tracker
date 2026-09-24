package dev.bredson.tokentracker.engine.claudecode

import kotlin.test.Test
import kotlin.test.assertEquals

class TaskGrouperTest {
    private fun fixtureTaskIds(): Map<String, String> {
        val grouper = TaskGrouper()
        return Fixtures.sampleSessionParsed.associate { it.uuid to grouper.assignTaskId(it) }
    }

    @Test
    fun `groups the human message and its tool_result and assistant continuations into one task`() {
        val ids = fixtureTaskIds()
        assertEquals("u1", ids["u1"])
        assertEquals("u1", ids["a2"])
        assertEquals("u1", ids["u2"])
        assertEquals("u1", ids["a3"])
    }

    @Test
    fun `starts a new task at the next human message, ignoring promptId changes`() {
        val ids = fixtureTaskIds()
        for (uuid in listOf("u3", "a4", "a5", "u4", "a6")) {
            assertEquals("u3", ids[uuid], "uuid $uuid")
        }
    }

    @Test
    fun `attributes subagent (sidechain) usage to the parent task`() {
        val ids = fixtureTaskIds()
        assertEquals(ids["a4"], ids["a5"])
    }

    @Test
    fun `falls back to a placeholder task when no human message has been seen yet`() {
        val orphan = checkNotNull(
            parseLine(
                """{"type":"assistant","sessionId":"orphan-session","uuid":"orphan-1","timestamp":"t","cwd":"/p",
                   "message":{"model":"claude-sonnet-5","usage":{"input_tokens":10,"output_tokens":5,
                   "cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}""",
            ),
        )
        assertEquals("orphan-session:pre", TaskGrouper().assignTaskId(orphan))
    }

    @Test
    fun `keeps grouping state independent per session`() {
        val grouper = TaskGrouper()
        val humanA = checkNotNull(parseLine("""{"type":"user","sessionId":"session-a","uuid":"a-human","timestamp":"t","cwd":"/p","origin":{"kind":"human"}}"""))
        val humanB = checkNotNull(parseLine("""{"type":"user","sessionId":"session-b","uuid":"b-human","timestamp":"t","cwd":"/p","origin":{"kind":"human"}}"""))
        assertEquals("a-human", grouper.assignTaskId(humanA))
        assertEquals("b-human", grouper.assignTaskId(humanB))
    }
}
