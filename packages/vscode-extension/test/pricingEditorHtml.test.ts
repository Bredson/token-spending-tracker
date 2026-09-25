import { describe, expect, it } from "vitest";
import { renderPricingEditorHtml } from "../src/pricing/editorHtml";

describe("renderPricingEditorHtml", () => {
  const html = renderPricingEditorHtml({ cspSource: "vscode-webview://abc", nonce: "test-nonce-123" });

  it("locks down CSP to the given nonce and csp source, with no network access allowed", () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-test-nonce-123'");
    expect(html).toContain('<script nonce="test-nonce-123">');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("has the price table and add / discard / save controls", () => {
    for (const id of ["rows", "add", "discard", "save", "error"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("talks to the host with ready / save and handles load / saveError", () => {
    expect(html).toContain('postMessage({ type: "ready" })');
    expect(html).toContain('type: "save"');
    expect(html).toContain('message.type === "load"');
    expect(html).toContain('message.type === "saveError"');
  });

  it("lets the user paste a model list that the host parses (importModels / importedModels)", () => {
    expect(html).toContain('id="import-open"');
    expect(html).toContain('id="import-text"');
    expect(html).toContain('type: "importModels"');
    expect(html).toContain('message.type === "importedModels"');
  });

  it("never injects model names as HTML (they come from user settings)", () => {
    expect(html).not.toContain("innerHTML = row");
    expect(html).toContain("nameCell.textContent = row.model");
  });
});
