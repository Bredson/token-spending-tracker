package dev.bredson.tokentracker.engine

import dev.bredson.tokentracker.engine.claudecode.ClaudeCodeSource
import java.nio.file.Path
import kotlin.io.path.writeText
import kotlin.test.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable

/**
 * Test "golden" między silnikami: zrzuca sumy z katalogu logów `TT_PROBE_DIR` do
 * pliku `TT_PROBE_OUT` w formacie porównywalnym z analogicznym zrzutem silnika TS.
 * Uruchamiaj na zamrożonej kopii `~/.claude/projects` — żywe logi rosną w trakcie.
 */
class RealDataProbe {
    @Test
    @EnabledIfEnvironmentVariable(named = "TT_PROBE_OUT", matches = ".+")
    fun dump() {
        val source = ClaudeCodeSource(projectsDir = Path.of(System.getenv("TT_PROBE_DIR")), onUnknownModel = {})
        val records = source.loadAll()
        val byModel = aggregateByModel(records).sortedBy { it.key }
            .joinToString(",") { "\"${it.key}\":[${it.totals.recordCount},${"%.6f".format(java.util.Locale.ROOT, it.totals.costUsd)}]" }
        val totals = sumTotals(records)
        Path.of(System.getenv("TT_PROBE_OUT")).writeText(
            """{"records":${records.size},"cost":${"%.6f".format(java.util.Locale.ROOT, totals.costUsd)},
               "tokens":${totals.tokensInput + totals.tokensOutput + totals.tokensCacheRead + totals.tokensCacheWrite},
               "sessions":${aggregateBySession(records).size},"tasks":${aggregateByTask(records).size},
               "titles":${source.sessionTitles().size},"unknown":${source.unknownModels().joinToString(",", "[", "]") { "\"$it\"" }},
               "byModel":{$byModel}}""".replace(Regex("\\s+"), ""),
        )
    }
}
