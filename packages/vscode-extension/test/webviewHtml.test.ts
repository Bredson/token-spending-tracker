import { describe, expect, it } from "vitest";
import { renderDashboardHtml } from "../src/dashboard/webviewHtml";

describe("renderDashboardHtml", () => {
  const html = renderDashboardHtml({ cspSource: "vscode-webview://abc", nonce: "test-nonce-123" });

  it("locks down CSP to the given nonce and csp source, with no network access allowed", () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-test-nonce-123'");
    expect(html).toContain("vscode-webview://abc");
    expect(html).not.toMatch(/https?:\/\//);
  });

  it("includes containers for all four required views (spec.md 6.2)", () => {
    expect(html).toContain('id="view-overview"');
    expect(html).toContain('id="view-session"');
    expect(html).toContain('id="view-breakdown"');
    expect(html).toContain('id="sessions-body"');
    expect(html).toContain('id="tasks-body"');
  });

  it("formats last-activity timestamps as local 'YYYY-MM-DD HH:MM:SS' instead of raw ISO", () => {
    expect(html).toContain("function formatTimestamp(iso)");
    expect(html).toContain("formatTimestamp(session.lastActivity)");
    expect(html).toContain("formatTimestamp(task.lastActivity)");
  });

  it("shows a session's natural-language title alongside its raw session id, escaping any HTML in it", () => {
    expect(html).toContain("function sessionLabel(session)");
    expect(html).toContain("session.title");
    expect(html).toContain("function escapeHtml(value)");
    expect(html).toContain("sessionLabel(session)");
  });

  it("has a warning banner for unknown models, rendered from data.unknownModels with HTML escaping", () => {
    expect(html).toContain('id="unknown-models"');
    expect(html).toContain("function renderUnknownModels()");
    expect(html).toContain("data.unknownModels");
    expect(html).toMatch(/renderUnknownModels\(\)[\s\S]*escapeHtml\(model\)/);
  });

  it("renders a per-model table in the breakdown view from `byModel`, escaping model ids", () => {
    expect(html).toContain('id="breakdown-models"');
    expect(html).toContain("function renderModelRows(byModel)");
    expect(html).toMatch(/renderModelRows\(byModel\)[\s\S]*escapeHtml\(entry\.model\)/);
  });

  it("lists every model used by a task in the session table, not just the last one", () => {
    expect(html).toContain("function modelsLabel(byModel)");
    expect(html).toContain("modelsLabel(task.byModel)");
  });

  it("lists the models used by each session in a dedicated column of the overview table", () => {
    expect(html).toMatch(/<th>Sesja<\/th><th>Model<\/th>/);
    expect(html).toContain("modelsLabel(session.byModel)");
    expect(html).toContain('colspan="5"');
  });

  it("has a session filter box that matches on title, session id and model, case-insensitively", () => {
    expect(html).toContain('id="session-filter"');
    expect(html).toContain("function matchesFilter(session, query)");
    expect(html).toMatch(/matchesFilter\(session, query\)[\s\S]*toLowerCase\(\)/);
    expect(html).toMatch(/matchesFilter\(session, query\)[\s\S]*session\.title[\s\S]*session\.sessionId[\s\S]*byModel/);
    expect(html).toContain('addEventListener("input"');
  });

  it("only reads data via postMessage, never fetch/XHR", () => {
    expect(html).not.toContain("fetch(");
    expect(html).not.toContain("XMLHttpRequest");
    expect(html).toContain("acquireVsCodeApi");
    expect(html).toContain('addEventListener("message"');
  });
});
