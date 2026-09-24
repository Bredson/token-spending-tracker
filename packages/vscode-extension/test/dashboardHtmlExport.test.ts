import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DASHBOARD_HTML_PLACEHOLDERS, renderDashboardHtml } from "../src/dashboard/webviewHtml";

const exportedPath = join(__dirname, "..", "..", "dashboard-ui", "dashboard.html");

describe("exported dashboard.html (shared with the IntelliJ plugin)", () => {
  it("is in sync with renderDashboardHtml — run `npm run export:html` after changing the webview", () => {
    expect(readFileSync(exportedPath, "utf-8")).toBe(renderDashboardHtml(DASHBOARD_HTML_PLACEHOLDERS));
  });

  it("uses a host adapter so the same page works without acquireVsCodeApi", () => {
    const html = renderDashboardHtml(DASHBOARD_HTML_PLACEHOLDERS);
    expect(html).toContain('typeof acquireVsCodeApi === "function"');
    expect(html).toContain("window.tokenTrackerHost");
    expect(html).not.toMatch(/\bvscode\.postMessage/);
    expect(html).toContain("__CSP_SOURCE__");
    expect(html).toContain("__NONCE__");
  });
});
