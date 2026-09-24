package dev.bredson.tokentracker.engine.claudecode

import java.io.RandomAccessFile
import java.nio.file.Files
import java.nio.file.NoSuchFileException
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes

/**
 * Odpowiednik `fileCursor.ts`: pamięta offset ostatniego przeczytanego bajtu wraz
 * z mtime/size, żeby nie otwierać niezmienionych plików i czytać tylko przyrost.
 * Niedokończona ostatnia linia (bez `\n`) czeka na kolejny odczyt.
 */
class FileCursorStore {
    private data class Cursor(val offset: Long, val mtimeNanos: Long, val size: Long)

    private val cursors = HashMap<Path, Cursor>()

    @Synchronized
    fun readNewLines(path: Path): List<String> {
        val attrs = try {
            Files.readAttributes(path, BasicFileAttributes::class.java)
        } catch (_: NoSuchFileException) {
            return emptyList()
        } catch (_: java.io.IOException) {
            return emptyList()
        }
        val mtime = attrs.lastModifiedTime().to(java.util.concurrent.TimeUnit.NANOSECONDS)
        val size = attrs.size()

        val previous = cursors[path]
        if (previous != null && previous.mtimeNanos == mtime && previous.size == size) {
            return emptyList()
        }

        val start = previous?.offset ?: 0L
        if (size < start) {
            cursors.remove(path)
            return readNewLines(path)
        }
        if (size == start) {
            cursors[path] = Cursor(start, mtime, size)
            return emptyList()
        }

        val bytes = ByteArray((size - start).toInt())
        RandomAccessFile(path.toFile(), "r").use { file ->
            file.seek(start)
            file.readFully(bytes)
        }

        val lastNewline = bytes.lastIndexOf('\n'.code.toByte())
        if (lastNewline == -1) {
            return emptyList()
        }

        cursors[path] = Cursor(start + lastNewline + 1, mtime, size)
        return String(bytes, 0, lastNewline, Charsets.UTF_8)
            .split('\n')
            .filter { it.isNotEmpty() }
    }

    @Synchronized
    fun forget(path: Path) {
        cursors.remove(path)
    }
}
