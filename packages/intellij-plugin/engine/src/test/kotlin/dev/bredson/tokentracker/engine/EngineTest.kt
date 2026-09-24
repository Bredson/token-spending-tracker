package dev.bredson.tokentracker.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private class FakeSource(
    private val available: Boolean,
    private val initial: List<UsageRecord>,
    var titles: Map<String, String> = emptyMap(),
    var unknown: List<String> = emptyList(),
) : UsageSource {
    override val id = "fake"
    override val displayName = "Fake source"
    private var callback: ((List<UsageRecord>) -> Unit)? = null
    var disposed = false
    var loadCount = 0

    override fun detect() = available
    override fun loadAll(): List<UsageRecord> { loadCount++; return initial }
    override fun watch(onUpdate: (List<UsageRecord>) -> Unit): Disposable {
        callback = onUpdate
        return Disposable { disposed = true }
    }
    fun emit(records: List<UsageRecord>) = callback?.invoke(records)
    override fun sessionTitles() = titles
    override fun unknownModels() = unknown
}

class EngineTest {
    @Test
    fun `start loads initial records only from sources that detect as available`() {
        val engine = Engine(listOf(FakeSource(true, listOf(record(id = "r1"))), FakeSource(false, listOf(record(id = "r2")))))
        engine.start()
        assertEquals(listOf("r1"), engine.records().map { it.id })
    }

    @Test
    fun `start is idempotent`() {
        val source = FakeSource(true, listOf(record(id = "r1")))
        val engine = Engine(listOf(source))
        engine.start(); engine.start()
        assertEquals(1, engine.records().size)
        assertEquals(1, source.loadCount)
    }

    @Test
    fun `records emitted by watch are appended`() {
        val source = FakeSource(true, listOf(record(id = "r1")))
        val engine = Engine(listOf(source)).apply { start() }
        source.emit(listOf(record(id = "r2")))
        assertEquals(listOf("r1", "r2"), engine.records().map { it.id }.sorted())
    }

    @Test
    fun `records are deduplicated by id`() {
        val source = FakeSource(true, listOf(record(id = "r1")))
        val engine = Engine(listOf(source)).apply { start() }
        source.emit(listOf(record(id = "r1")))
        assertEquals(1, engine.records().size)
    }

    @Test
    fun `listeners are notified only when something new arrived`() {
        val source = FakeSource(true, listOf(record(id = "r1")))
        val engine = Engine(listOf(source)).apply { start() }
        var notifications = 0
        engine.onChange { notifications++ }
        source.emit(listOf(record(id = "r1")))
        assertEquals(0, notifications)
        source.emit(listOf(record(id = "r2")))
        assertEquals(1, notifications)
    }

    @Test
    fun `an explicitly empty batch is a metadata change and notifies listeners`() {
        val source = FakeSource(true, emptyList())
        val engine = Engine(listOf(source)).apply { start() }
        var notifications = 0
        engine.onChange { notifications++ }
        source.emit(emptyList())
        assertEquals(1, notifications)
        assertTrue(engine.records().isEmpty())
    }

    @Test
    fun `a disposed subscription is no longer notified`() {
        val source = FakeSource(true, emptyList())
        val engine = Engine(listOf(source)).apply { start() }
        var notifications = 0
        engine.onChange { notifications++ }.dispose()
        source.emit(listOf(record(id = "r1")))
        assertEquals(0, notifications)
    }

    @Test
    fun `aggregations reflect the current store`() {
        val engine = Engine(
            listOf(
                FakeSource(
                    true,
                    listOf(
                        record(id = "r1", taskId = "t1", sessionId = "s1", projectPath = "/p1", costUsd = 1.0),
                        record(id = "r2", taskId = "t1", sessionId = "s1", projectPath = "/p1", costUsd = 2.0),
                    ),
                ),
            ),
        ).apply { start() }
        assertEquals(3.0, engine.aggregateByTask().single().totals.costUsd, 1e-9)
        assertEquals("s1", engine.aggregateBySession().single().key)
        assertEquals("/p1", engine.aggregateByProject().single().key)
        assertEquals("2026-03-10", engine.aggregateByPeriod(PeriodGranularity.DAY).single().key)
    }

    @Test
    fun `session titles are merged across sources, later source wins`() {
        val first = FakeSource(true, emptyList(), titles = mapOf("s1" to "Pierwszy"))
        val second = FakeSource(true, emptyList(), titles = mapOf("s1" to "Drugi", "s2" to "Inny"))
        val engine = Engine(listOf(first, second)).apply { start() }
        assertEquals(mapOf("s1" to "Drugi", "s2" to "Inny"), engine.sessionTitles())
    }

    @Test
    fun `unknown models are merged, deduplicated and sorted`() {
        val first = FakeSource(true, emptyList(), unknown = listOf("zeta", "alpha"))
        val second = FakeSource(true, emptyList(), unknown = listOf("alpha", "mid"))
        val engine = Engine(listOf(first, second)).apply { start() }
        assertEquals(listOf("alpha", "mid", "zeta"), engine.unknownModels())
    }

    @Test
    fun `dispose stops watches and listeners`() {
        val source = FakeSource(true, emptyList())
        val engine = Engine(listOf(source)).apply { start() }
        var notifications = 0
        engine.onChange { notifications++ }
        engine.dispose()
        assertTrue(source.disposed)
        source.emit(listOf(record(id = "r1")))
        assertEquals(0, notifications)
    }
}
