# Tracker tokenów i kosztów LLM — research wykonalności i architektury

Cel researchu: odpowiedzieć, czy da się zbudować narzędzie pokazujące, ile tokenów i ile kosztów zostało zużyte na pojedyncze zadanie, całe zadanie lub jedną sesję czatu; czy da się zrobić z tego wtyczkę do IDE (VS Code, IntelliJ); oraz czy lepszą architekturą jest "skill" działający wewnątrz asystenta, czy samodzielna aplikacja zintegrowana z IDE.

Metoda: cztery równoległe agenty badawcze (model Sonnet, ze względu na brak dostępu do Haiku w tej sesji), każdy z osobnym obszarem. WebSearch w tej sesji był miejscami niedostępny (puste wyniki), więc większość ustaleń pochodzi z bezpośredniego `WebFetch` na znanych URL-ach (dokumentacja, GitHub, blogi). Każde ustalenie poniżej jest oznaczone jako zweryfikowane w tej sesji lub pochodzące z wiedzy ogólnej modelu (nie zweryfikowane). Reddit i profile w mediach społecznościowych (Facebook/Instagram) pozostały niedostępne dla `WebFetch` — jak w poprzednim researchu w tym projekcie — więc opinie społeczności pozyskano głównie z Hacker News (przez `hn.algolia.com`, publiczne API, skuteczne) oraz blogów dostawców.

## Odpowiedź w skrócie

1. **Czy da się zbudować taki tracker?** Tak — i to nie jest nisza teoretyczna, tylko sprawdzony, wielokrotnie zrealizowany pomysł. Najbliższy istniejący analog: `ccusage` (18.6k gwiazdek na GitHubie), plus fala nowszych narzędzi z 2026 r. (cc-ledger, tokenscope, goccc, Claud-ometer i inne).
2. **Czy da się zrobić wtyczkę do IDE (VS Code / IntelliJ)?** Tak — istnieją już działające przykłady: `vscode-claude-status` (VS Code), `Copilot Cost Lens` i `AI Coding Usage` (JetBrains Marketplace).
3. **Skill czy zewnętrzna aplikacja?** Ani jedno, ani drugie w czystej formie — **samodzielne, lekkie narzędzie parsujące lokalne logi sesji jest zdecydowanie dominującym i sprawdzonym wzorcem**, a wtyczka IDE powinna być tylko cienką warstwą UI nad tym samym silnikiem, nie osobną implementacją.

## Kluczowe odkrycie techniczne: skąd biorą się dane

Claude Code (a także Codex, Copilot CLI, Gemini CLI i inne) **zapisuje na dysku pełne logi sesji w formacie JSONL** — dla Claude Code jest to `~/.claude/projects/**/*.jsonl` — zawierające tokeny per żądanie, per model, z podziałem na input/output/cache. Konsekwencje:

- Nie jest potrzebne żadne API, klucz API ani połączenie sieciowe — dane czyta się lokalnie z dysku.
- Granularność "per zadanie" i "per sesja" jest naturalnie obecna w danych, bo log jest zapisywany turn-by-turn (krok po kroku).
- To dokładnie mechanizm, na którym oparty jest `ccusage` i każda znaleziona wtyczka do IDE.
- **Wyjątek — GitHub Copilot**: nie zapisuje takiego pliku. Dane kosztowe (jednostka wewnętrzna "AIC"/"nano-AIU") wyciekają wyłącznie przez nieudokumentowany, wewnętrzny "Chat Debug View" w VS Code — źródło niestabilne, może się zepsuć przy aktualizacji.
- **Cursor**: zamknięty fork VS Code — wtyczka VS Code najprawdopodobniej nie ma dostępu do jego danych sesji (nie zweryfikowano wprost, wysoka pewność na podstawie architektury Cursora).

## Przegląd istniejących narzędzi (zweryfikowane przez WebFetch)

