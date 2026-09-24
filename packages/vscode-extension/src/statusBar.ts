import type { UsageRecord } from "@token-tracker/engine";

/**
 * Formatuje tekst status bara — spec.md sekcja 6.1: `"$ 0.42 · 12.3k tok"`.
 * Czysta funkcja (bez zależności od `vscode`), żeby dało się ją testować bez
 * uruchamiania Extension Development Host.
 */
export function formatStatusBarText(records: UsageRecord[]): string {
  let costUsd = 0;
  let tokens = 0;

  for (const record of records) {
    costUsd += record.costUsd;
    tokens += record.tokensInput + record.tokensOutput + record.tokensCacheRead + record.tokensCacheWrite;
  }

  return `$ ${costUsd.toFixed(2)} · ${formatTokenCount(tokens)} tok`;
}

/**
 * Tooltip status bara: co znaczą liczby, która sesja jest aktywna (ostatnio
 * aktywna w dzisiejszych rekordach projektu) i jakie modele były dziś użyte.
 */
export function formatStatusBarTooltip(
  records: UsageRecord[],
  sessionTitles: Map<string, string>,
): string {
  const lines = [`Token Tracker — koszt i tokeny Claude Code w tym projekcie dziś: ${formatStatusBarText(records)}`];

  const latest = records.reduce<UsageRecord | undefined>(
    (best, record) => (best === undefined || record.timestamp > best.timestamp ? record : best),
    undefined,
  );
  if (latest === undefined) {
    lines.push("Aktywna sesja: brak sesji dziś");
  } else {
    const title = sessionTitles.get(latest.sessionId);
    lines.push(`Aktywna sesja: ${title ? `${title} (${latest.sessionId})` : latest.sessionId}`);
    const models = [...new Set(records.map((record) => record.model))].sort();
    lines.push(`Modele dziś: ${models.join(", ")}`);
  }

  lines.push("Kliknij, aby otworzyć dashboard.");
  return lines.join("\n");
}

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return String(tokens);
  }
  return `${(tokens / 1000).toFixed(1)}k`;
}
