/**
 * Znormalizowany rekord zużycia — spec.md sekcja 3.1.
 * Jedyny format danych, jaki silnik zna wewnętrznie; każdy parser źródła
 * musi produkować dane w tym kształcie.
 */
export interface UsageRecord {
  id: string;
  source: string;
  sessionId: string;
  taskId: string;
  timestamp: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  costUsd: number;
  projectPath: string;
}

export interface Disposable {
  dispose(): void;
}

/**
 * Kontrakt źródła danych — spec.md sekcja 4.
 * Każda implementacja (Claude Code, w przyszłości Copilot/Codex/...) musi
 * spełniać dokładnie ten interfejs bez zmian w silniku ani w UI.
 */
export interface UsageSource {
  readonly id: string;
  readonly displayName: string;

  detect(): Promise<boolean>;

  loadAll(): Promise<UsageRecord[]>;

  watch(onUpdate: (newRecords: UsageRecord[]) => void): Disposable;
}
