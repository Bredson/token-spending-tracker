# Changelog

## Nieopublikowane

- Komenda **Token Tracker: Edytuj cennik** — tabela cen wszystkich modeli z edycją w miejscu, dodawaniem własnych modeli i przywracaniem ceny domyślnej; zapis do `tokenTracker.pricingOverrides`. Modele z Twoich logów, które nie mają ceny, pojawiają się w tabeli ze stanem „brak ceny” — wystarczy wpisać stawkę.
- Import listy modeli do edytora cennika: wklej np. wynik `/models`, a rozpoznane modele spoza tabeli trafią do niej jako „brak ceny”. Bez połączeń sieciowych.
- Wbudowany cennik: `claude-opus-5-5`.

## 0.1.0 — 2026-09-24

Pierwsze wydanie publiczne.

- Pasek stanu z kosztem i tokenami bieżącego projektu (dziś), tooltip z aktywną sesją i modelami.
- Panel: przegląd dziś/tydzień/miesiąc z wykresem 30 dni, sesje z tytułami i filtrem, zadania, rozbicie tokenów i kosztu per model.
- Otwieranie projektu sesji w nowym oknie.
- Cennik modeli Anthropic z normalizacją ID (bramki API, aliasy rodzin) i ostrzeżeniem o modelach bez ceny.
- Ustawienia `tokenTracker.pricingOverrides` i `tokenTracker.pricingFile`, przeładowanie na żywo.
- Działa w pełni offline — brak połączeń sieciowych.
