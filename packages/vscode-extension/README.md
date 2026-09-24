# Token Tracker

Lokalne, w pełni offline śledzenie zużycia tokenów i kosztu **Claude Code** — per zadanie, sesja i projekt, w czasie rzeczywistym.

## Co to robi

- Czyta logi Claude Code z `~/.claude/projects/**/*.jsonl` (te same, z których korzysta sam Claude Code) i nasłuchuje ich zmian na bieżąco — bez pollingu, bez żadnych wywołań sieciowych.
- Pokazuje w pasku stanu VS Code bieżący koszt i liczbę tokenów dla aktywnego projektu: `$ 0.42 · 12.3k tok`. Tooltip objaśnia liczby, pokazuje ostatnio aktywną sesję i modele użyte dziś.
- Po kliknięciu otwiera panel z drill-downem: przegląd (dziś/tydzień/miesiąc + wykres 30 dni) → lista sesji → zadania w sesji → rozbicie tokenów (input/output/cache-read/cache-write) i kosztu **per model**.
- Sesje mają czytelne tytuły (te same, które Claude Code nadaje automatycznie lub które nadasz ręcznie), listę użytych modeli i pole filtrowania po tytule, ID lub modelu.
- Z widoku sesji otworzysz jej projekt w nowym oknie VS Code.
- Koszt liczony na podstawie wbudowanego cennika modeli Anthropic (USD za 1M tokenów, osobno input / output / cache read / cache write). Rozpoznaje też ID z bramek API (`anthropic/claude-sonnet-5[1m]`) i aliasy rodzin (`sonnet`, `opus`, `haiku`, `fable`). Modele bez ceny są wyraźnie oznaczone w panelu, żeby sumy nie wyglądały na pełne, gdy nie są.

## Ustawienia

| Ustawienie | Opis |
|---|---|
| `tokenTracker.pricingOverrides` | Cennik per model wpisany wprost w `settings.json`; ma pierwszeństwo przed plikiem i tabelą wbudowaną. |
| `tokenTracker.pricingFile` | Ścieżka do pliku JSON z cennikiem (`~` jest rozwijane). |

Format wpisu (ten sam w obu miejscach):

```jsonc
"tokenTracker.pricingOverrides": {
  "openai/gpt-6-astra": { "inputPer1M": 1.25, "outputPer1M": 10, "cacheReadPer1M": 0.125, "cacheWritePer1M": 1.25 }
}
```

Zmiana ustawień przeładowuje dane od razu, bez restartu. Niepoprawne wpisy są pomijane z ostrzeżeniem.

## Wymagania

- VS Code 1.85+.
- Logi Claude Code w standardowej lokalizacji `~/.claude/projects`.

## Prywatność

Wtyczka nie wysyła żadnych danych poza Twoją maszynę — cała analiza dzieje się lokalnie, z plików już obecnych na dysku. Nie ma telemetrii ani żadnych połączeń sieciowych.

## Znane ograniczenia

- Obsługiwane jest wyłącznie źródło danych Claude Code (architektura pozwala na dodanie kolejnych).
- Brak trwałego magazynu na dysku — po restarcie VS Code dane są przeliczane od nowa z logów źródłowych (przy ~100 plikach logów trwa to ułamek sekundy).
- Wbudowany cennik obejmuje modele Anthropic; modele innych dostawców uruchamiane przez bramki (np. `openai/...`) wyceń przez `tokenTracker.pricingOverrides`.

## Zgłoszenia i kod

[github.com/Bredson/token-spending-tracker](https://github.com/Bredson/token-spending-tracker) — licencja MIT.
