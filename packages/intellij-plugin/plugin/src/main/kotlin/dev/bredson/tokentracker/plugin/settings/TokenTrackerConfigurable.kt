package dev.bredson.tokentracker.plugin.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import dev.bredson.tokentracker.plugin.TokenTrackerService
import javax.swing.JComponent

class TokenTrackerConfigurable : Configurable {
    private var pricingFileField: JBTextField? = null
    private var overridesArea: JBTextArea? = null

    override fun getDisplayName(): String = "Token Tracker"

    override fun createComponent(): JComponent {
        val fileField = JBTextField()
        val area = JBTextArea(8, 60).apply { lineWrap = true; wrapStyleWord = true }
        pricingFileField = fileField
        overridesArea = area
        reset()
        return FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("Plik cennika (JSON, `~` rozwijane):"), fileField, 1, false)
            .addLabeledComponent(JBLabel("Cennik wpisany wprost (JSON, ma pierwszeństwo):"), JBScrollPane(area), 1, true)
            .addComponent(
                JBLabel(
                    "<html>Format: <code>{ \"&lt;model-id&gt;\": { \"inputPer1M\": 2, \"outputPer1M\": 10, " +
                        "\"cacheReadPer1M\": 0.2, \"cacheWritePer1M\": 2.5 } }</code> — USD za 1M tokenów. " +
                        "Modele bez ceny są liczone jako $ 0 i wypisywane w dashboardzie.</html>",
                ),
            )
            .addComponentFillVertically(javax.swing.JPanel(), 0)
            .panel
    }

    override fun isModified(): Boolean {
        val state = TokenTrackerSettings.getInstance().state
        return pricingFileField?.text != state.pricingFile || overridesArea?.text != state.pricingOverridesJson
    }

    override fun apply() {
        val state = TokenTrackerSettings.getInstance().state
        state.pricingFile = pricingFileField?.text ?: ""
        state.pricingOverridesJson = overridesArea?.text ?: ""
        TokenTrackerService.getInstance().reload()
    }

    override fun reset() {
        val state = TokenTrackerSettings.getInstance().state
        pricingFileField?.text = state.pricingFile
        overridesArea?.text = state.pricingOverridesJson
    }

    override fun disposeUIResources() {
        pricingFileField = null
        overridesArea = null
    }
}
