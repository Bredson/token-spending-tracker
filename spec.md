# Token Tracker — specyfikacja projektu

Status: draft v0.1
Podstawa: `TOKEN-TRACKER-RESEARCH.md`, decyzja architektoniczna: **Droga B** (głęboki, jedno-narzędziowy dashboard per-zadanie w VS Code, z pluggable interfejsem parsera pod przyszłą rozbudowę cross-tool).

Ten dokument jest źródłem prawdy o **czym jest ten projekt i jak ma działać**, niezależnie od tego, kto (lub co) go czyta — programista czy model językowy pracujący nad implementacją. Zdania są celowo dosłowne i jednoznaczne; definicje pojęć są wiążące dla całego projektu i dla wszystkich przyszłych planów/kodu, które się do niego odwołują.

---

## 1. Cel projektu

Zbudować narzędzie, które pokazuje użytkownikowi **ile tokenów i ile kosztu zużyło pojedyncze zadanie, cała sesja czatu, dzień/tydzień/miesiąc oraz projekt**, na podstawie lokalnych logów Claude Code, bezpośrednio w VS Code (status bar + panel z drill-downem), bez żadnego wywołania sieciowego do liczenia kosztu.

### 1.1 Cele (Goals)

- G1: Pokazać zużycie tokenów/kosztu z granularnością **per zadanie** (pojedynczy turn/krok w rozmowie), nie tylko per sesja czy per dzień.
- G2: Umożliwić **drill-down**: od zagregowanej liczby (np. koszt dzisiejszy) do konkretnego zadania/sesji, które go spowodowało.
- G3: Działać w czasie rzeczywistym — licznik aktualizuje się w trakcie trwania sesji Claude Code, bez ręcznego odświeżania.
- G4: Zero konfiguracji sieciowej — wszystkie dane pochodzą z lokalnych plików na dysku użytkownika.
- G5: Architektura silnika (parsowanie + model danych + agregacja) ma być **niezależna od źródła logów** poprzez jeden, ustalony interfejs (`UsageSource`, patrz sekcja 4), tak aby dodanie drugiego narzędzia (np. Copilot, Codex) w przyszłości nie wymagało przepisania silnika ani UI — tylko dopisania nowej implementacji interfejsu.

### 1.2 Nie-cele (Non-goals) dla MVP

- NG1: Obsługa więcej niż jednego źródła logów (Copilot, Codex, Gemini CLI) — **nie wchodzi w zakres MVP**. Interfejs ma to *umożliwiać* w przyszłości, ale MVP implementuje wyłącznie jedno źródło: Claude Code.
- NG2: Wtyczka do JetBrains/IntelliJ — poza zakresem MVP. Silnik ma być napisany tak, by dało się go później opakować w plugin IntelliJ, ale ten plugin nie jest częścią tego planu.
- NG3: Wysyłanie jakichkolwiek danych poza maszynę użytkownika (telemetria, chmura, zdalny dashboard).
- NG4: Edycja/modyfikacja logów Claude Code — narzędzie jest tylko-do-odczytu wobec `~/.claude/projects/**/*.jsonl`.

---

## 2. Terminologia (wiążąca dla całego projektu)

| Termin | Definicja |
|---|---|
| **Record (rekord zużycia)** | Jedna znormalizowana jednostka danych opisująca zużycie tokenów w jednym kroku rozmowy (jedno wywołanie modelu). Patrz sekcja 3.1 na dokładny schemat pól. |
| **Task (zadanie)** | Jeden "turn" w rozmowie — jedna wymiana użytkownik→asystent, obejmująca wszystkie wywołania modelu/narzędzi potrzebne do wygenerowania jednej odpowiedzi. W logach Claude Code odpowiada to jednemu logicznemu krokowi konwersacji (może obejmować wiele rekordów, jeśli w trakcie jednej odpowiedzi model wywołał kilka razy narzędzia). |
| **Session (sesja)** | Cały ciąg zadań w ramach jednego uruchomienia Claude Code w danym katalogu projektu, od pierwszej do ostatniej wiadomości, identyfikowany przez `sessionId` obecny w logu JSONL. |
| **Source (źródło)** | Konkretne narzędzie AI, którego logi są parsowane (np. `claude-code`). Każde źródło implementuje interfejs `UsageSource`. |
| **Parser** | Komponent w ramach danego `Source`, który zamienia surowy format logu (np. JSONL) na listę `Record`. |
| **Engine (silnik)** | Warstwa niezależna od UI: rejestr źródeł, parsowanie, agregacja, cennik. Pakowana jako osobny moduł/biblioteka, używana przez wtyczkę VS Code (i potencjalnie przyszłe UI). |
| **Cost model (model cenowy)** | Tabela cen per token (input/output/cache-read/cache-write) per model, używana do przeliczenia `Record` na koszt w USD. |

