# Token Tracker

Monorepo lokalnej, offline'owej wtyczki VS Code do śledzenia zużycia tokenów i kosztu **Claude Code** per zadanie/sesja/projekt.

Pełna specyfikacja funkcjonalna: [`spec.md`](spec.md).

## Struktura

- `packages/engine` — czysty TypeScript, zero zależności od `vscode`; interfejs `UsageSource` (obecnie jedna implementacja: `ClaudeCodeSource`), cennik, agregacja, silnik spinający wszystko w całość.
- `packages/vscode-extension` — wtyczka VS Code: status bar + panel dashboardu (webview). Zobacz [README pakietu](packages/vscode-extension/README.md) po opis funkcji od strony użytkownika.

## Rozwój

```bash
npm install
npm run build   # build wszystkich pakietów (workspaces)
npm test        # testy wszystkich pakietów
```

Uruchomienie wtyczki w trybie deweloperskim: otwórz repo w VS Code i naciśnij **F5** (konfiguracja `.vscode/launch.json` buduje pakiety i startuje Extension Development Host).

## Pakowanie wtyczki (`.vsix`)

```bash
cd packages/vscode-extension
npm run package   # tworzy dist/token-tracker.vsix
```

Powstały plik `.vsix` można zainstalować lokalnie: `code --install-extension dist/token-tracker.vsix`, bez publikacji na Marketplace.

## Licencja

MIT — zobacz [`LICENSE`](LICENSE).
