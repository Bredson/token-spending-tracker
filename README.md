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

## Konfiguracja cennika

Wbudowana tabela cen (`packages/engine/src/pricing.json`, USD za 1M tokenów) rozpoznaje aktualne modele Anthropic, także w zapisie z bramek API (`anthropic/claude-sonnet-5[1m]`) i przez aliasy rodzin (`sonnet`, `opus`, `haiku`, `fable`). Modele bez ceny liczone są jako $ 0 i wypisywane w ostrzeżeniu na górze dashboardu.

Cenę można nadpisać lub dodać w ustawieniach VS Code (`settings.json`):

```jsonc
// wprost w ustawieniach — ma pierwszeństwo
"tokenTracker.pricingOverrides": {
  "openai/gpt-6-astra": { "inputPer1M": 1.25, "outputPer1M": 10, "cacheReadPer1M": 0.125, "cacheWritePer1M": 1.25 }
},
// albo z osobnego pliku o tym samym formacie (`~` jest rozwijane)
"tokenTracker.pricingFile": "~/.config/token-tracker/pricing.json"
```

Zmiana ustawień przeładowuje dane od razu, bez restartu VS Code. Niepoprawne wpisy (brak któregoś z czterech pól, wartość ujemna lub nieliczbowa) są pomijane z ostrzeżeniem.

## Pakowanie wtyczki (`.vsix`)

```bash
cd packages/vscode-extension
npm run package   # tworzy dist/token-tracker.vsix
```

Powstały plik `.vsix` można zainstalować lokalnie: `code --install-extension dist/token-tracker.vsix`, bez publikacji na Marketplace.

## Licencja

MIT — zobacz [`LICENSE`](LICENSE).