---

## 3. Model danych

### 3.1 `Record` — znormalizowany rekord zużycia

To jest **jedyny format danych**, jaki silnik zna wewnętrznie. Każdy parser źródła musi produkować dane w tym kształcie — silnik nigdy nie widzi surowego formatu JSONL bezpośrednio.

```typescript
interface UsageRecord {
  id: string;              // unikalny identyfikator rekordu (np. hash pliku+offsetu)
  source: string;           // id źródła, np. "claude-code"
  sessionId: string;        // identyfikator sesji z logu
  taskId: string;           // identyfikator zadania/turn (patrz 3.2 na regułę grupowania)
  timestamp: string;        // ISO 8601, moment zakończenia wywołania modelu
  model: string;            // nazwa modelu, np. "claude-sonnet-5"
  tokensInput: number;      // tokeny wejściowe (bez cache)
  tokensOutput: number;     // tokeny wyjściowe
  tokensCacheRead: number;  // tokeny odczytane z cache (tańsze)
  tokensCacheWrite: number; // tokeny zapisane do cache
  costUsd: number;          // koszt w USD, wyliczony przez cost model w momencie parsowania
  projectPath: string;      // ścieżka katalogu projektu, z którego pochodzi sesja
}
```

Reguły:
- Wszystkie pola liczbowe są nieujemne.
- `costUsd` jest zawsze wyliczane przez silnik (sekcja 3.3), parser nigdy nie liczy kosztu samodzielnie — parser dostarcza wyłącznie surowe liczby tokenów i nazwę modelu.
- Jeśli źródło nie rozróżnia cache read/write (inne narzędzie niż Claude Code), pola te przyjmują wartość `0` — pole musi istnieć zawsze, nawet jeśli nieużywane.

### 3.2 Grupowanie w `Task` i `Session`

- `taskId` grupuje jeden lub więcej `UsageRecord` powstałych w odpowiedzi na jedną wiadomość użytkownika (np. wywołanie modelu + kilka wywołań narzędzi w ramach jednej odpowiedzi = kilka rekordów, ten sam `taskId`).
- `sessionId` grupuje wszystkie `taskId` z jednego uruchomienia narzędzia w danym katalogu projektu.
- Silnik musi umieć zagregować dane na 4 poziomach: `Task`, `Session`, przedział czasowy (dzień/tydzień/miesiąc), `projectPath`. Każda agregacja to suma pól tokenowych + suma `costUsd` dla wszystkich `UsageRecord` należących do danej grupy.

### 3.3 Cost model (cennik)

- Statyczna tabela: `model -> { inputPer1M, outputPer1M, cacheReadPer1M, cacheWritePer1M }` w USD.
- Przechowywana jako plik konfiguracyjny w silniku (np. `pricing.json`), możliwa do nadpisania przez użytkownika (własny plik w ustawieniach wtyczki) — na wypadek zmiany cen przez dostawcę lub nowego modelu nieobecnego jeszcze w domyślnej tabeli.
- Jeśli model nie występuje w tabeli: silnik zwraca `costUsd = 0` dla tego rekordu i zgłasza ostrzeżenie (widoczne w UI jako "nieznany model — koszt nieprzeliczony"), **nigdy nie przerywa działania**.

