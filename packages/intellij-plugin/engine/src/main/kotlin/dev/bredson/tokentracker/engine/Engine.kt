package dev.bredson.tokentracker.engine

import java.util.concurrent.CopyOnWriteArraySet

/**
 * Odpowiednik `engine.ts`: scala źródła w jeden magazyn rekordów (dedup po `id`),
 * powiadamia słuchaczy i deleguje agregację. Wątkowo bezpieczny — `ingest` bywa
 * wołany z wątku obserwatora źródła.
 */
class Engine(private val sources: List<UsageSource>) : Disposable {
    private val records = ArrayList<UsageRecord>()
    private val knownIds = HashSet<String>()
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val watches = ArrayList<Disposable>()
    private var started = false

    @Synchronized
    fun start() {
        if (started) return
        started = true
        for (source in sources) {
            if (!source.detect()) continue
            ingest(source.loadAll())
            watches += source.watch { ingest(it) }
        }
    }

    fun onChange(listener: () -> Unit): Disposable {
        listeners.add(listener)
        return Disposable { listeners.remove(listener) }
    }

    @Synchronized
    fun records(): List<UsageRecord> = records.toList()

    fun aggregateByTask() = aggregateByTask(records())
    fun aggregateBySession() = aggregateBySession(records())
    fun aggregateByProject() = aggregateByProject(records())
    fun aggregateByModel() = aggregateByModel(records())
    fun aggregateByPeriod(granularity: PeriodGranularity) = aggregateByPeriod(records(), granularity)

    /** Tytuły ze wszystkich źródeł; przy konflikcie wygrywa późniejsze źródło. */
    fun sessionTitles(): Map<String, String> {
        val merged = LinkedHashMap<String, String>()
        for (source in sources) merged.putAll(source.sessionTitles())
        return merged
    }

    fun unknownModels(): List<String> = sources.flatMap { it.unknownModels() }.distinct().sorted()

    @Synchronized
    override fun dispose() {
        watches.forEach { it.dispose() }
        watches.clear()
        listeners.clear()
    }

    private fun ingest(newRecords: List<UsageRecord>) {
        // Jawnie pusta partia = "zmieniły się metadane" — też powiadamia.
        var changed = newRecords.isEmpty()
        synchronized(this) {
            for (record in newRecords) {
                if (knownIds.add(record.id)) {
                    records += record
                    changed = true
                }
            }
        }
        if (changed) listeners.forEach { it() }
    }
}
