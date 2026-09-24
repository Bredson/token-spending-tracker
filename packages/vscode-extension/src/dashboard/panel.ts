import { existsSync } from "node:fs";
import * as vscode from "vscode";
import type { Engine } from "@token-tracker/engine";
import { openProjectFolder } from "../openProject";
import { buildDashboardData } from "./dataProvider";
import { renderDashboardHtml } from "./webviewHtml";

/**
 * Singleton panelu dashboardu — spec.md 6.2. Utrzymuje jeden `WebviewPanel`
 * i wysyła pełne, przeliczone dane po każdej zmianie w silniku (`engine.onChange`);
 * webview nigdy nie agreguje samodzielnie (spec.md 6.3).
 */
export class DashboardPanel {
  private static current: DashboardPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private engine: Engine;
  private engineSubscription: vscode.Disposable;

  static createOrShow(context: vscode.ExtensionContext, engine: Engine): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "tokenTrackerDashboard",
      "Token Tracker",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    DashboardPanel.current = new DashboardPanel(panel, engine);
    context.subscriptions.push({
      dispose: () => {
        DashboardPanel.current?.dispose();
      },
    });
  }

  /** Podmienia silnik w otwartym panelu (np. po przeładowaniu cennika z ustawień). */
  static attachEngine(engine: Engine): void {
    DashboardPanel.current?.attach(engine);
  }

  private constructor(panel: vscode.WebviewPanel, engine: Engine) {
    this.panel = panel;
    this.engine = engine;
    const nonce = createNonce();
    this.panel.webview.html = renderDashboardHtml({
      cspSource: this.panel.webview.cspSource,
      nonce,
    });

    this.postUpdate();
    this.engineSubscription = engine.onChange(() => this.postUpdate());

    this.panel.webview.onDidReceiveMessage((message: { type: string; projectPath?: unknown }) => {
      if (message.type === "ready") {
        this.postUpdate();
      } else if (message.type === "openProject") {
        void openProjectFolder(message.projectPath, {
          exists: existsSync,
          openFolder: async (path) => {
            await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(path), {
              forceNewWindow: true,
            });
          },
          warn: (text) => void vscode.window.showWarningMessage(text),
        });
      }
    });

    this.panel.onDidDispose(() => this.dispose());
  }

  private attach(engine: Engine): void {
    this.engineSubscription.dispose();
    this.engine = engine;
    this.engineSubscription = engine.onChange(() => this.postUpdate());
    this.postUpdate();
  }

  private postUpdate(): void {
    void this.panel.webview.postMessage({
      type: "update",
      data: buildDashboardData(
        this.engine.getRecords(),
        new Date(),
        this.engine.getSessionTitles(),
        this.engine.getUnknownModels(),
      ),
    });
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    this.engineSubscription.dispose();
    this.panel.dispose();
  }
}

function createNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
