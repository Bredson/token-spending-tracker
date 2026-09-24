import { homedir } from "node:os";
import * as vscode from "vscode";
import { ClaudeCodeSource, Engine } from "@token-tracker/engine";
import { formatStatusBarText, formatStatusBarTooltip } from "./statusBar";
import { DashboardPanel } from "./dashboard/panel";
import { resolvePricingTable } from "./pricingConfig";

let engine: Engine | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "tokenTracker.openDashboard";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = (): void => {
    if (!engine) {
      return;
    }
    const workspaceFolderPaths = (vscode.workspace.workspaceFolders ?? []).map(
      (folder) => folder.uri.fsPath,
    );
    const todaysProjectRecords = engine
      .getRecords()
      .filter(
        (record) => workspaceFolderPaths.includes(record.projectPath) && isToday(record.timestamp),
      );
    statusBarItem.text = formatStatusBarText(todaysProjectRecords);
    statusBarItem.tooltip = formatStatusBarTooltip(todaysProjectRecords, engine.getSessionTitles());
  };

  const startEngine = async (): Promise<void> => {
    engine?.dispose();
    engine = new Engine({ sources: [new ClaudeCodeSource({ pricingTable: loadConfiguredPricing() })] });
    engine.onChange(updateStatusBar);
    DashboardPanel.attachEngine(engine);
    await engine.start();
    updateStatusBar();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("tokenTracker.openDashboard", () => {
      if (engine) {
        DashboardPanel.createOrShow(context, engine);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("tokenTracker")) {
        void startEngine();
      }
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      engine?.dispose();
    },
  });

  await startEngine();
}

export function deactivate(): void {
  engine?.dispose();
  engine = undefined;
}

function loadConfiguredPricing() {
  const config = vscode.workspace.getConfiguration("tokenTracker");
  const { table, rejectedModels } = resolvePricingTable(
    {
      pricingFile: config.get<string>("pricingFile"),
      pricingOverrides: config.get<unknown>("pricingOverrides"),
    },
    homedir(),
  );
  if (rejectedModels.length > 0) {
    void vscode.window.showWarningMessage(
      `Token Tracker: pominięto niepoprawne wpisy w tokenTracker.pricingOverrides: ${rejectedModels.join(", ")}`,
    );
  }
  return table;
}

function isToday(timestampIso: string): boolean {
  const timestamp = new Date(timestampIso);
  const now = new Date();
  return (
    timestamp.getUTCFullYear() === now.getUTCFullYear() &&
    timestamp.getUTCMonth() === now.getUTCMonth() &&
    timestamp.getUTCDate() === now.getUTCDate()
  );
}
