package dev.bredson.tokentracker.engine.claudecode

import dev.bredson.tokentracker.engine.Disposable
import dev.bredson.tokentracker.engine.PricingTable
import dev.bredson.tokentracker.engine.UsageRecord
import dev.bredson.tokentracker.engine.UsageSource
import dev.bredson.tokentracker.engine.applyPricing
import dev.bredson.tokentracker.engine.loadPricingTable
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.io.path.extension
import kotlin.io.path.isDirectory
import kotlin.io.path.isRegularFile
import kotlin.streams.asSequence
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds

/**
 * Odpowiednik `ClaudeCodeSource` z TS. Zamiast watchera FS używa pollera co
 * `pollInterval` — na macOS `WatchService` JDK odpytuje katalog co 10 s, a dzięki
 * kursorom (mtime/size) przegląd ~100 plików co sekundę jest tani i przewidywalny.
 */
class ClaudeCodeSource(
    private val projectsDir: Path = Path.of(System.getProperty("user.home"), ".claude", "projects"),
    private val pricingTable: PricingTable = loadPricingTable(),
    onUnknownModel: ((String) -> Unit)? = null,
    private val pollInterval: Duration = 1.seconds,
) : UsageSource {
    override val id = "claude-code"
    override val displayName = "Claude Code"

    private val cursorStore = FileCursorStore()
    private val grouper = TaskGrouper()
    private val unknownModels = LinkedHashSet<String>()
    private val titles = HashMap<String, Titles>()
    private val reportUnknown: (String) -> Unit = { model ->
        val firstTime = synchronized(unknownModels) { unknownModels.add(model) }
        if (firstTime) (onUnknownModel ?: { println("[token-tracker] Nieznany model \"$it\" — koszt nieprzeliczony (0).") })(model)
    }

    private data class Titles(var ai: String? = null, var custom: String? = null)
    private data class Processed(val records: List<UsageRecord>, val titlesChanged: Boolean)

    override fun detect(): Boolean = projectsDir.isDirectory()

    override fun loadAll(): List<UsageRecord> {
        if (!projectsDir.isDirectory()) return emptyList()
        return sessionFiles().flatMap { process(cursorStore.readNewLines(it)).records }
    }

    override fun watch(onUpdate: (List<UsageRecord>) -> Unit): Disposable {
        val executor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { runnable ->
            Thread(runnable, "token-tracker-claude-code-poll").apply { isDaemon = true }
        }
        executor.scheduleWithFixedDelay(
            {
                try {
                    if (!projectsDir.isDirectory()) return@scheduleWithFixedDelay
                    for (file in sessionFiles()) {
                        val lines = cursorStore.readNewLines(file)
                        if (lines.isEmpty()) continue
                        val (records, titlesChanged) = process(lines)
                        if (records.isNotEmpty() || titlesChanged) onUpdate(records)
                    }
                } catch (_: Exception) {
                    // Pojedynczy nieudany cykl nie może zatrzymać pollera.
                }
            },
            pollInterval.inWholeMilliseconds, pollInterval.inWholeMilliseconds, TimeUnit.MILLISECONDS,
        )
        return Disposable { executor.shutdownNow() }
    }

    override fun sessionTitles(): Map<String, String> = synchronized(titles) {
        titles.mapNotNull { (sessionId, t) -> (t.custom ?: t.ai)?.let { sessionId to it } }.toMap()
    }

    override fun unknownModels(): List<String> = synchronized(unknownModels) { unknownModels.sorted() }

    private fun sessionFiles(): List<Path> =
        Files.walk(projectsDir).use { stream ->
            stream.asSequence().filter { it.isRegularFile() && it.extension == "jsonl" }.sorted().toList()
        }

    private fun process(lines: List<String>): Processed {
        val records = ArrayList<UsageRecord>()
        var titlesChanged = false

        for (line in lines) {
            val title = parseSessionTitleLine(line)
            if (title != null) {
                synchronized(titles) {
                    val t = titles.getOrPut(title.sessionId) { Titles() }
                    if (title.kind == TitleKind.AI) t.ai = title.title else t.custom = title.title
                }
                titlesChanged = true
                continue
            }

            val entry = parseLine(line) ?: continue
            val taskId = grouper.assignTaskId(entry)
            val usage = entry.usage ?: continue
            val model = entry.model ?: continue

            val record = UsageRecord(
                id = "${entry.sessionId}:${entry.uuid}",
                source = id,
                sessionId = entry.sessionId,
                taskId = taskId,
                timestamp = entry.timestamp,
                model = model,
                tokensInput = usage.inputTokens,
                tokensOutput = usage.outputTokens,
                tokensCacheRead = usage.cacheReadInputTokens,
                tokensCacheWrite = usage.cacheCreationInputTokens,
                costUsd = 0.0,
                projectPath = entry.cwd,
            )
            records += applyPricing(record, pricingTable, reportUnknown)
        }
        return Processed(records, titlesChanged)
    }
}
