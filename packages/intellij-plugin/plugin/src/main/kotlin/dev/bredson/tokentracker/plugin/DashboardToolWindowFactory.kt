package dev.bredson.tokentracker.plugin

import com.intellij.ide.impl.ProjectUtil
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import dev.bredson.tokentracker.engine.buildDashboardData
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import javax.swing.JComponent
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Dashboard = ten sam HTML co webview VS Code (`packages/dashboard-ui/dashboard.html`),
 * renderowany w JCEF. Most: strona woła `window.tokenTrackerHost(json)`, host wstrzykuje
 * dane przez `window.postMessage`, tak jak robi to VS Code.
 */
class DashboardToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val component: JComponent = if (JBCefApp.isSupported()) {
            DashboardBrowser(project, toolWindow).component
        } else {
            JBLabel("<html>Token Tracker: dashboard wymaga JCEF, którego to IDE/runtime nie wspiera.<br/>" +
                "Licznik w pasku stanu działa niezależnie.</html>")
        }
        toolWindow.contentManager.addContent(
            toolWindow.contentManager.factory.createContent(component, "", false),
        )
    }

    companion object {
        const val TOOL_WINDOW_ID = "Token Tracker"
    }
}

private class DashboardBrowser(private val project: Project, toolWindow: ToolWindow) {
    private val log = thisLogger()
    private val browser = JBCefBrowser()
    private val hostQuery = JBCefJSQuery.create(browser as JBCefBrowserBase)
    private val service = TokenTrackerService.getInstance()

    val component: JComponent get() = browser.component

    init {
        Disposer.register(toolWindow.disposable, browser)
        Disposer.register(browser, hostQuery)
        Disposer.register(browser, service.onChange { pushData() })

        hostQuery.addHandler { payload ->
            handleHostMessage(payload)
            null
        }

        browser.jbCefClient.addLoadHandler(
            object : org.cef.handler.CefLoadHandlerAdapter() {
                override fun onLoadEnd(cefBrowser: org.cef.browser.CefBrowser, frame: org.cef.browser.CefFrame, httpStatusCode: Int) {
                    cefBrowser.executeJavaScript(
                        "window.tokenTrackerHost = function(json) { ${hostQuery.inject("json")} };",
                        cefBrowser.url, 0,
                    )
                    pushData()
                }
            },
            browser.cefBrowser,
        )

        browser.loadHTML(loadDashboardHtml())
    }

    private fun loadDashboardHtml(): String {
        val template = checkNotNull(DashboardBrowser::class.java.getResource("/dashboard.html")) {
            "dashboard.html missing from plugin resources"
        }.readText()
        return template
            .replace("__NONCE__", UUID.randomUUID().toString().replace("-", ""))
            .replace("__CSP_SOURCE__", "'self'")
    }

    private fun pushData() {
        val data = buildDashboardData(
            records = service.records(),
            sessionTitles = service.sessionTitles(),
            unknownModels = service.unknownModels(),
        ).toJson()
        browser.cefBrowser.executeJavaScript(
            "window.postMessage({ type: 'update', data: $data }, '*');",
            browser.cefBrowser.url, 0,
        )
    }

    private fun handleHostMessage(payload: String) {
        val message = try {
            Json.parseToJsonElement(payload).jsonObject
        } catch (e: Exception) {
            log.warn("Bad message from dashboard: $payload", e)
            return
        }
        when (message["type"]?.jsonPrimitive?.content) {
            "ready" -> pushData()
            "openProject" -> openProject(message["projectPath"]?.jsonPrimitive?.content)
        }
    }

    private fun openProject(path: String?) {
        if (path.isNullOrEmpty()) return
        ApplicationManager.getApplication().invokeLater {
            if (!Files.isDirectory(Path.of(path))) {
                Messages.showWarningDialog(project, "Katalog projektu już nie istnieje: $path", "Token Tracker")
                return@invokeLater
            }
            ProjectUtil.openOrImport(Path.of(path), project, true)
        }
    }
}
