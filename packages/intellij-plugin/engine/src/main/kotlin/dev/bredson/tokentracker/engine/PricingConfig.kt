package dev.bredson.tokentracker.engine

import java.nio.file.Path
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

data class ResolvedPricing(val table: PricingTable, val rejectedModels: List<String>)

data class ParsedOverrides(val valid: PricingTable, val rejected: List<String>)

private val prettyJson = Json { prettyPrint = true }

/** Nadpisania z ustawień: poprawne wpisy w kolejności z JSON-a, błędne po nazwie (posortowane). */
fun parsePricingOverrides(overridesJson: String?): ParsedOverrides {
    val valid = LinkedHashMap<String, ModelPricing>()
    val rejected = ArrayList<String>()
    parseObjectOrNull(overridesJson)?.forEach { (model, entry) ->
        val pricing = (entry as? JsonObject)?.toModelPricing()
        if (pricing != null) valid[model] = pricing else rejected += model
    }
    return ParsedOverrides(valid, rejected.sorted())
}

fun serializePricingOverrides(overrides: PricingTable): String =
    if (overrides.isEmpty()) "" else prettyJson.encodeToString(overrides)

/** Wpisy z edytora, które trzeba zapisać: nowe modele i te, których cena różni się od domyślnej. */
fun pricingOverridesFrom(edited: PricingTable, defaults: PricingTable): PricingTable =
    edited.filter { (model, pricing) -> defaults[model] != pricing }

/**
 * Wiersz edytora cennika: `defaultPricing == null` — model dodany przez użytkownika,
 * `pricing == null` — model widziany w logach, który jeszcze nie ma ceny.
 */
data class PricingRow(val model: String, val pricing: ModelPricing?, val defaultPricing: ModelPricing?)

/** Modele z cenami domyślnymi (z naniesionymi nadpisaniami), modele własne, na końcu niewycenione z logów. */
fun buildPricingRows(
    defaults: PricingTable,
    overrides: PricingTable,
    unpricedModels: List<String> = emptyList(),
): List<PricingRow> =
    defaults.map { (model, pricing) -> PricingRow(model, overrides[model] ?: pricing, pricing) } +
        overrides.filterKeys { it !in defaults }.map { (model, pricing) -> PricingRow(model, pricing, null) } +
        unpricedModels.filter { it !in defaults && it !in overrides }.map { PricingRow(it, null, null) }

// `dostawca/model`, opcjonalnie z sufiksem okna kontekstu — tak wypisuje je np. `/models` bramki API.
private val MODEL_ID_PATTERN = Regex("""[A-Za-z0-9][\w-]*/[A-Za-z0-9][\w.-]*(?:\[1m])?""")

/** `added` — nowe ID (znormalizowane jak w silniku) w kolejności z tekstu; `skipped` — ile już było w tabeli. */
data class ImportedModels(val added: List<String>, val skipped: Int)

/**
 * Wklejona lista modeli (dowolny tekst, np. wynik `/models`) → modele do dopisania
 * jako „brak ceny”. Porównuje po znormalizowanym ID, więc `anthropic/claude-x[1m]`
 * trafia na istniejący wiersz `claude-x`.
 */
fun modelsToImport(text: String, existingModels: Collection<String>): ImportedModels {
    val known = existingModels.map { normalizeModelId(it.trim()) }.toSet()
    val found = MODEL_ID_PATTERN.findAll(text).map { normalizeModelId(it.value.trimEnd('.')) }.distinct().toList()
    val added = found.filter { it !in known }
    return ImportedModels(added, skipped = found.size - added.size)
}

/**
 * Odpowiednik `pricingConfig.ts`: tabela wbudowana + opcjonalny plik + nadpisania
 * wpisane wprost (JSON z ustawień, niezaufane). Wpis nadpisania musi mieć cztery
 * skończone, nieujemne liczby — inaczej trafia do `rejectedModels`.
 */
fun resolvePricingTable(pricingFile: String?, overridesJson: String?, homeDir: Path): ResolvedPricing {
    val overrides = parsePricingOverrides(overridesJson)
    return ResolvedPricing(defaultPricingTable(pricingFile, homeDir) + overrides.valid, overrides.rejected)
}

/** Ceny bez nadpisań z ustawień: wbudowane + opcjonalny plik użytkownika. */
fun defaultPricingTable(pricingFile: String?, homeDir: Path): PricingTable =
    loadPricingTable(pricingFile?.trim()?.takeIf { it.isNotEmpty() }?.let { expandHome(it, homeDir) })

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
