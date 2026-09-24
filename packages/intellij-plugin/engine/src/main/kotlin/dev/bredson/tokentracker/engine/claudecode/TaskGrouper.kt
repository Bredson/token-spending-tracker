package dev.bredson.tokentracker.engine.claudecode

/**
 * Odpowiednik `taskGrouping.ts`: nowe zadanie zaczyna się przy wpisie user z
 * origin.kind == "human"; wszystko dalej (tool_result, subagenci) należy do niego.
 * Stan per sesja, bo pliki są czytane przyrostowo.
 */
class TaskGrouper {
    private val currentTaskIdBySession = HashMap<String, String>()

    fun assignTaskId(entry: ParsedEntry): String {
        if (entry.isHumanMessage) {
            currentTaskIdBySession[entry.sessionId] = entry.uuid
            return entry.uuid
        }
        return currentTaskIdBySession[entry.sessionId] ?: "${entry.sessionId}:pre"
    }
}
