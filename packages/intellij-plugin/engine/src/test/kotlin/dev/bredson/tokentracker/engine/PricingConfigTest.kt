package dev.bredson.tokentracker.engine

import java.nio.file.Path
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.junit.jupiter.api.io.TempDir

class PricingConfigTest {
    private val valid = """{"inputPer1M":1,"outputPer1M":2,"cacheReadPer1M":0.1,"cacheWritePer1M":1.25}"""

    @Test
    fun `nothing configured yields the bundled table`(@TempDir home: Path) {
        val (table, rejected) = resolvePricingTable(pricingFile = null, overridesJson = null, homeDir = home)
        assertNotNull(table["claude-sonnet-5"])
        assertEquals(emptyList(), rejected)
    }

    @Test
    fun `pricing file is loaded with a leading tilde expanded to the home dir`(@TempDir home: Path) {
        home.resolve("prices.json").writeText("""{"openai/gpt-6-astra":$valid}""")
        val (table, _) = resolvePricingTable("~/prices.json", null, home)
        assertEquals(ModelPricing(1.0, 2.0, 0.1, 1.25), table["openai/gpt-6-astra"])
        assertNotNull(table["claude-sonnet-5"])
    }

    @Test
    fun `inline overrides win over the file for the same model`(@TempDir home: Path) {
        home.resolve("prices.json").writeText("""{"claude-sonnet-5":{"inputPer1M":111,"outputPer1M":2,"cacheReadPer1M":0.1,"cacheWritePer1M":1.25}}""")
        val (table, _) = resolvePricingTable(
            home.resolve("prices.json").toString(),
            """{"claude-sonnet-5":{"inputPer1M":222,"outputPer1M":2,"cacheReadPer1M":0.1,"cacheWritePer1M":1.25}}""",
            home,
        )
        assertEquals(222.0, table.getValue("claude-sonnet-5").inputPer1M)
    }

    @Test
    fun `malformed override entries are rejected by name and defaults kept`(@TempDir home: Path) {
        val (table, rejected) = resolvePricingTable(
            null,
            """{"claude-sonnet-5":{"inputPer1M":"2","outputPer1M":10,"cacheReadPer1M":0.2,"cacheWritePer1M":2.5},
                "claude-opus-5":{"inputPer1M":-1,"outputPer1M":25,"cacheReadPer1M":0.5,"cacheWritePer1M":6.25},
                "claude-haiku-4-5":{"inputPer1M":1,"outputPer1M":5},
                "good-model":$valid}""",
            home,
        )
        assertEquals(listOf("claude-haiku-4-5", "claude-opus-5", "claude-sonnet-5"), rejected)
        assertEquals(2.0, table.getValue("claude-sonnet-5").inputPer1M)
        assertEquals(ModelPricing(1.0, 2.0, 0.1, 1.25), table["good-model"])
    }

    @Test
    fun `overrides that are not a JSON object at all are ignored without error`(@TempDir home: Path) {
        for (bad in listOf("nope", "[1,2]", "", "   ", "{ broken")) {
            val (table, rejected) = resolvePricingTable(null, bad, home)
            assertNotNull(table["claude-sonnet-5"], "input: $bad")
            assertEquals(emptyList(), rejected, "input: $bad")
        }
    }

    @Test
    fun `blank pricing file path means not configured`(@TempDir home: Path) {
        assertEquals(2.0, resolvePricingTable("   ", null, home).table.getValue("claude-sonnet-5").inputPer1M)
    }

    @Test
    fun `bundled table prices claude-opus-5-5`() {
        assertEquals(ModelPricing(4.0, 20.0, 0.2, 5.0), loadPricingTable()["claude-opus-5-5"])
    }

    @Test
    fun `parsed overrides split valid entries from rejected ones`() {
        val parsed = parsePricingOverrides("""{"good":$valid,"bad":{"inputPer1M":1}}""")
        assertEquals(mapOf("good" to ModelPricing(1.0, 2.0, 0.1, 1.25)), parsed.valid)
        assertEquals(listOf("bad"), parsed.rejected)
    }

    @Test
    fun `serialized overrides parse back to the same map and empty serializes to blank`() {
        val overrides = mapOf("a" to ModelPricing(1.0, 2.0, 0.1, 1.25), "b" to ModelPricing(0.0, 0.0, 0.0, 0.0))
        assertEquals(overrides, parsePricingOverrides(serializePricingOverrides(overrides)).valid)
        assertEquals("", serializePricingOverrides(emptyMap()))
    }

    @Test
    fun `only edited or new models end up as overrides`() {
        val defaults = mapOf("kept" to ModelPricing(1.0, 2.0, 0.1, 1.25), "changed" to ModelPricing(1.0, 2.0, 0.1, 1.25))
        val edited = mapOf(
            "kept" to ModelPricing(1.0, 2.0, 0.1, 1.25),
            "changed" to ModelPricing(9.0, 2.0, 0.1, 1.25),
            "custom" to ModelPricing(3.0, 4.0, 0.3, 3.75),
        )
        assertEquals(
            mapOf("changed" to ModelPricing(9.0, 2.0, 0.1, 1.25), "custom" to ModelPricing(3.0, 4.0, 0.3, 3.75)),
            pricingOverridesFrom(edited, defaults),
        )
    }

    @Test
    fun `pricing rows list defaults with overrides, then custom, then unpriced models from logs`() {
        val base = ModelPricing(1.0, 2.0, 0.1, 1.25)
        val changed = base.copy(inputPer1M = 9.0)
        val rows = buildPricingRows(
            defaults = mapOf("kept" to base, "changed" to base),
            overrides = mapOf("changed" to changed, "custom" to base),
            unpricedModels = listOf("openai/gpt-6-astra", "kept", "custom"),
        )
        assertEquals(
            listOf(
                PricingRow("kept", base, base),
                PricingRow("changed", changed, base),
                PricingRow("custom", base, null),
                PricingRow("openai/gpt-6-astra", null, null),
            ),
            rows,
        )
    }
}
