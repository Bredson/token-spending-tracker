package dev.bredson.tokentracker.engine

import java.util.Locale

/** Odpowiednik `statusBar.ts`: `"$ 0.42 · 12.3k tok"`. */
fun formatStatusBarText(records: List<UsageRecord>): String {
    val totals = sumTotals(records)
    val tokens = totals.tokensInput + totals.tokensOutput + totals.tokensCacheRead + totals.tokensCacheWrite
    return "$ ${"%.2f".format(Locale.ROOT, totals.costUsd)} · ${formatTokenCount(tokens)} tok"
}

private fun formatTokenCount(tokens: Long): String =
    if (tokens < 1000) tokens.toString() else "%.1fk".format(Locale.ROOT, tokens / 1000.0)

fun formatStatusBarTooltip(records: List<UsageRecord>, sessionTitles: Map<String, String>): String {
    val lines = mutableListOf(
        "Token Tracker — koszt i tokeny Claude Code w tym projekcie dziś: ${formatStatusBarText(records)}",
    )
    val latest = records.maxByOrNull { it.timestamp }
    if (latest == null) {
        lines += "Aktywna sesja: brak sesji dziś"
    } else {
        val title = sessionTitles[latest.sessionId]
        lines += "Aktywna sesja: ${if (title != null) "$title (${latest.sessionId})" else latest.sessionId}"
        lines += "Modele dziś: ${records.map { it.model }.distinct().sorted().joinToString(", ")}"
    }
    lines += "Kliknij, aby otworzyć dashboard."
    return lines.joinToString("\n")
}
