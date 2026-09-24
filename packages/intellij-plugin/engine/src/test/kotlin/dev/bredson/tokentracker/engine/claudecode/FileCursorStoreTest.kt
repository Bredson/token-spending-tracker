package dev.bredson.tokentracker.engine.claudecode

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption.APPEND
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import org.junit.jupiter.api.io.TempDir

class FileCursorStoreTest {
    private fun Path.append(text: String) = Files.writeString(this, text, APPEND)

    @Test
    fun `returns all lines on first read of a new file`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("line1\nline2\n") }
        assertEquals(listOf("line1", "line2"), FileCursorStore().readNewLines(file))
    }

    @Test
    fun `returns nothing when the file has not changed`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("line1\n") }
        val store = FileCursorStore()
        store.readNewLines(file)
        assertEquals(emptyList(), store.readNewLines(file))
    }

    @Test
    fun `returns only newly appended lines`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("line1\nline2\n") }
        val store = FileCursorStore()
        assertEquals(listOf("line1", "line2"), store.readNewLines(file))
        file.append("line3\nline4\n")
        assertEquals(listOf("line3", "line4"), store.readNewLines(file))
    }

    @Test
    fun `withholds an incomplete trailing line until it is terminated`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("line1\n") }
        val store = FileCursorStore()
        store.readNewLines(file)
        file.append("partial-line-being-wri")
        assertEquals(emptyList(), store.readNewLines(file))
        file.append("tten\n")
        assertEquals(listOf("partial-line-being-written"), store.readNewLines(file))
    }

    @Test
    fun `re-reads from the start if the file was truncated`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("line1\nline2\nline3\n") }
        val store = FileCursorStore()
        store.readNewLines(file)
        file.writeText("new-line1\n")
        assertEquals(listOf("new-line1"), store.readNewLines(file))
    }

    @Test
    fun `returns nothing for a file that no longer exists`(@TempDir dir: Path) {
        assertEquals(emptyList(), FileCursorStore().readNewLines(dir.resolve("missing.jsonl")))
    }

    @Test
    fun `tracks cursors independently per file`(@TempDir dir: Path) {
        val a = dir.resolve("a.jsonl").apply { writeText("a\n") }
        val b = dir.resolve("b.jsonl").apply { writeText("b\n") }
        val store = FileCursorStore()
        assertEquals(listOf("a"), store.readNewLines(a))
        assertEquals(listOf("b"), store.readNewLines(b))
        assertEquals(emptyList(), store.readNewLines(a))
        b.append("c\n")
        assertEquals(listOf("c"), store.readNewLines(b))
        assertEquals(emptyList(), store.readNewLines(a))
    }

    @Test
    fun `handles multi-byte UTF-8 across the append boundary`(@TempDir dir: Path) {
        val file = dir.resolve("session.jsonl").apply { writeText("zażółć\n") }
        val store = FileCursorStore()
        assertEquals(listOf("zażółć"), store.readNewLines(file))
        file.append("gęślą jaźń\n")
        assertEquals(listOf("gęślą jaźń"), store.readNewLines(file))
    }
}
