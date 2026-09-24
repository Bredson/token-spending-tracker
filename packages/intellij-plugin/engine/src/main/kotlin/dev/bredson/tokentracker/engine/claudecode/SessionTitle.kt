package dev.bredson.tokentracker.engine.claudecode

enum class TitleKind { AI, CUSTOM }

data class ParsedSessionTitle(
    val sessionId: String,
    val kind: TitleKind,
    val title: String,
)

/** Odpowiednik `sessionTitle.ts`: wpisy `ai-title` / `custom-title` (bez timestampu). */
fun parseSessionTitleLine(line: String): ParsedSessionTitle? {
    val entry = parseJsonObject(line) ?: return null
    val sessionId = entry.string("sessionId") ?: return null

    return when (entry.string("type")) {
        "ai-title" -> entry.string("aiTitle")?.let { ParsedSessionTitle(sessionId, TitleKind.AI, it) }
        "custom-title" -> entry.string("customTitle")?.let { ParsedSessionTitle(sessionId, TitleKind.CUSTOM, it) }
        else -> null
    }
}
