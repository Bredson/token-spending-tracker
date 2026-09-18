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

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return String(tokens);
  }
  return `${(tokens / 1000).toFixed(1)}k`;
}
