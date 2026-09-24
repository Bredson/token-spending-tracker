package dev.bredson.tokentracker.engine

/** Odpowiednik `types.ts` — znormalizowany rekord zużycia z wyliczonym kosztem. */
data class UsageRecord(
    val id: String,
    val source: String,
    val sessionId: String,
    val taskId: String,
    val timestamp: String,
    val model: String,
    val tokensInput: Long,
    val tokensOutput: Long,
    val tokensCacheRead: Long,
    val tokensCacheWrite: Long,
    val costUsd: Double,
    val projectPath: String,
)

fun interface Disposable {
    fun dispose()
}

/**
 * Kontrakt źródła danych. Pusta lista w `onUpdate` znaczy "zmieniły się metadane
 * bez nowych rekordów" (np. tytuł sesji) — silnik powiadamia wtedy słuchaczy.
 */
interface UsageSource {
    val id: String
    val displayName: String

    fun detect(): Boolean
    fun loadAll(): List<UsageRecord>
    fun watch(onUpdate: (List<UsageRecord>) -> Unit): Disposable

    fun sessionTitles(): Map<String, String> = emptyMap()
    fun unknownModels(): List<String> = emptyList()
}
