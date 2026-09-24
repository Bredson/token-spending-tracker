package dev.bredson.tokentracker.plugin.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service

@Service(Service.Level.APP)
@State(name = "TokenTrackerSettings", storages = [Storage("tokenTracker.xml")])
class TokenTrackerSettings : PersistentStateComponent<TokenTrackerSettings.State> {
    /** Odpowiedniki `tokenTracker.pricingFile` i `tokenTracker.pricingOverrides` z VS Code. */
    data class State(
        var pricingFile: String = "",
        var pricingOverridesJson: String = "",
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        this.state = state
    }

    companion object {
        fun getInstance(): TokenTrackerSettings = service()
    }
}