| Narzędzie | Typ | Źródło danych | Granularność | Dojrzałość |
|---|---|---|---|---|
| **ccusage** (github.com/ryoppippi/ccusage) | CLI | Parsuje lokalne logi JSONL wielu narzędzi (Claude Code, Codex, Copilot CLI, Gemini CLI i ~10 innych) | dzienna/tygodniowa/miesięczna, per sesja, "bloki" 5h, per projekt, per model | 18.6k★, bardzo aktywny, najbliższy analog szukanego narzędzia |
| **LiteLLM** (github.com/BerriAI/litellm) | SDK + proxy/gateway | Przechwytuje ruch jako proxy | per projekt/użytkownik, spend tracking | 59.1k★, YC-backed, ciężka infrastruktura (trzeba przez nią routować cały ruch) |
| **Helicone** (helicone.ai) | Dashboard + gateway | Proxy / integracja SDK | per request, per sesja, per użytkownik | 6.1k★, pełny observability suite |
| **Langfuse** (langfuse.com) | Platforma observability | Instrumentacja SDK (trace/span) | hierarchiczna: trace > span (to właściwie model "zadanie w obrębie sesji") | 22k★+, enterprise-grade, raczej ciężkie na osobiste narzędzie |
| **vscode-claude-status** (github.com/long-910) | Wtyczka VS Code | Czyta `~/.claude/projects/` lokalnie, zero wywołań sieciowych do liczenia kosztu | per sesja, per zadanie (turn-by-turn) | Potwierdza, że podejście "czytaj logi" działa jako wtyczka IDE |
| **Copilot Cost Lens** (JetBrains, plugin 32274) | Wtyczka IntelliJ | Czyta lokalne logi Copilot i **Claude Code** | per model, per repo, dashboard z prognozą | Potwierdzenie via snippet wyszukiwania, nie pełny fetch strony |
| **cc-ledger, tokenscope, goccc, Claud-ometer i inne** (Show HN, 2026) | Samodzielne CLI/binarki | Parsują logi Claude Code | zwykle per sesja | Fala niedawnych, niezależnych narzędzi — wszystkie ten sam wzorzec |

Admin API Anthropic (`/v1/organizations/usage_report/messages`, `/v1/organizations/cost_report`) i analogiczne API OpenAI zostały sprawdzone i **odrzucone jako główne źródło danych**: wymagają klucza administratora organizacji (niedostępne na koncie indywidualnym), agregują dziennie/godzinnie bez pojęcia "sesji" ani "zadania" — nadają się co najwyżej do okresowej weryfikacji sumy, nie jako fundament narzędzia.

## Wykonalność wtyczki do IDE — szczegóły

**VS Code** (zweryfikowane): `window.createStatusBarItem` + `fs.watch`/file watcher na katalog logów — standardowe, dobrze udokumentowane API. Wtyczka nie musi "być" klientem AI — wystarczy czytać katalog logów narzędzia, które już działa obok niej. Rozwój w TypeScript/JavaScript, publikacja przez `vsce` jest szybka i mało formalna.

**JetBrains/IntelliJ** (zweryfikowane): `LocalFileSystem` + `VirtualFileListener`/`VFS_CHANGES` (lub czyste `WatchService` z Javy dla mniejszych opóźnień) do obserwacji zmian w pliku logu; `CustomStatusBarWidget` do wyświetlania licznika na żywo — to idiomatyczny, wspierany wzorzec, nie obejście. Rozwój w Kotlinie/Javie, budowa Gradle, `plugin.xml` — więcej ceremonii startowej niż VS Code (extension points, `@Service`, zasady "dynamic plugin"), ale porównywalne możliwości po wdrożeniu się. Publikacja do JetBrains Marketplace przechodzi automatyczny weryfikator, bez wąskiego gardła ręcznej akceptacji na każdy release.

## Rekomendacja architektoniczna

