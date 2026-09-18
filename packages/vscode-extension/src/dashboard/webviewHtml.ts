export interface RenderDashboardHtmlOptions {
  cspSource: string;
  nonce: string;
}

/**
 * Czysta funkcja: zwraca cały HTML panelu (bez frameworka, brak requestów sieciowych).
 * Webview tylko przełącza widoki i renderuje sumy dostarczone przez `postMessage` —
 * żadna agregacja nie dzieje się tutaj (spec.md 6.3).
 */
export function renderDashboardHtml({ cspSource, nonce }: RenderDashboardHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${cspSource};" />
<title>Token Tracker</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0 16px 16px; }
  h1 { font-size: 1.1em; }
  .crumbs { margin-bottom: 12px; }
  .crumbs button { background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; padding: 0; font: inherit; }
  .crumbs button:hover { text-decoration: underline; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  tr.clickable { cursor: pointer; }
  tr.clickable:hover { background: var(--vscode-list-hoverBackground); }
  .cards { display: flex; gap: 12px; margin-bottom: 16px; }
  .card { border: 1px solid var(--vscode-widget-border, #444); border-radius: 4px; padding: 8px 12px; flex: 1; }
  .card .value { font-size: 1.3em; font-weight: 600; }
  .card .label { opacity: 0.7; font-size: 0.85em; }
  .series { display: flex; align-items: flex-end; gap: 2px; height: 80px; margin-bottom: 16px; }
  .series .bar { flex: 1; background: var(--vscode-charts-blue, #3794ff); min-height: 1px; }
  .breakdown div { margin-bottom: 4px; }
  .view { display: none; }
  .view.active { display: block; }
  .empty { opacity: 0.7; }
</style>
</head>
<body>
  <div class="crumbs" id="crumbs"></div>

  <section id="view-overview" class="view">
    <h1>Przegląd</h1>
    <div class="cards">
      <div class="card"><div class="value" id="overview-today-cost"></div><div class="label">dziś</div></div>
      <div class="card"><div class="value" id="overview-week-cost"></div><div class="label">ten tydzień</div></div>
      <div class="card"><div class="value" id="overview-month-cost"></div><div class="label">ten miesiąc</div></div>
    </div>
    <div class="series" id="overview-series"></div>
    <h2>Sesje</h2>
    <table>
      <thead><tr><th>Sesja</th><th>Ostatnia aktywność</th><th>Koszt</th><th>Tokeny</th></tr></thead>
      <tbody id="sessions-body"></tbody>
    </table>
  </section>

  <section id="view-session" class="view">
    <h1>Sesja</h1>
    <table>
      <thead><tr><th>Zadanie</th><th>Model</th><th>Ostatnia aktywność</th><th>Koszt</th><th>Tokeny</th></tr></thead>
      <tbody id="tasks-body"></tbody>
    </table>
  </section>

  <section id="view-breakdown" class="view">
    <h1>Rozbicie tokenów</h1>
    <div class="breakdown" id="breakdown-body"></div>
  </section>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  let data = null;
  let currentSessionId = null;
  let currentBreakdown = null; // { kind: 'session' | 'task', sessionId, taskId }

  function formatUsd(value) {
    return "$ " + value.toFixed(2);
  }

  function formatTokens(value) {
    return value >= 1000 ? (value / 1000).toFixed(1) + "k" : String(value);
  }

  function totalTokens(totals) {
    return totals.tokensInput + totals.tokensOutput + totals.tokensCacheRead + totals.tokensCacheWrite;
  }

  function formatTimestamp(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) +
      ":" + pad(date.getMinutes()) +
      ":" + pad(date.getSeconds())
    );
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
    document.getElementById("view-" + name).classList.add("active");
  }

  function renderCrumbs(parts) {
    const crumbs = document.getElementById("crumbs");
    crumbs.innerHTML = "";
    parts.forEach((part, index) => {
      if (index > 0) {
        crumbs.appendChild(document.createTextNode(" / "));
      }
      const btn = document.createElement("button");
      btn.textContent = part.label;
      btn.addEventListener("click", part.onClick);
      crumbs.appendChild(btn);
    });
  }

  function renderOverview() {
    if (!data) return;
    document.getElementById("overview-today-cost").textContent = formatUsd(data.overview.today.costUsd);
    document.getElementById("overview-week-cost").textContent = formatUsd(data.overview.week.costUsd);
    document.getElementById("overview-month-cost").textContent = formatUsd(data.overview.month.costUsd);

    const seriesEl = document.getElementById("overview-series");
    seriesEl.innerHTML = "";
    const maxCost = Math.max(1, ...data.overview.dailyCostSeries.map((p) => p.costUsd));
    for (const point of data.overview.dailyCostSeries) {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = Math.max(1, Math.round((point.costUsd / maxCost) * 80)) + "px";
      bar.title = point.date + ": " + formatUsd(point.costUsd);
      seriesEl.appendChild(bar);
    }

    const sessionsBody = document.getElementById("sessions-body");
    sessionsBody.innerHTML = "";
    if (data.sessions.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="4" class="empty">Brak danych</td>';
      sessionsBody.appendChild(row);
    }
    for (const session of data.sessions) {
      const row = document.createElement("tr");
      row.className = "clickable";
      row.innerHTML =
        "<td>" + session.sessionId + "</td>" +
        "<td>" + formatTimestamp(session.lastActivity) + "</td>" +
        "<td>" + formatUsd(session.totals.costUsd) + "</td>" +
        "<td>" + formatTokens(totalTokens(session.totals)) + "</td>";
      row.addEventListener("click", () => openSession(session.sessionId));
      sessionsBody.appendChild(row);
    }

    renderCrumbs([{ label: "Przegląd", onClick: () => showView("overview") }]);
    showView("overview");
  }

  function openSession(sessionId) {
    currentSessionId = sessionId;
    const session = data.sessions.find((s) => s.sessionId === sessionId);
    if (!session) return;

    const tasksBody = document.getElementById("tasks-body");
    tasksBody.innerHTML = "";
    for (const task of session.tasks) {
      const row = document.createElement("tr");
      row.className = "clickable";
      row.innerHTML =
        "<td>" + task.taskId + "</td>" +
        "<td>" + task.model + "</td>" +
        "<td>" + formatTimestamp(task.lastActivity) + "</td>" +
        "<td>" + formatUsd(task.totals.costUsd) + "</td>" +
        "<td>" + formatTokens(totalTokens(task.totals)) + "</td>";
      row.addEventListener("click", () => openBreakdown({ kind: "task", sessionId, taskId: task.taskId }));
      tasksBody.appendChild(row);
    }

    renderCrumbs([
      { label: "Przegląd", onClick: () => renderOverview() },
      { label: "Sesja " + sessionId, onClick: () => openSession(sessionId) },
    ]);
    showView("session");
  }

  function openBreakdown(ref) {
    currentBreakdown = ref;
    const session = data.sessions.find((s) => s.sessionId === ref.sessionId);
    if (!session) return;
    const totals = ref.kind === "session" ? session.totals : session.tasks.find((t) => t.taskId === ref.taskId).totals;

    const body = document.getElementById("breakdown-body");
    body.innerHTML =
      "<div>Input: " + formatTokens(totals.tokensInput) + " tok</div>" +
      "<div>Output: " + formatTokens(totals.tokensOutput) + " tok</div>" +
      "<div>Cache read: " + formatTokens(totals.tokensCacheRead) + " tok</div>" +
      "<div>Cache write: " + formatTokens(totals.tokensCacheWrite) + " tok</div>" +
      "<div>Koszt: " + formatUsd(totals.costUsd) + "</div>";

    const crumbs = [
      { label: "Przegląd", onClick: () => renderOverview() },
      { label: "Sesja " + ref.sessionId, onClick: () => openSession(ref.sessionId) },
    ];
    if (ref.kind === "task") {
      crumbs.push({ label: "Zadanie " + ref.taskId, onClick: () => openBreakdown(ref) });
    }
    renderCrumbs(crumbs);
    showView("breakdown");
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "update") {
      data = message.data;
      renderOverview();
    }
  });

  vscode.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;
}
