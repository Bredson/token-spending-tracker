package dev.bredson.tokentracker.plugin.settings

import dev.bredson.tokentracker.engine.ModelPricing
import dev.bredson.tokentracker.engine.PricingTable
import javax.swing.table.AbstractTableModel

/** Wiersz edytora: `default == null` oznacza model dodany przez użytkownika. */
class PriceRow(var model: String, var pricing: ModelPricing, val default: ModelPricing?) {
    val isCustom: Boolean get() = default == null
    val isChanged: Boolean get() = default != null && default != pricing
}

class PricingTableModel : AbstractTableModel() {
    private val rows = ArrayList<PriceRow>()

    /** Wszystkie modele z cenami domyślnymi, z nadpisaniami naniesionymi na wierzch. */
    fun load(defaults: PricingTable, overrides: PricingTable) {
        rows.clear()
        defaults.forEach { (model, pricing) -> rows += PriceRow(model, overrides[model] ?: pricing, pricing) }
        overrides.filterKeys { it !in defaults }.forEach { (model, pricing) -> rows += PriceRow(model, pricing, null) }
        fireTableDataChanged()
    }

    fun edited(): PricingTable = rows.associate { it.model to it.pricing }

    fun row(index: Int): PriceRow = rows[index]

    fun addCustom(): Int {
        var name = "nowy-model"
        var n = 2
        while (rows.any { it.model == name }) name = "nowy-model-${n++}"
        rows += PriceRow(name, ModelPricing(0.0, 0.0, 0.0, 0.0), null)
        fireTableRowsInserted(rows.lastIndex, rows.lastIndex)
        return rows.lastIndex
    }

    fun remove(index: Int) {
        rows.removeAt(index)
        fireTableRowsDeleted(index, index)
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
        MODEL -> rows[rowIndex].isCustom
        SOURCE -> false
        else -> true
    }

    override fun getValueAt(rowIndex: Int, column: Int): Any {
        val row = rows[rowIndex]
        return when (column) {
            MODEL -> row.model
            INPUT -> row.pricing.inputPer1M
            OUTPUT -> row.pricing.outputPer1M
            CACHE_READ -> row.pricing.cacheReadPer1M
            CACHE_WRITE -> row.pricing.cacheWritePer1M
            else -> when {
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
            row.pricing = when (column) {
                INPUT -> row.pricing.copy(inputPer1M = price)
                OUTPUT -> row.pricing.copy(outputPer1M = price)
                CACHE_READ -> row.pricing.copy(cacheReadPer1M = price)
                else -> row.pricing.copy(cacheWritePer1M = price)
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
