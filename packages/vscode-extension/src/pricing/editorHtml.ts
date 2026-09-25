export interface RenderPricingEditorHtmlOptions {
  cspSource: string;
  nonce: string;
}

/**
 * Czysta funkcja: HTML edytora cennika (bez frameworka, brak requestów sieciowych).
 * Wiersze przychodzą z hosta (`load`), webview tylko je edytuje i odsyła całość
 * (`save`) — walidację i wyliczenie nadpisań robi host (`overridesFromEditedRows`).
 */
export function renderPricingEditorHtml({ cspSource, nonce }: RenderPricingEditorHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<title>Token Tracker — cennik</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0 16px 16px; }
  h1 { font-size: 1.1em; }
  p.hint { opacity: 0.8; font-size: 0.9em; margin: 0 0 12px; }
  p.hint code { font-family: var(--vscode-editor-font-family, monospace); }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
  th, td { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--vscode-widget-border, #444); }
  th.num { text-align: right; }
  input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); padding: 3px 5px; font: inherit; box-sizing: border-box; width: 100%; }
  input[type="number"] { text-align: right; min-width: 80px; }
  input:focus { outline: 1px solid var(--vscode-focusBorder); }
  input.invalid { border-color: var(--vscode-inputValidation-errorBorder, #be1100); }
  .model-name { font-family: var(--vscode-editor-font-family, monospace); }
  .state { opacity: 0.7; font-size: 0.85em; white-space: nowrap; }
  .state.changed { color: var(--vscode-editorWarning-foreground, #cca700); opacity: 1; }
  .state.custom { color: var(--vscode-textLink-foreground); opacity: 1; }
  .state.unpriced { color: var(--vscode-editorWarning-foreground, #cca700); opacity: 1; font-weight: 600; }
  td.actions { white-space: nowrap; width: 1%; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; padding: 4px 12px; cursor: pointer; font: inherit; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.icon { background: none; color: var(--vscode-foreground); padding: 2px 6px; opacity: 0.8; }
  button.icon:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2)); opacity: 1; }
  .bar { display: flex; align-items: center; gap: 8px; }
  .bar .spacer { flex: 1; }
  .status { font-size: 0.9em; opacity: 0.8; }
  .error { display: none; border-left: 3px solid var(--vscode-inputValidation-errorBorder, #be1100); background: var(--vscode-inputValidation-errorBackground, rgba(190,17,0,0.12)); padding: 8px 12px; margin-bottom: 12px; font-size: 0.9em; }
  .error.active { display: block; }
</style>
</head>
<body>
  <h1>Cennik modeli</h1>
  <p class="hint">Ceny w USD za 1M tokenów. „domyślna” — cena wbudowana (lub z pliku cennika), „zmieniona” — Twoja poprawka (↺ przywraca domyślną), „własna” — model dodany przez Ciebie, „brak ceny” — model z Twoich logów liczony jako $0 (wpisz stawkę, żeby go wycenić). Zapis trafia do ustawienia <code>tokenTracker.pricingOverrides</code>.</p>
  <p class="hint" id="pricing-file"></p>
  <div class="error" id="error"></div>
  <table>
    <thead><tr><th>Model</th><th class="num">Input</th><th class="num">Output</th><th class="num">Cache read</th><th class="num">Cache write</th><th>Cena</th><th></th></tr></thead>
    <tbody id="rows"></tbody>
  </table>
  <div class="bar">
    <button class="secondary" id="add">+ Dodaj model</button>
    <span class="spacer"></span>
    <span class="status" id="status"></span>
    <button class="secondary" id="discard">Odrzuć zmiany</button>
    <button id="save">Zapisz</button>
  </div>

<script nonce="${nonce}">
(function () {
  const vscode = acquireVsCodeApi();
  const FIELDS = ["inputPer1M", "outputPer1M", "cacheReadPer1M", "cacheWritePer1M"];
  let rows = [];
  let savedSnapshot = "[]";

  function snapshot() {
    return JSON.stringify(rows.map((row) => ({ model: row.model, pricing: row.pricing })));
  }

  /** Wiersze do zapisu — modele z logów, którym nie wpisano ceny, pomijamy. */
  function pricedRows() {
    return rows
      .filter((row) => row.pricing !== null)
      .map((row) => ({ model: row.model, pricing: row.pricing }));
  }

  function isValidPrice(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }

  function samePricing(a, b) {
    return FIELDS.every((field) => a[field] === b[field]);
  }

  function rowState(row) {
    if (row.pricing === null) return { label: "brak ceny", cls: "unpriced" };
    if (!row.defaultPricing) return { label: "własna", cls: "custom" };
    return samePricing(row.pricing, row.defaultPricing)
      ? { label: "domyślna", cls: "" }
      : { label: "zmieniona", cls: "changed" };
  }

  function validationError() {
    const names = new Set();
    for (const row of rows) {
      if (row.pricing === null) continue;
      const name = row.model.trim();
      if (name === "") return "Każdy model musi mieć nazwę.";
      if (names.has(name)) return "Model „" + name + "” występuje więcej niż raz.";
      names.add(name);
      if (!FIELDS.every((field) => isValidPrice(row.pricing[field]))) {
        return "Ceny modelu „" + name + "” muszą być liczbami ≥ 0.";
      }
    }
    return "";
  }

  function showError(message) {
    const el = document.getElementById("error");
    el.textContent = message;
    el.classList.toggle("active", message !== "");
  }

  function refreshStatus() {
    const dirty = snapshot() !== savedSnapshot;
    const error = validationError();
    document.getElementById("status").textContent = dirty ? "Niezapisane zmiany" : "";
    document.getElementById("save").disabled = !dirty || error !== "";
    document.getElementById("discard").disabled = !dirty;
    showError(dirty ? error : "");
  }

  function refreshRowState(tr, row) {
    const state = rowState(row);
    const cell = tr.querySelector(".state");
    cell.textContent = state.label;
    cell.className = "state " + state.cls;
    tr.querySelector(".reset").style.visibility = state.cls === "changed" ? "visible" : "hidden";
  }

  function renderRow(row, index) {
    const tr = document.createElement("tr");

    const nameCell = document.createElement("td");
    if (row.defaultPricing || row.fromLogs) {
      nameCell.textContent = row.model;
      nameCell.className = "model-name";
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "model-name";
      input.value = row.model;
      input.placeholder = "np. openai/gpt-6-astra";
      input.addEventListener("input", () => {
        row.model = input.value;
        input.classList.toggle("invalid", input.value.trim() === "");
        refreshStatus();
      });
      nameCell.appendChild(input);
    }
    tr.appendChild(nameCell);

    const priceInputs = FIELDS.map((field) => {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = row.pricing === null ? "" : String(row.pricing[field]);
      input.placeholder = row.pricing === null ? "—" : "";
      input.addEventListener("input", () => {
        if (row.pricing === null) {
          // Pierwsza wpisana stawka wycenia model; pozostałe startują od 0.
          row.pricing = { inputPer1M: 0, outputPer1M: 0, cacheReadPer1M: 0, cacheWritePer1M: 0 };
          priceInputs.forEach((other) => {
            other.placeholder = "";
            if (other !== input) other.value = "0";
          });
          refreshActions();
        }
        row.pricing[field] = input.value.trim() === "" ? NaN : Number(input.value);
        input.classList.toggle("invalid", !isValidPrice(row.pricing[field]));
        refreshRowState(tr, row);
        refreshStatus();
      });
      cell.appendChild(input);
      tr.appendChild(cell);
      return input;
    });

    const stateCell = document.createElement("td");
    stateCell.className = "state";
    tr.appendChild(stateCell);

    const actions = document.createElement("td");
    actions.className = "actions";
    const reset = document.createElement("button");
    reset.className = "icon reset";
    reset.textContent = "↺";
    reset.title = "Przywróć cenę domyślną";
    reset.addEventListener("click", () => {
      row.pricing = Object.assign({}, row.defaultPricing);
      render();
    });
    actions.appendChild(reset);
    const remove = document.createElement("button");
    remove.className = "icon";
    remove.textContent = "✕";
    remove.addEventListener("click", () => {
      if (row.fromLogs) {
        row.pricing = null;
      } else {
        rows.splice(index, 1);
      }
      render();
    });
    actions.appendChild(remove);
    function refreshActions() {
      remove.style.display = row.defaultPricing || row.pricing === null ? "none" : "";
      remove.title = row.fromLogs ? "Usuń cenę" : "Usuń model";
    }
    refreshActions();
    tr.appendChild(actions);

    refreshRowState(tr, row);
    return tr;
  }

  function render() {
    const body = document.getElementById("rows");
    body.innerHTML = "";
    rows.forEach((row, index) => body.appendChild(renderRow(row, index)));
    refreshStatus();
  }

  function load(message) {
    rows = message.rows.map((row) => ({
      model: row.model,
      pricing: row.pricing === null ? null : Object.assign({}, row.pricing),
      fromLogs: row.pricing === null,
      defaultPricing: row.defaultPricing ? Object.assign({}, row.defaultPricing) : undefined,
    }));
    savedSnapshot = snapshot();
    document.getElementById("pricing-file").textContent = message.pricingFile
      ? "Ceny domyślne uwzględniają plik cennika: " + message.pricingFile
      : "";
    render();
  }

  document.getElementById("add").addEventListener("click", () => {
    rows.push({ model: "", pricing: { inputPer1M: 0, outputPer1M: 0, cacheReadPer1M: 0, cacheWritePer1M: 0 } });
    render();
    const inputs = document.querySelectorAll("#rows input.model-name");
    inputs[inputs.length - 1].focus();
  });

  document.getElementById("discard").addEventListener("click", () => {
    vscode.postMessage({ type: "ready" });
  });

  document.getElementById("save").addEventListener("click", () => {
    vscode.postMessage({
      type: "save",
      rows: pricedRows(),
    });
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "load") {
      load(message);
    } else if (message.type === "saveError") {
      showError(message.error);
    }
  });

  vscode.postMessage({ type: "ready" });
})();
</script>
</body>
</html>`;
}
