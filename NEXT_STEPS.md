# Token Tracker — możliwe kolejne kroki

Stan na 2026-09-24: MVP jest kompletne, przetestowane (110 testów) i działa u użytkownika jako
zainstalowany `.vsix`. Poniżej lista kierunków rozwoju — nieuszeregowana sztywno, ale pogrupowana
od najmniejszego wysiłku do największego. Żaden z tych punktów nie jest wymagany do działania
obecnej wersji — to propozycje, nie plan.

## Zrobione po 2026-09-18

- **Normalizacja ID modeli w cenniku** — `anthropic/<model>[1m]`, aliasy `sonnet`/`opus`/`haiku`/`fable`
  i `<synthetic>` są wyceniane poprawnie; modele wciąż bez ceny trafiają do ostrzeżenia w dashboardzie
  zamiast być cicho liczone jako $ 0.
- **Konfigurowalny cennik przez ustawienia VS Code** — `tokenTracker.pricingFile` i
  `tokenTracker.pricingOverrides`, przeładowanie na żywo (patrz README).
- **Rozbicie kosztów per model** w widoku "Rozbicie tokenów" i lista modeli per zadanie/sesję.
- **Filtrowanie sesji** — pole nad tabelą sesji (tytuł, ID, model; bez rozróżniania wielkości liter),
  z licznikiem "N / M"; filtr zostaje aktywny przy odświeżeniu danych.
- **Przycisk "Otwórz projekt w nowym oknie"** w widoku sesji (`vscode.openFolder`, z ostrzeżeniem,
  gdy katalog z logów już nie istnieje).
- **Tooltip status baru** — objaśnienie liczb, tytuł (lub ID) ostatnio aktywnej sesji projektu
  i lista modeli użytych dziś.
- **Re-tytułowanie sesji w locie** — test w `watch()` wykazał, że sam wpis `custom-title` nie
  powiadamiał silnika (dashboard odświeżał tytuł dopiero przy kolejnej odpowiedzi modelu);
  źródło emituje teraz pustą partię jako sygnał zmiany metadanych, a silnik powiadamia słuchaczy.

## Funkcje średniej wielkości

- **Trwały cache na dysku** — dziś `loadAll()` zawsze odtwarza cały stan z logów przy starcie
  (~250 ms na 95 plikach u użytkownika, więc nie jest to pilne, ale przy dużo większej historii
  logów czas startu będzie rósł liniowo). Kandydat: zapis `UsageRecord[]` + kursory plików do
  `context.globalStorageUri`, z rewalidacją przez `mtime`/`size` przy starcie.
- **Publikacja w VS Code Marketplace** — obecnie instalacja jest ręczna (`.vsix` + "Install from
  VSIX..."). Wymagałoby: konta wydawcy (`vsce login`), uzupełnienia `repository` w
  `package.json` (dziś celowo pominięte — brak zdalnego repo git), i decyzji, czy projekt ma być
  publiczny.
- **Wbudowane ceny modeli spoza Anthropic** (`openai/gpt-6-astra` itd. uruchamiane przez bramkę) —
  dziś do wpisania ręcznie w `tokenTracker.pricingOverrides`; wymagałoby wiarygodnego źródła cen
  per bramka, bo ceny bramki mogą różnić się od publicznych.

## Kierunki architektoniczne (większy wysiłek, ale niezablokowane obecnym projektem)

- **Kolejne `UsageSource`** — GitHub Copilot, Codex CLI, Gemini CLI. Interfejs `UsageSource`
  (`packages/engine/src/types.ts`) już to przewiduje; wymaga tylko nowego parsera per źródło,
  analogicznie do `ClaudeCodeSource`. `getSessionTitles?()` jest już opcjonalne w interfejsie,
  więc źródła bez własnych tytułów sesji nie muszą nic implementować.
- **Plugin IntelliJ** — silnik (`packages/engine`) jest celowo niezależny od `vscode`, więc dałoby
  się go reużyć w JVM-owym środowisku przez most (np. proces Node wywoływany z pluginu, albo
  przepisanie silnika na Kotlin — do rozstrzygnięcia, jeśli temat będzie aktualny).
- **Telemetria/synchronizacja w chmurze** — świadomie poza zakresem MVP (spec.md, sekcja 7);
  jeśli kiedyś potrzebna, wymagałaby osobnej decyzji o prywatności (dziś wtyczka nie robi żadnych
  wywołań sieciowych — to jedna z twardych właściwości obecnego designu, do świadomego złamania
  tylko za zgodą użytkownika).

## Otwarte pytania z `spec.md` (sekcja 8), wciąż nierozstrzygnięte

- Czy `message.content` przy wywołaniach narzędzi (tool use) może zawierać więcej niż jeden blok
  `usage` w jednej linii `type: "assistant"` (np. równoległe tool calls) — do potwierdzenia na
  większej próbce logów, jeśli pojawią się nietypowe sumy kosztów.
- Czy tabelę cenową warto docelowo importować z zewnętrznego, utrzymywanego źródła (np. projekt
  `ccusage`, o ile licencja na to pozwala) zamiast ręcznie aktualizować `pricing.json` przy każdym
  nowym modelu Anthropic.