---

## 4. Interfejs źródła danych (`UsageSource`) — pluggable parser

To jest **kluczowy punkt rozszerzalności** całego projektu (patrz G5). Droga B implementuje tylko jedną konkretną implementację (`ClaudeCodeSource`), ale każda przyszła implementacja (Copilot, Codex, Gemini CLI, IntelliJ-side źródło) musi spełniać dokładnie ten kontrakt, bez zmian w silniku czy UI.

```typescript
interface UsageSource {
  /** Stały, unikalny identyfikator źródła, np. "claude-code". */
  id: string;

  /** Nazwa czytelna dla człowieka, np. "Claude Code". */
  displayName: string;

  /**
   * Sprawdza, czy dane tego źródła są dostępne na tej maszynie
   * (np. czy istnieje katalog logów). Nie rzuca wyjątków.
   */
  detect(): Promise<boolean>;

  /**
   * Jednorazowe, pełne wczytanie historii i zwrócenie wszystkich
   * dotąd zapisanych UsageRecord. Wywoływane raz przy starcie.
   */
  loadAll(): Promise<UsageRecord[]>;

  /**
   * Zaczyna obserwować źródło (np. file watcher) i wywołuje callback
   * z listą WYŁĄCZNIE nowych/zmienionych UsageRecord od ostatniego wywołania
   * (nigdy nie zwraca ponownie tego, co już zwrócił) — patrz 4.1 o inkrementalności.
   * Zwraca funkcję/obiekt do zatrzymania obserwacji (Disposable).
   */
  watch(onUpdate: (newRecords: UsageRecord[]) => void): Disposable;
}
```

### 4.1 Wymóg inkrementalności (twardy wymóg, nie sugestia)

