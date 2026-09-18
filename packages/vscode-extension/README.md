# Token Tracker

Lokalne, w pełni offline śledzenie zużycia tokenów i kosztu **Claude Code** — per zadanie, sesja i projekt, w czasie rzeczywistym.

## Co to robi

- Czyta logi Claude Code z `~/.claude/projects/**/*.jsonl` (te same, z których korzysta sam Claude Code) i nasłuchuje ich zmian na bieżąco — bez pollingu, bez żadnych wywołań sieciowych.
- Pokazuje w pasku stanu VS Code bieżący koszt i liczbę tokenów dla aktywnego projektu: `$ 0.42 · 12.3k tok`.
- Po kliknięciu otwiera panel z drill-downem: przegląd (dziś/tydzień/miesiąc + wykres) → lista sesji → zadania w sesji → rozbicie tokenów (input/output/cache-read/cache-write) per zadanie.
- Koszt liczony na podstawie wbudowanego, konfigurowalnego cennika modeli Anthropic.

## Wymagania

- VS Code 1.85+.
- Logi Claude Code w standardowej lokalizacji `~/.claude/projects`.

## Prywatność

Wtyczka nie wysyła żadnych danych poza Twoją maszynę — cała analiza dzieje się lokalnie, z plików już obecnych na dysku.

## Znane ograniczenia (MVP)

- Obsługiwane jest wyłącznie źródło danych Claude Code (architektura pozwala na dodanie kolejnych w przyszłości).
- Brak trwałego magazynu na dysku — po restarcie VS Code dane są przeliczane od nowa z logów źródłowych (to i tak jedyne źródło prawdy).
