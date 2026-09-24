package dev.bredson.tokentracker.engine

import java.nio.file.Path
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

data class ResolvedPricing(val table: PricingTable, val rejectedModels: List<String>)

/**
 * Odpowiednik `pricingConfig.ts`: tabela wbudowana + opcjonalny plik + nadpisania
 * wpisane wprost (JSON z ustawień, niezaufane). Wpis nadpisania musi mieć cztery
 * skończone, nieujemne liczby — inaczej trafia do `rejectedModels`.
 */
fun resolvePricingTable(pricingFile: String?, overridesJson: String?, homeDir: Path): ResolvedPricing {
    val filePath = pricingFile?.trim()?.takeIf { it.isNotEmpty() }?.let { expandHome(it, homeDir) }
    val table = LinkedHashMap(loadPricingTable(filePath))

    val rejected = ArrayList<String>()
    val overrides = parseObjectOrNull(overridesJson)
    if (overrides != null) {
        for ((model, entry) in overrides) {
            val pricing = (entry as? JsonObject)?.toModelPricing()
            if (pricing != null) table[model] = pricing else rejected += model
        }
    }
    return ResolvedPricing(table, rejected.sorted())
}

private fun expandHome(path: String, homeDir: Path): Path = when {
    path == "~" -> homeDir
    path.startsWith("~/") -> homeDir.resolve(path.substring(2))
    else -> Path.of(path)
}

private fun parseObjectOrNull(text: String?): JsonObject? {
    if (text.isNullOrBlank()) return null
    return try {
        Json.parseToJsonElement(text) as? JsonObject
    } catch (_: Exception) {
        null
    }
}

private fun JsonObject.price(key: String): Double? =
    (this[key] as? JsonPrimitive)?.takeUnless { it.isString }?.doubleOrNull?.takeIf { it.isFinite() && it >= 0 }

private fun JsonObject.toModelPricing(): ModelPricing? {
    val input = price("inputPer1M") ?: return null
    val output = price("outputPer1M") ?: return null
    val cacheRead = price("cacheReadPer1M") ?: return null
    val cacheWrite = price("cacheWritePer1M") ?: return null
    return ModelPricing(input, output, cacheRead, cacheWrite)
}
