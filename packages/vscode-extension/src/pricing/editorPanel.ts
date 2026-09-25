import { homedir } from "node:os";
import * as vscode from "vscode";
import { createNonce } from "../nonce";
import {
  buildPricingRows,
  defaultPricingTable,
  modelsToImport,
  overridesFromEditedRows,
  parsePricingOverrides,
  type PricingConfig,
} from "../pricingConfig";
import { renderPricingEditorHtml } from "./editorHtml";

/**
 * Singleton panelu edycji cennika. Źródłem prawdy są ustawienia `tokenTracker.*`:
 * panel zapisuje do nich nadpisania, a każdą zmianę konfiguracji (również ręczną
 * edycję `settings.json`) odsyła do webview jako świeże wiersze.
 */
export class PricingEditorPanel {
  private static current: PricingEditorPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly getUnpricedModels: () => string[];
  private readonly disposables: vscode.Disposable[] = [];

  /** `getUnpricedModels` — modele z logów bez ceny (silnik bywa podmieniany, więc getter). */
  static createOrShow(context: vscode.ExtensionContext, getUnpricedModels: () => string[]): void {
    if (PricingEditorPanel.current) {
      PricingEditorPanel.current.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "tokenTrackerPricing",
      "Token Tracker — cennik",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    PricingEditorPanel.current = new PricingEditorPanel(panel, getUnpricedModels);
    context.subscriptions.push({
      dispose: () => {
        PricingEditorPanel.current?.dispose();
      },
    });
  }

  /** Po przeliczeniu danych przez nowy silnik zmienia się lista modeli bez ceny. */
  static refresh(): void {
    PricingEditorPanel.current?.postRows();
  }

  private constructor(panel: vscode.WebviewPanel, getUnpricedModels: () => string[]) {
    this.panel = panel;
    this.getUnpricedModels = getUnpricedModels;
    this.panel.webview.html = renderPricingEditorHtml({
      cspSource: this.panel.webview.cspSource,
      nonce: createNonce(),
    });

    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(
        (message: { type: string; rows?: unknown; text?: unknown; existingModels?: unknown }) => {
          if (message.type === "ready") {
            this.postRows();
          } else if (message.type === "save") {
            void this.save(message.rows);
          } else if (message.type === "importModels") {
            this.importModels(message.text, message.existingModels);
          }
        },
      ),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("tokenTracker")) {
          this.postRows();
        }
      }),
      this.panel.onDidDispose(() => this.dispose()),
    );
  }

  private postRows(): void {
    const config = readPricingConfig();
    void this.panel.webview.postMessage({
      type: "load",
      rows: buildPricingRows(
        defaultPricingTable(config, homedir()),
        parsePricingOverrides(config.pricingOverrides).valid,
        this.getUnpricedModels(),
      ),
      pricingFile: config.pricingFile?.trim() ?? "",
    });
  }

  private importModels(text: unknown, existingModels: unknown): void {
    const existing = Array.isArray(existingModels)
      ? existingModels.filter((model): model is string => typeof model === "string")
      : [];
    const result = modelsToImport(typeof text === "string" ? text : "", existing);
    void this.panel.webview.postMessage({ type: "importedModels", ...result });
  }

  private async save(rows: unknown): Promise<void> {
    const result = overridesFromEditedRows(rows, defaultPricingTable(readPricingConfig(), homedir()));
    if (!result.ok) {
      void this.panel.webview.postMessage({ type: "saveError", error: result.error });
      return;
    }

    const config = vscode.workspace.getConfiguration("tokenTracker");
    // Zapis tam, skąd wartość faktycznie działa — ustawienie workspace przesłoniłoby globalne.
    const target =
      config.inspect("pricingOverrides")?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    const value = Object.keys(result.overrides).length > 0 ? result.overrides : undefined;
    try {
      await config.update("pricingOverrides", value, target);
      // Zapis bez faktycznej zmiany wartości nie wywoła onDidChangeConfiguration.
      this.postRows();
    } catch (error) {
      void this.panel.webview.postMessage({
        type: "saveError",
        error: `Nie udało się zapisać ustawień: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private dispose(): void {
    PricingEditorPanel.current = undefined;
    this.disposables.forEach((disposable) => disposable.dispose());
    this.panel.dispose();
  }
}

function readPricingConfig(): PricingConfig {
  const config = vscode.workspace.getConfiguration("tokenTracker");
  return {
    pricingFile: config.get<string>("pricingFile"),
    pricingOverrides: config.get<unknown>("pricingOverrides"),
  };
}