| Opcja | Ocena |
|---|---|
| Skill działający wewnątrz asystenta | ❌ Kosztuje tokeny kontekstu, działa tylko podczas żywej sesji, nie pozwala na analizę retrospektywną ani działanie "po sesji" |
| Pełna wtyczka IDE jako główny silnik logiki | ⚠️ Możliwa, ale najwyższy koszt utrzymania — osobna implementacja i wersjonowanie per IDE, mimo że w środku i tak czyta te same pliki |
| **Samodzielne narzędzie parsujące lokalne logi, z cienką nakładką UI per IDE** | ✅ Dominujący, wielokrotnie sprawdzony wzorzec |

Rekomendowany model: zbuduj **wspólny silnik** (parsowanie logów + cennik + agregacja per zadanie/sesja) jako samodzielną bibliotekę/CLI (wzorem `ccusage`), a **wtyczki IDE traktuj jako cienkie warstwy prezentacji** nad tym samym silnikiem (status bar w VS Code i w IntelliJ, każda tylko wywołuje ten sam kod/API lokalne). Tak działają najbardziej dojrzałe z istniejących rozwiązań (np. `claude-usage`, które dokłada sidebar VS Code na tym samym rdzeniu log-parsingu).

## Sentyment i wnioski ze społeczności (Hacker News)

Z wątku "Ask HN: How are people forecasting AI API costs for agent workflows?" (23 komentarze, w pełni pobrany):

- Nieprzewidywalny koszt to często problem dyscypliny (limity na retry/wywołania narzędzi), nie tylko brak narzędzia.
- **Koszt liczony per krok/zadanie w obrębie sesji** jest rekomendowany jako bardziej stabilna, użyteczna jednostka niż koszt per pojedyncze surowe wywołanie API.
- Powtarzający się postulat: koszt powinien być pierwszorzędnym wymiarem trace'u (możliwość prześledzenia skoku kosztu do konkretnego przepływu/zadania), a nie tylko zagregowaną liczbą.
- Część praktyków wolałaby płaską stawkę/subskrypcję zamiast w ogóle zajmować się granularnym trackingiem.

Żaden znaleziony wątek nie debatował wprost "wtyczka IDE vs samodzielna aplikacja vs skill" jako nazwanego kompromisu — powyższa rekomendacja architektoniczna jest wnioskiem z analizy tego, co faktycznie zbudowano (kilkanaście narzędzi na Show HN), a nie z jawnie wyrażonego konsensusu.

## Gdzie jest realna szansa na coś nowego (nie tylko powielenie)

Istniejące narzędzia mieszczą się w dwóch skrajnościach: proste CLI do log-parsingu (ccusage, cc-ledger) vs. ciężkie platformy observability wymagające instrumentacji kodu (Langfuse, Helicone). **Nikt nie połączył prostoty lokalnego log-parsingu z bogatą, wielo-narzędziową (cross-tool) obserwowalnością na poziomie zadania** — to konkretna, powtarzająca się w kilku raportach "biała plama". Budowanie w tym miejscu ma sens tylko, jeśli różnicujesz się przez:
- granularność per zadanie (nie tylko per sesja/dzień),
- normalizację między narzędziami (Claude Code + Copilot + inne w jednym widoku),
- UX (dashboard/status bar), a nie przez "nowy sposób dostępu do danych" — bo dostęp (czytanie lokalnych logów) jest już rozwiązanym problemem.

## Ograniczenia researchu

- Reddit (reddit.com, old.reddit.com) odmówił `WebFetch` w tej sesji — kandydaci społecznościowi nie zostali zweryfikowani bezpośrednio.
- Facebook/Instagram wymagają logowania — nie dały użytecznej treści.
- Część ustaleń (OpenAI Usage API, PromptLayer/ell, szczegóły publikacji JetBrains Marketplace, natywna komenda `/usage` w Claude Code) pochodzi z wiedzy ogólnej modelu, nie z bezpośredniego fetchowania w tej sesji — oznaczone wyżej jako niezweryfikowane tam, gdzie to istotne.
- WebSearch był niestabilny w tej sesji (część zapytań zwracała puste wyniki, część zadziałała poprawnie) — nie jest jasne, czy to błąd środowiska, czy przejściowy problem.
