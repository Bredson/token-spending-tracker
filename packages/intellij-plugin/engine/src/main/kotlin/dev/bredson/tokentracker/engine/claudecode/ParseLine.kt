package dev.bredson.tokentracker.engine.claudecode

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

enum class EntryType { USER, ASSISTANT }

data class ParsedUsage(
    val inputTokens: Long,
    val outputTokens: Long,
    val cacheCreationInputTokens: Long,
    val cacheReadInputTokens: Long,
)

data class ParsedEntry(
    val type: EntryType,
    val sessionId: String,
    val uuid: String,
    val isHumanMessage: Boolean,
    val timestamp: String,
    val cwd: String,
    /** Tylko dla ASSISTANT z policzalnym zużyciem tokenów. */
    val model: String? = null,
    val usage: ParsedUsage? = null,
)

internal val lenientJson = Json { ignoreUnknownKeys = true; isLenient = true }

internal fun parseJsonObject(line: String): JsonObject? {
    val trimmed = line.trim()
    if (trimmed.isEmpty()) return null
    return try {
        lenientJson.parseToJsonElement(trimmed) as? JsonObject
    } catch (_: Exception) {
        null
    }
}

internal fun JsonObject.string(key: String): String? =
    (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.long(key: String): Long? =
    (this[key] as? JsonPrimitive)?.takeUnless { it.isString }?.longOrNull

/**
 * Odpowiednik `parseLine.ts`: zwraca null dla linii nie-JSON, typów innych niż
 * user/assistant oraz przy braku pól potrzebnych do grupowania.
 */
fun parseLine(line: String): ParsedEntry? {
    val entry = parseJsonObject(line) ?: return null

    val type = when (entry.string("type")) {
        "user" -> EntryType.USER
        "assistant" -> EntryType.ASSISTANT
        else -> return null
    }

    val sessionId = entry.string("sessionId") ?: return null
    val uuid = entry.string("uuid") ?: return null
    val timestamp = entry.string("timestamp") ?: return null
    val cwd = entry.string("cwd") ?: return null

    val originKind = (entry["origin"] as? JsonObject)?.string("kind")
    val isHumanMessage = type == EntryType.USER && originKind == "human"

    var model: String? = null
    var usage: ParsedUsage? = null
    if (type == EntryType.ASSISTANT) {
        val message = entry["message"] as? JsonObject
        val messageModel = message?.string("model")
        val rawUsage = message?.get("usage") as? JsonObject
        if (messageModel != null && rawUsage != null) {
            val input = rawUsage.long("input_tokens")
            val output = rawUsage.long("output_tokens")
            val cacheCreation = rawUsage.long("cache_creation_input_tokens")
            val cacheRead = rawUsage.long("cache_read_input_tokens")
            if (input != null && output != null && cacheCreation != null && cacheRead != null) {
                model = messageModel
                usage = ParsedUsage(input, output, cacheCreation, cacheRead)
            }
        }
    }

    return ParsedEntry(type, sessionId, uuid, isHumanMessage, timestamp, cwd, model, usage)
}
