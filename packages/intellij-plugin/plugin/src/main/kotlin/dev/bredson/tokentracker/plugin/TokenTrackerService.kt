package dev.bredson.tokentracker.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.ui.Messages
import dev.bredson.tokentracker.engine.Engine
import dev.bredson.tokentracker.engine.UsageRecord
import dev.bredson.tokentracker.engine.claudecode.ClaudeCodeSource
import dev.bredson.tokentracker.engine.resolvePricingTable
import dev.bredson.tokentracker.plugin.settings.TokenTrackerSettings
import java.nio.file.Path
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Jeden silnik na całe IDE (logi Claude Code są globalne, nie per projekt).
 * Słuchacze są wołani na EDT, bo aktualizują UI.
 */
@Service(Service.Level.APP)
class TokenTrackerService : Disposable {
    private val log = thisLogger()
    private val listeners = CopyOnWriteArraySet<() -> Unit>()

    @Volatile
    private var engine: Engine = createEngine().also { it.start() }

    fun records(): List<UsageRecord> = engine.records()
    fun sessionTitles(): Map<String, String> = engine.sessionTitles()
    fun unknownModels(): List<String> = engine.unknownModels()

    fun onChange(listener: () -> Unit): Disposable {
        listeners.add(listener)
        return Disposable { listeners.remove(listener) }
    }

    /** Po zmianie ustawień cennika: nowy silnik, pełne przeliczenie, powiadomienie UI. */
    fun reload() {
        val old = engine
        engine = createEngine().also { it.start() }
        old.dispose()
        notifyListeners()
    }

    private fun createEngine(): Engine {
        val settings = TokenTrackerSettings.getInstance().state
        val resolved = resolvePricingTable(
            pricingFile = settings.pricingFile,
            overridesJson = settings.pricingOverridesJson,
            homeDir = Path.of(System.getProperty("user.home")),
        )
        if (resolved.rejectedModels.isNotEmpty()) {
            ApplicationManager.getApplication().invokeLater {
                Messages.showWarningDialog(
                    "Pominięto niepoprawne wpisy cennika: ${resolved.rejectedModels.joinToString(", ")}",
                    "Token Tracker",
                )
            }
        }
        val source = ClaudeCodeSource(pricingTable = resolved.table, onUnknownModel = { model ->
            log.info("Unknown model \"$model\" — priced at 0")
        })
        return Engine(listOf(source)).also { it.onChange { notifyListeners() } }
    }

    private fun notifyListeners() {
        ApplicationManager.getApplication().invokeLater {
            listeners.forEach { it() }
        }
    }

    override fun dispose() {
        engine.dispose()
        listeners.clear()
    }

    companion object {
        fun getInstance(): TokenTrackerService = service()
    }
}
