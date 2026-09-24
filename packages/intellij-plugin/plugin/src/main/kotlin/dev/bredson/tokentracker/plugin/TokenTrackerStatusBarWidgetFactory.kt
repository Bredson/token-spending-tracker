package dev.bredson.tokentracker.plugin

import com.intellij.openapi.Disposable
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.Consumer
import dev.bredson.tokentracker.engine.UsageRecord
import dev.bredson.tokentracker.engine.formatStatusBarText
import dev.bredson.tokentracker.engine.formatStatusBarTooltip
import java.awt.Component
import java.awt.event.MouseEvent
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class TokenTrackerStatusBarWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = WIDGET_ID
    override fun getDisplayName(): String = "Token Tracker"
    override fun isAvailable(project: Project): Boolean = true
    override fun createWidget(project: Project): StatusBarWidget = TokenTrackerStatusBarWidget(project)
    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true

    companion object {
        const val WIDGET_ID = "TokenTrackerStatusBar"
    }
}

/** Koszt i tokeny dzisiejszych rekordów bieżącego projektu — odpowiednik status baru VS Code. */
class TokenTrackerStatusBarWidget(private val project: Project) : StatusBarWidget, StatusBarWidget.TextPresentation {
    private var statusBar: StatusBar? = null
    private var subscription: Disposable? = null

    override fun ID(): String = TokenTrackerStatusBarWidgetFactory.WIDGET_ID
    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        subscription = TokenTrackerService.getInstance().onChange { statusBar.updateWidget(ID()) }
            .also { Disposer.register(this, it) }
    }

    private fun todaysProjectRecords(): List<UsageRecord> {
        val basePath = project.basePath ?: return emptyList()
        val today = LocalDate.now(ZoneOffset.UTC)
        return TokenTrackerService.getInstance().records().filter { record ->
            record.projectPath == basePath &&
                Instant.parse(record.timestamp).atOffset(ZoneOffset.UTC).toLocalDate() == today
        }
    }

    override fun getText(): String = formatStatusBarText(todaysProjectRecords())

    override fun getTooltipText(): String =
        formatStatusBarTooltip(todaysProjectRecords(), TokenTrackerService.getInstance().sessionTitles())

    override fun getAlignment(): Float = Component.CENTER_ALIGNMENT

    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer {
        ToolWindowManager.getInstance(project).getToolWindow(DashboardToolWindowFactory.TOOL_WINDOW_ID)?.show()
    }

    override fun dispose() {
        subscription = null
        statusBar = null
    }
}
