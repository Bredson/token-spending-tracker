package dev.bredson.tokentracker.engine

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.io.TempDir

class PricingTest {
    private val millionOfEach = record(
        tokensInput = 1_000_000, tokensOutput = 1_000_000,
        tokensCacheRead = 1_000_000, tokensCacheWrite = 1_000_000, costUsd = 0.0,
    )

    private val sonnetOnly: PricingTable = mapOf(
        "claude-sonnet-5" to ModelPricing(inputPer1M = 2.0, outputPer1M = 10.0, cacheReadPer1M = 0.2, cacheWritePer1M = 2.5),
    )

    @Test
    fun `bundled table is the shared pricing json from the TypeScript engine`() {
        val table = loadPricingTable()
        assertEquals(2.0, table.getValue("claude-sonnet-5").inputPer1M)
        assertNotNull(table["claude-opus-5"])
        assertNotNull(table["claude-haiku-4-5"])
    }

    @Test
    fun `custom file overrides a known model and adds a new one, keeping other defaults`(@TempDir dir: Path) {
        val custom = dir.resolve("custom.json")
        custom.writeText(
            """{"claude-sonnet-5":{"inputPer1M":999,"outputPer1M":999,"cacheReadPer1M":999,"cacheWritePer1M":999},
                "some-future-model":{"inputPer1M":1,"outputPer1M":2,"cacheReadPer1M":0.1,"cacheWritePer1M":0.5}}""",
        )
        val table = loadPricingTable(custom)
        assertEquals(999.0, table.getValue("claude-sonnet-5").inputPer1M)
        assertEquals(ModelPricing(1.0, 2.0, 0.1, 0.5), table["some-future-model"])
        assertNotNull(table["claude-opus-5"])
    }

    @Test
    fun `missing or invalid custom file falls back to defaults without throwing`(@TempDir dir: Path) {
        assertNotNull(loadPricingTable(dir.resolve("does-not-exist.json"))["claude-sonnet-5"])
        val broken = dir.resolve("broken.json")
        broken.writeText("{ not valid json")
        assertNotNull(loadPricingTable(broken)["claude-sonnet-5"])
    }

    @Test
    fun `applyPricing computes cost from tokens and per-1M rates`() {
        // 2 + 10 + 0.2 + 2.5
        assertEquals(14.7, applyPricing(millionOfEach, sonnetOnly).costUsd, 1e-6)
    }

    @Test
    fun `applyPricing does not mutate the input`() {
        applyPricing(millionOfEach, sonnetOnly)
        assertEquals(0.0, millionOfEach.costUsd)
    }

    @Test
    fun `unknown model yields zero cost and is reported once per call`() {
        val seen = mutableListOf<String>()
        val priced = applyPricing(millionOfEach.copy(model = "claude-unreleased-model"), sonnetOnly) { seen.add(it) }
        assertEquals(0.0, priced.costUsd)
        assertEquals(listOf("claude-unreleased-model"), seen)
    }

    @Test
    fun `known model does not trigger the unknown callback`() {
        val seen = mutableListOf<String>()
        applyPricing(millionOfEach, sonnetOnly) { seen.add(it) }
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `gateway-style id is priced as the bare model, keeping the original id on the record`() {
        val seen = mutableListOf<String>()
        val priced = applyPricing(millionOfEach.copy(model = "anthropic/claude-sonnet-5[1m]"), sonnetOnly) { seen.add(it) }
        assertEquals(14.7, priced.costUsd, 1e-6)
        assertEquals("anthropic/claude-sonnet-5[1m]", priced.model)
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `synthetic pseudo-model costs zero and is not reported as unknown`() {
        val seen = mutableListOf<String>()
        assertEquals(0.0, applyPricing(millionOfEach.copy(model = "<synthetic>"), sonnetOnly) { seen.add(it) }.costUsd)
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `normalizeModelId strips provider prefix and context suffix and resolves aliases`() {
        assertEquals("claude-opus-5", normalizeModelId("anthropic/claude-opus-5"))
        assertEquals("claude-sonnet-5", normalizeModelId("claude-sonnet-5[1m]"))
        assertEquals("claude-sonnet-5", normalizeModelId("sonnet"))
        assertEquals("claude-opus-5", normalizeModelId("opus"))
        assertEquals("claude-haiku-4-5", normalizeModelId("haiku"))
        assertEquals("claude-fable-5-1", normalizeModelId("fable"))
        assertEquals("claude-haiku-4-5-20251001", normalizeModelId("claude-haiku-4-5-20251001"))
        assertEquals("openai/gpt-6-astra", normalizeModelId("openai/gpt-6-astra"))
    }

    @Test
    fun `real-world ids are priced above zero with the bundled table`() {
        val table = loadPricingTable()
        for (model in listOf("sonnet", "opus", "haiku", "fable", "anthropic/claude-fable-5-1[1m]")) {
            val seen = mutableListOf<String>()
            val priced = applyPricing(millionOfEach.copy(model = model), table) { seen.add(it) }
            assertTrue(priced.costUsd > 0, "model $model")
            assertTrue(seen.isEmpty(), "model $model reported unknown")
        }
    }
}