Znany, udokumentowany problem istniejącego narzędzia konkurencyjnego (`vscode-claude-status`, issue #47): parser czytał i parsował **całą** historię logów przy każdym zdarzeniu file-watchera, bez debounce, co przy dużym katalogu logów (2.4 GB / 5160 plików) zawieszało i crashowało edytor.

Aby uniknąć tego samego błędu, `UsageSource.watch()` **musi**:
- śledzić pozycję (offset/kursor) ostatnio odczytaną w każdym pliku źródłowym i przy kolejnym zdarzeniu czytać **tylko przyrost** (append) od tego miejsca, nigdy cały plik od nowa;
- stosować debounce (rekomendowane: 300–500 ms) na zdarzeniach file-watchera, tak by seria szybkich zapisów (typowa podczas strumieniowania odpowiedzi modelu) skutkowała jednym przetworzeniem, nie serią;
- nigdy nie skanować plików, które nie zmieniły się od ostatniego odczytu (sprawdzenie mtime/rozmiaru przed otwarciem pliku).

### 4.2 MVP: `ClaudeCodeSource`

Jedyna implementacja `UsageSource` w zakresie tego planu.

- Źródło danych: `~/.claude/projects/**/*.jsonl`. Każdy plik `.jsonl` to jedna sesja; nazwa pliku (bez rozszerzenia) jest jednocześnie wartością pola `sessionId` obecnego w każdej linii.
- Każda linia to jeden obiekt JSON reprezentujący jedno zdarzenie w rozmowie. Pola istotne dla parsera (zweryfikowane na realnym pliku logu):
  - `type`: rozróżnia rodzaj zdarzenia. Wartości istotne dla nas: `"user"` i `"assistant"`. Inne wartości (`"queue-operation"`, `"attachment"`, `"last-prompt"`, `"mode"`, ...) są pomijane przez parser (nie tworzą `UsageRecord` ani nie definiują granicy zadania).
  - `sessionId`: identyfikator sesji (string, zgodny z nazwą pliku).
  - `uuid`: identyfikator wpisu. **Nieużywany do grupowania w zadania** (patrz niżej, dlaczego chain-walking po `parentUuid` został odrzucony).
  - `origin.kind`: pole obecne **tylko** na niektórych wpisach `type: "user"`. Wartość `"human"` oznacza, że to rzeczywista wiadomość wpisana przez człowieka. Brak tego pola (lub inna wartość) oznacza, że wpis `type: "user"` jest w rzeczywistości wynikiem wywołania narzędzia (`message.content` zawiera blok `tool_result`) albo treścią wstrzykniętą systemowo (np. instrukcje skilla) — API Anthropic konwencjonalnie przesyła wyniki narzędzi jako rolę `"user"`, więc **nie każdy wpis `type: "user"` to nowe zadanie**.
  - `timestamp`: ISO 8601, obecny w każdym wpisie.
  - `cwd`: ścieżka katalogu roboczego w momencie zapisu wpisu — używana jako `projectPath`.
  - Dla wpisów `type: "assistant"`: pole `message.model` (nazwa modelu, np. `"claude-sonnet-5"`) oraz `message.usage` zawierające `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` — dokładnie te cztery liczby mapują się 1:1 na pola `tokensInput`, `tokensOutput`, `tokensCacheWrite`, `tokensCacheRead` rekordu `UsageRecord` (sekcja 3.1).
- **Reguła grupowania w `taskId` (zweryfikowana empirycznie na dwóch realnych plikach logów)**: pierwotny pomysł grupowania przez chain-walking po `uuid`/`parentUuid` z użyciem `isSidechain` okazał się błędny — w praktyce większość wpisów `type: "user"` to zwrotki `tool_result`, nie nowe wiadomości człowieka, a jeden plik potrafi mieć dziesiątki takich wpisów w ramach jednego zadania. Sprawdzono też `promptId` jako potencjalny klucz grupujący — odrzucony, bo zmienia się częściej niż raz na wiadomość człowieka (z nieznanych, wewnętrznych powodów Claude Code), więc nie odpowiada 1:1 pojęciu zadania.
  Poprawna, prostsza reguła: parser przetwarza plik **sekwencyjnie, linia po linii** (kolejność zapisu w pliku = kolejność chronologiczna) i utrzymuje zmienną `currentTaskId`. Gdy napotka wpis `type: "user"` z `origin.kind === "human"` → `currentTaskId` = `uuid` tego wpisu (nowe zadanie). Każdy kolejny wpis (w tym ten właśnie napotkany, oraz wszystkie `type: "assistant"` i wszystkie `type: "user"` będące w rzeczywistości `tool_result`, niezależnie od `isSidechain`) jest przypisywany do aktualnego `currentTaskId`, dopóki nie pojawi się kolejny wpis `type: "user"` z `origin.kind === "human"`. Zużycie subagentów (`isSidechain: true`) jest w ten sposób naturalnie wliczane do zadania nadrzędnego, bez potrzeby specjalnej obsługi.
  Skrajny przypadek: jeśli w pliku pojawi się wpis `type: "assistant"` zanim wystąpił jakikolwiek wpis z `origin.kind === "human"` (nie zaobserwowano tego w próbkach, ale nie można wykluczyć), `taskId` przyjmuje wartość zastępczą `` `${sessionId}:pre` ``.
- `detect()` sprawdza istnienie katalogu `~/.claude/projects`.

---

## 5. Silnik (Engine)

Pakowany jako osobny moduł TypeScript (npm workspace / osobny folder w repo), **niezależny od `vscode` API** — nie importuje niczego z pakietu `vscode`. Dzięki temu jest reużywalny poza wtyczką VS Code (np. w przyszłym CLI albo pluginie IntelliJ przez most/serwer).

Odpowiedzialności silnika:
1. Rejestr zarejestrowanych `UsageSource` (w MVP: lista jednoelementowa).
2. Wywołanie `loadAll()` + `watch()` na starcie, scalenie strumieni z wielu źródeł do jednego wewnętrznego magazynu `UsageRecord[]` (w pamięci; trwałość na dysku poza zakresem MVP — dane i tak są odtwarzalne z logów źródłowych przy każdym starcie).
3. Funkcje agregujące: `aggregateByTask()`, `aggregateBySession()`, `aggregateByPeriod(day|week|month)`, `aggregateByProject()`.
4. Zastosowanie cost model (sekcja 3.3) do każdego `UsageRecord` w momencie jego przyjęcia do magazynu.
5. Publiczne API zwracające gotowe struktury do wyświetlenia (sumy, listy, drill-down po `taskId`/`sessionId`) — UI nie robi żadnej logiki agregującej samodzielnie.

---

## 6. UI — rozszerzenie VS Code

### 6.1 Status bar

- Jeden `StatusBarItem` pokazujący koszt bieżącej sesji (aktywnego katalogu projektu) w czasie rzeczywistym, format: `$ 0.42 · 12.3k tok`.
- Kliknięcie otwiera panel dashboardu (sekcja 6.2).
- Aktualizacja następuje w reakcji na `onUpdate` z silnika (sekcja 4), bez pollingu.

### 6.2 Panel dashboardu (Webview)

Widoki, od ogółu do szczegółu (drill-down zgodnie z G2):
1. **Przegląd**: koszt/tokeny dziś / w tym tygodniu / w tym miesiącu, wykres kosztu w czasie.
2. **Lista sesji**: sesje posortowane malejąco po czasie, z kosztem/tokenami sumarycznymi per sesja.
3. **Widok sesji**: po kliknięciu sesji — lista zadań (`Task`) wewnątrz niej, z kosztem per zadanie oraz modelem użytym w danym zadaniu.
4. **Rozbicie tokenów**: dla wybranego zadania/sesji — podział input/output/cache-read/cache-write, z zaznaczeniem oszczędności dzięki cache.

### 6.3 Niefunkcjonalne wymagania UI

- Brak wywołań sieciowych — wtyczka nie kontaktuje żadnego API do liczenia kosztu (dozwolone jedynie opcjonalne przyszłe sprawdzenie aktualizacji cennika, poza zakresem MVP).
- Panel webview musi działać przy dużej liczbie rekordów (dziesiątki tysięcy) bez zauważalnego zamrożenia UI — agregacja z sekcji 5 ma odciążać webview z ciężkich obliczeń (webview tylko renderuje gotowe sumy).

---

## 7. Zakres MVP (podsumowanie)

W zakresie:
- Silnik z interfejsem `UsageSource` (sekcja 4) i jedną implementacją `ClaudeCodeSource`.
- Inkrementalne, debounce'owane śledzenie logów (sekcja 4.1).
- Agregacja 4-poziomowa (task/session/period/project).
- Status bar + panel webview z drill-downem (sekcja 6).
- Konfigurowalny/nadpisywalny cennik (sekcja 3.3).

Poza zakresem (odłożone na przyszłość, ale niezablokowane architekturą):
- Kolejne `UsageSource` (Copilot, Codex, Gemini CLI).
- Plugin IntelliJ.
- Trwały magazyn danych na dysku (obecnie: recompute z logów przy starcie).
- Telemetria/synchronizacja w chmurze.

---

## 8. Otwarte pytania (do rozstrzygnięcia podczas implementacji, nie blokują planu)

- Domyślne źródło tabeli cenowej (ręcznie utrzymywana vs. import z publicznego źródła np. z projektu `ccusage`, o ile ma licencję na to pozwalającą).
- Format `message.content` przy odpowiedziach zawierających wywołania narzędzi (tool use) — czy jedna linia `type: "assistant"` może zawierać kilka `usage` (np. przy równoległych tool calls), czy zawsze dokładnie jeden — do potwierdzenia na większej próbce logów podczas implementacji parsera, nie zmienia to jednak kształtu `UsageRecord`.

### Rozstrzygnięte (zweryfikowane na realnym pliku `~/.claude/projects/**/*.jsonl`)

- Struktura pól `sessionId`, `uuid`/`parentUuid`, `isSidechain`, `timestamp`, `cwd`, `message.usage`, `message.model` — opisana w sekcji 4.2.
- Reguła grupowania w `taskId`, w tym traktowanie zużycia subagentów jako części zadania nadrzędnego — opisana w sekcji 4.2.
