package dev.bredson.tokentracker.engine

import java.nio.file.Path
import kotlin.io.path.readText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Ceny w USD za 1M tokenów — ten sam format co `pricing.json` silnika TS. */
@Serializable
data class ModelPricing(
    val inputPer1M: Double,
    val outputPer1M: Double,
    val cacheReadPer1M: Double,
    val cacheWritePer1M: Double,
)

typealias PricingTable = Map<String, ModelPricing>

private val json = Json { ignoreUnknownKeys = true }

private const val SYNTHETIC_MODEL = "<synthetic>"

private val MODEL_FAMILY_ALIASES = mapOf(
    "sonnet" to "claude-sonnet-5",
    "opus" to "claude-opus-5",
    "haiku" to "claude-haiku-4-5",
    "fable" to "claude-fable-5-1",
)

private val bundledTable: PricingTable by lazy {
    val text = checkNotNull(ModelPricing::class.java.getResource("/pricing.json")) {
        "pricing.json missing from engine resources"
    }.readText()
    json.decodeFromString<Map<String, ModelPricing>>(text)
}

/** Zdejmuje `anthropic/` i `[1m]`, rozwiązuje aliasy rodzin; inne ID zwraca bez zmian. */
fun normalizeModelId(model: String): String {
    val id = model.removePrefix("anthropic/").removeSuffix("[1m]")
    return MODEL_FAMILY_ALIASES[id] ?: id
}

/** Wbudowana tabela scalona z opcjonalnym plikiem użytkownika; nigdy nie rzuca. */
fun loadPricingTable(customPath: Path? = null): PricingTable {
    if (customPath == null) return bundledTable
    val custom = try {
        json.decodeFromString<Map<String, ModelPricing>>(customPath.readText())
    } catch (_: Exception) {
        return bundledTable
    }
    return bundledTable + custom
}

/** Nowa kopia rekordu z `costUsd`; nieznany model → 0 i wywołanie `onUnknownModel`. */
fun applyPricing(
    record: UsageRecord,
    table: PricingTable,
    onUnknownModel: ((String) -> Unit)? = null,
): UsageRecord {
    if (record.model == SYNTHETIC_MODEL) return record.copy(costUsd = 0.0)

    val pricing = table[record.model] ?: table[normalizeModelId(record.model)]
    if (pricing == null) {
        onUnknownModel?.invoke(record.model)
        return record.copy(costUsd = 0.0)
    }

    val cost = record.tokensInput / 1_000_000.0 * pricing.inputPer1M +
        record.tokensOutput / 1_000_000.0 * pricing.outputPer1M +
        record.tokensCacheRead / 1_000_000.0 * pricing.cacheReadPer1M +
        record.tokensCacheWrite / 1_000_000.0 * pricing.cacheWritePer1M
    return record.copy(costUsd = cost)
}
