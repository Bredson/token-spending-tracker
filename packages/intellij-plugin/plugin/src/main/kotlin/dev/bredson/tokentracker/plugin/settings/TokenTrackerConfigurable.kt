package dev.bredson.tokentracker.plugin.settings

import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.ui.ToolbarDecorator
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.ui.table.JBTable
import com.intellij.util.ui.FormBuilder
import dev.bredson.tokentracker.engine.PricingTable
import dev.bredson.tokentracker.engine.defaultPricingTable
import dev.bredson.tokentracker.engine.parsePricingOverrides
import dev.bredson.tokentracker.engine.pricingOverridesFrom
import dev.bredson.tokentracker.engine.serializePricingOverrides
import dev.bredson.tokentracker.plugin.TokenTrackerService
import java.nio.file.Path
import javax.swing.JComponent

class TokenTrackerConfigurable : Configurable {
    private var pricingFileField: JBTextField? = null
    private var tableModel: PricingTableModel? = null

    /** Ceny, względem których liczymy nadpisania — z pliku ustawionego w chwili wczytania tabeli. */
    private var defaults: PricingTable = emptyMap()

    override fun getDisplayName(): String = "Token Tracker"

    override fun createComponent(): JComponent {
        val fileField = JBTextField()
        val model = PricingTableModel()
        val table = JBTable(model).apply {
            setShowGrid(false)
            columnModel.getColumn(PricingTableModel.MODEL).preferredWidth = 220
        }
        pricingFileField = fileField
        tableModel = model
        reset()

        val tablePanel = ToolbarDecorator.createDecorator(table)
            .setAddAction {
                val row = model.addCustom()
                table.changeSelection(row, PricingTableModel.MODEL, false, false)
                table.editCellAt(row, PricingTableModel.MODEL)
            }
            .setRemoveAction { table.selectedRow.takeIf { it >= 0 }?.let(model::remove) }
            .setRemoveActionUpdater { table.selectedRow >= 0 && model.row(table.selectedRow).isCustom }
            .addExtraAction(object : DumbAwareAction("Przywróć cenę domyślną", null, AllIcons.Actions.Rollback) {
                override fun actionPerformed(e: AnActionEvent) {
                    table.selectedRow.takeIf { it >= 0 }?.let(model::resetToDefault)
                }

                override fun update(e: AnActionEvent) {
                    e.presentation.isEnabled = table.selectedRow >= 0 && model.row(table.selectedRow).isChanged
                }

                override fun getActionUpdateThread() = ActionUpdateThread.EDT
            })
            .createPanel()

        return FormBuilder.createFormBuilder()
            .addComponent(JBLabel("Ceny modeli w USD za 1M tokenów. Kliknij dwukrotnie komórkę, żeby ją zmienić."))
            .addComponentFillVertically(tablePanel, 4)
            .addComponent(
                JBLabel(
                    "<html>„domyślna” — cena wbudowana we wtyczkę, „zmieniona” — Twoja poprawka " +
                        "(przywrócisz ją przyciskiem ↺), „własna” — model dodany przez Ciebie (+). " +
                        "Modele bez ceny są liczone jako $ 0 i wypisywane w dashboardzie.</html>",
                ),
            )
            .addLabeledComponent(JBLabel("Plik cennika (opcjonalnie, JSON, `~` rozwijane):"), fileField, 12, false)
            .panel
    }

    override fun isModified(): Boolean {
        val state = TokenTrackerSettings.getInstance().state
        val model = tableModel ?: return false
        return pricingFileField?.text != state.pricingFile ||
            pricingOverridesFrom(model.edited(), defaults) != parsePricingOverrides(state.pricingOverridesJson).valid
    }

    override fun apply() {
        val state = TokenTrackerSettings.getInstance().state
        val model = tableModel ?: return
        state.pricingOverridesJson = serializePricingOverrides(pricingOverridesFrom(model.edited(), defaults))
        state.pricingFile = pricingFileField?.text ?: ""
        TokenTrackerService.getInstance().reload()
        reset()
    }

    override fun reset() {
        val state = TokenTrackerSettings.getInstance().state
        pricingFileField?.text = state.pricingFile
        defaults = defaultPricingTable(state.pricingFile, Path.of(System.getProperty("user.home")))
        tableModel?.load(defaults, parsePricingOverrides(state.pricingOverridesJson).valid)
    }

    override fun disposeUIResources() {
        pricingFileField = null
        tableModel = null
    }
}
