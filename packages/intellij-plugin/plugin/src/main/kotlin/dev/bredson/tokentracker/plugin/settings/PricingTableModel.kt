package dev.bredson.tokentracker.plugin.settings

import dev.bredson.tokentracker.engine.ModelPricing
import dev.bredson.tokentracker.engine.PricingTable
import dev.bredson.tokentracker.engine.buildPricingRows
import javax.swing.table.AbstractTableModel

/**
 * Wiersz edytora: `default == null` — model spoza cennika (dodany przez użytkownika albo z logów),
 * `pricing == null` — model z logów lub z importu, któremu nikt jeszcze nie wpisał ceny.
 */
class PriceRow(var model: String, var pricing: ModelPricing?, val default: ModelPricing?, val fromLogs: Boolean = false) {
    val isCustom: Boolean get() = default == null
    val isUnpriced: Boolean get() = pricing == null
    val isChanged: Boolean get() = default != null && default != pricing
}

class PricingTableModel : AbstractTableModel() {
    private val rows = ArrayList<PriceRow>()

    /** Modele z cenami domyślnymi (z nadpisaniami), własne, na końcu niewycenione z logów. */
    fun load(defaults: PricingTable, overrides: PricingTable, unpricedModels: List<String> = emptyList()) {
        rows.clear()
        buildPricingRows(defaults, overrides, unpricedModels).forEach {
            rows += PriceRow(it.model, it.pricing, it.defaultPricing, fromLogs = it.pricing == null)
        }
        fireTableDataChanged()
    }

    /** Modele z logów bez wpisanej ceny nie trafiają do zapisu. */
    fun edited(): PricingTable = rows.mapNotNull { row -> row.pricing?.let { row.model to it } }.toMap()

    fun row(index: Int): PriceRow = rows[index]

    fun addCustom(): Int {
        var name = "nowy-model"
        var n = 2
        while (rows.any { it.model == name }) name = "nowy-model-${n++}"
        rows += PriceRow(name, ModelPricing(0.0, 0.0, 0.0, 0.0), null)
        fireTableRowsInserted(rows.lastIndex, rows.lastIndex)
        return rows.lastIndex
    }

    /** Model własny znika; model z logów wraca do stanu „brak ceny”. */
    /** Dopisuje modele z importu jako „brak ceny”; zwraca indeks pierwszego nowego wiersza. */
    fun addUnpriced(models: List<String>): Int {
        val first = rows.size
        models.forEach { rows += PriceRow(it, null, null, fromLogs = true) }
        if (models.isNotEmpty()) fireTableRowsInserted(first, rows.lastIndex)
        return first
    }

    fun models(): List<String> = rows.map { it.model }

    fun remove(index: Int) {
        val row = rows[index]
        if (row.fromLogs) {
            row.pricing = null
            fireTableRowsUpdated(index, index)
        } else {
            rows.removeAt(index)
            fireTableRowsDeleted(index, index)
        }
    }

    fun resetToDefault(index: Int) {
        val row = rows[index]
        row.pricing = row.default ?: return
        fireTableRowsUpdated(index, index)
    }

    override fun getRowCount(): Int = rows.size
    override fun getColumnCount(): Int = COLUMNS.size
    override fun getColumnName(column: Int): String = COLUMNS[column]
    override fun getColumnClass(column: Int): Class<*> = when (column) {
        MODEL, SOURCE -> String::class.java
        else -> java.lang.Double::class.java
    }

    override fun isCellEditable(rowIndex: Int, column: Int): Boolean = when (column) {
        MODEL -> rows[rowIndex].isCustom && !rows[rowIndex].fromLogs
        SOURCE -> false
        else -> true
    }

    override fun getValueAt(rowIndex: Int, column: Int): Any? {
        val row = rows[rowIndex]
        return when (column) {
            MODEL -> row.model
            INPUT -> row.pricing?.inputPer1M
            OUTPUT -> row.pricing?.outputPer1M
            CACHE_READ -> row.pricing?.cacheReadPer1M
            CACHE_WRITE -> row.pricing?.cacheWritePer1M
            else -> when {
                row.isUnpriced -> "brak ceny"
                row.isCustom -> "własna"
                row.isChanged -> "zmieniona"
                else -> "domyślna"
            }
        }
    }

    override fun setValueAt(value: Any?, rowIndex: Int, column: Int) {
        val row = rows[rowIndex]
        if (column == MODEL) {
            val name = (value as? String)?.trim().orEmpty()
            if (name.isEmpty() || rows.any { it !== row && it.model == name }) return
            row.model = name
        } else {
            val price = (value as? Number)?.toDouble()?.takeIf { it.isFinite() && it >= 0 } ?: return
            // Pierwsza wpisana stawka wycenia model z logów; pozostałe startują od 0.
            val current = row.pricing ?: ModelPricing(0.0, 0.0, 0.0, 0.0)
            row.pricing = when (column) {
                INPUT -> current.copy(inputPer1M = price)
                OUTPUT -> current.copy(outputPer1M = price)
                CACHE_READ -> current.copy(cacheReadPer1M = price)
                else -> current.copy(cacheWritePer1M = price)
            }
        }
        fireTableRowsUpdated(rowIndex, rowIndex)
    }

    companion object {
        const val MODEL = 0
        const val INPUT = 1
        const val OUTPUT = 2
        const val CACHE_READ = 3
        const val CACHE_WRITE = 4
        const val SOURCE = 5
        private val COLUMNS = listOf("Model", "Input", "Output", "Cache read", "Cache write", "Cena")
    }
}
