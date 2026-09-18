# Token Tracker — możliwe kolejne kroki

Stan na 2026-09-18: MVP jest kompletne, przetestowane (81 testów) i działa u użytkownika jako
zainstalowany `.vsix`. Poniżej lista kierunków rozwoju — nieuszeregowana sztywno, ale pogrupowana
od najmniejszego wysiłku do największego. Żaden z tych punktów nie jest wymagany do działania
obecnej wersji — to propozycje, nie plan.

## Drobne usprawnienia (szybkie do zrobienia)

- **Filtrowanie/szukanie sesji na liście** — przy dłuższej historii lista sesji w dashboardzie
  może się wydłużyć; proste pole wyszukiwania po tytule/ID rozwiązałoby to bez zmiany architektury.
- **Link "otwórz projekt"** przy sesji — `projectPath` już jest w danych, brakuje tylko akcji
  (np. `vscode.commands.executeCommand("vscode.openFolder", ...)`) w panelu.
- **Ikona/status w status barze reagujący na tytuł sesji** — obecnie status bar pokazuje tylko
  koszt/tokeny bieżącego projektu; mógłby też pokazywać tytuł aktywnej sesji w tooltipie.
- **Test na realnym re-tytułowaniu w `watch()`** — obecne testy `ClaudeCodeSource` sprawdzają
  tytuły tylko przez `loadAll()`; warto dopisać test, że tytuł zmieniony w locie (np. użytkownik
  ręcznie nazwie sesję już po tym, jak dashboard był otwarty) trafia do kolejnego `postMessage`.

## Funkcje średniej wielkości

- **Konfigurowalny cennik przez ustawienie VS Code** — `pricing.json` jest już scalany z
  opcjonalnym plikiem custom (`loadPricingTable(customPath?)`), ale nie jest to jeszcze podpięte
  pod żadne ustawienie w `package.json` wtyczki (`contributes.configuration`). To domknęłoby
  punkt "Konfigurowalny/nadpisywalny cennik" z sekcji 3.3/7 `spec.md`.
- **Trwały cache na dysku** — dziś `loadAll()` zawsze odtwarza cały stan z logów przy starcie
  (~250 ms na 95 plikach u użytkownika, więc nie jest to pilne, ale przy dużo większej historii
  logów czas startu będzie rósł liniowo). Kandydat: zapis `UsageRecord[]` + kursory plików do
  `context.globalStorageUri`, z rewalidacją przez `mtime`/`size` przy starcie.
- **Publikacja w VS Code Marketplace** — obecnie instalacja jest ręczna (`.vsix` + "Install from
  VSIX..."). Wymagałoby: konta wydawcy (`vsce login`), uzupełnienia `repository` w
  `package.json` (dziś celowo pominięte — brak zdalnego repo git), i decyzji, czy projekt ma być
  publiczny.
- **Rozbicie kosztów per model na widoku "Rozbicie tokenów"** — dziś breakdown pokazuje sumę
  tokenów/kosztu dla sesji/zadania; przy zadaniach łączących kilka modeli (np. Sonnet + Haiku w
  jednej sesji) przydałby się podział per model.

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
