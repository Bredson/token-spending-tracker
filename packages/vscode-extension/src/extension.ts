import * as vscode from "vscode";
import { ClaudeCodeSource, Engine } from "@token-tracker/engine";
import { formatStatusBarText } from "./statusBar";
import { DashboardPanel } from "./dashboard/panel";

let engine: Engine | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  engine = new Engine({ sources: [new ClaudeCodeSource()] });

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
  };

  context.subscriptions.push(engine.onChange(updateStatusBar));

  context.subscriptions.push(
    vscode.commands.registerCommand("tokenTracker.openDashboard", () => {
      if (engine) {
        DashboardPanel.createOrShow(context, engine);
      }
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      engine?.dispose();
    },
  });

  await engine.start();
  updateStatusBar();
}

export function deactivate(): void {
  engine?.dispose();
  engine = undefined;
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
