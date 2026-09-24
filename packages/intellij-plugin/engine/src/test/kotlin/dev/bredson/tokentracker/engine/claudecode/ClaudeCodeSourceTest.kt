package dev.bredson.tokentracker.engine.claudecode

import dev.bredson.tokentracker.engine.UsageRecord
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption.APPEND
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Duration.Companion.milliseconds
import org.junit.jupiter.api.io.TempDir

class ClaudeCodeSourceTest {
    private fun human(uuid: String, sessionId: String) =
        """{"type":"user","sessionId":"$sessionId","uuid":"$uuid","timestamp":"2026-01-01T00:00:00.000Z","cwd":"/tmp/example-project","origin":{"kind":"human"}}"""

    private fun assistant(uuid: String, sessionId: String, model: String, input: Int, output: Int) =
        """{"type":"assistant","sessionId":"$sessionId","uuid":"$uuid","timestamp":"2026-01-01T00:00:01.000Z","cwd":"/tmp/example-project",
           "message":{"model":"$model","usage":{"input_tokens":$input,"output_tokens":$output,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}"""
            .replace("\n", "")

    private fun Path.append(text: String) = Files.writeString(this, text, APPEND)

    private fun <T> waitFor(timeoutMs: Long = 3000, block: () -> T?): T {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            block()?.let { return it }
            Thread.sleep(20)
        }
        error("condition not met within ${timeoutMs}ms")
    }

    @Test
    fun `detect is false when the projects dir is missing and true when present`(@TempDir dir: Path) {
        assertFalse(ClaudeCodeSource(projectsDir = dir.resolve("missing")).detect())
        assertTrue(ClaudeCodeSource(projectsDir = dir).detect())
    }

    @Test
    fun `loadAll parses nested session files into priced records grouped under their task`(@TempDir dir: Path) {
        val projectDir = dir.resolve("-Users-example-project").createDirectories()
        projectDir.resolve("session-1.jsonl").writeText(
            human("u1", "session-1") + "\n" + assistant("a1", "session-1", "claude-sonnet-5", 100, 50) + "\n",
        )
        val records = ClaudeCodeSource(projectsDir = dir).loadAll()
        assertEquals(1, records.size)
        val r = records.single()
        assertEquals("session-1", r.sessionId)
        assertEquals("u1", r.taskId)
        assertEquals("claude-sonnet-5", r.model)
        assertEquals(100, r.tokensInput)
        assertEquals(50, r.tokensOutput)
        assertEquals("/tmp/example-project", r.projectPath)
        assertEquals("session-1:a1", r.id)
        assertTrue(r.costUsd > 0)
    }

    @Test
    fun `loadAll is empty when the projects dir is missing`(@TempDir dir: Path) {
        assertEquals(emptyList(), ClaudeCodeSource(projectsDir = dir.resolve("missing")).loadAll())
    }

    @Test
    fun `unknown model costs zero, is reported once and listed by unknownModels`(@TempDir dir: Path) {
        dir.resolve("s.jsonl").writeText(
            listOf(
                human("u1", "s"),
                assistant("a1", "s", "zeta-model", 10, 5),
                assistant("a2", "s", "alpha-model", 10, 5),
                assistant("a3", "s", "zeta-model", 10, 5),
            ).joinToString("\n") + "\n",
        )
        val seen = mutableListOf<String>()
        val source = ClaudeCodeSource(projectsDir = dir, onUnknownModel = { seen.add(it) })
        val records = source.loadAll()
        assertEquals(3, records.size)
        assertTrue(records.all { it.costUsd == 0.0 })
        assertEquals(listOf("zeta-model", "alpha-model"), seen)
        assertEquals(listOf("alpha-model", "zeta-model"), source.unknownModels())
    }

    @Test
    fun `session titles prefer custom over ai and title lines never become records`(@TempDir dir: Path) {
        dir.resolve("s.jsonl").writeText(
            listOf(
                """{"type":"ai-title","sessionId":"s","aiTitle":"Automatyczny"}""",
                human("u1", "s"),
                """{"type":"custom-title","sessionId":"s","customTitle":"Ręczny"}""",
                """{"type":"ai-title","sessionId":"other","aiTitle":"Tylko AI"}""",
            ).joinToString("\n") + "\n",
        )
        val source = ClaudeCodeSource(projectsDir = dir)
        assertEquals(emptyList(), source.loadAll())
        assertEquals(mapOf("s" to "Ręczny", "other" to "Tylko AI"), source.sessionTitles())
        assertNull(source.sessionTitles()["nope"])
    }

    @Test
    fun `watch emits only newly appended records`(@TempDir dir: Path) {
        val file = dir.resolve("s.jsonl").apply {
            writeText(human("u1", "s") + "\n" + assistant("a1", "s", "claude-sonnet-5", 10, 5) + "\n")
        }
        val source = ClaudeCodeSource(projectsDir = dir, pollInterval = 50.milliseconds)
        source.loadAll()
        val received = CopyOnWriteArrayList<UsageRecord>()
        val watch = source.watch { received.addAll(it) }
        try {
            file.append(assistant("a2", "s", "claude-sonnet-5", 20, 10) + "\n")
            val r = waitFor { received.singleOrNull() }
            assertEquals("u1", r.taskId)
            assertEquals(20, r.tokensInput)
        } finally {
            watch.dispose()
        }
    }

    @Test
    fun `watch picks up a new session file created after start`(@TempDir dir: Path) {
        val source = ClaudeCodeSource(projectsDir = dir, pollInterval = 50.milliseconds)
        source.loadAll()
        val received = CopyOnWriteArrayList<UsageRecord>()
        val watch = source.watch { received.addAll(it) }
        try {
            dir.resolve("late").createDirectories().resolve("new.jsonl")
                .writeText(human("u1", "new") + "\n" + assistant("a1", "new", "claude-sonnet-5", 1, 1) + "\n")
            assertEquals("new", waitFor { received.singleOrNull() }.sessionId)
        } finally {
            watch.dispose()
        }
    }

    @Test
    fun `a custom-title appended while watching updates titles and signals with an empty batch`(@TempDir dir: Path) {
        val file = dir.resolve("s.jsonl").apply {
            writeText(human("u1", "s") + "\n" + """{"type":"ai-title","sessionId":"s","aiTitle":"Automatyczny"}""" + "\n")
        }
        val source = ClaudeCodeSource(projectsDir = dir, pollInterval = 50.milliseconds)
        source.loadAll()
        assertEquals("Automatyczny", source.sessionTitles()["s"])
        val batches = CopyOnWriteArrayList<List<UsageRecord>>()
        val watch = source.watch { batches.add(it) }
        try {
            file.append("""{"type":"custom-title","sessionId":"s","customTitle":"Ręczny"}""" + "\n")
            assertEquals(emptyList(), waitFor { batches.singleOrNull() })
            assertEquals("Ręczny", source.sessionTitles()["s"])
        } finally {
            watch.dispose()
        }
    }

    @Test
    fun `after dispose the watcher stops emitting`(@TempDir dir: Path) {
        val file = dir.resolve("s.jsonl").apply { writeText(human("u1", "s") + "\n") }
        val source = ClaudeCodeSource(projectsDir = dir, pollInterval = 50.milliseconds)
        source.loadAll()
        val received = CopyOnWriteArrayList<UsageRecord>()
        source.watch { received.addAll(it) }.dispose()
        file.append(assistant("a1", "s", "claude-sonnet-5", 1, 1) + "\n")
        Thread.sleep(300)
        assertTrue(received.isEmpty())
    }
}
