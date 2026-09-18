# Źródła wiedzy o AI, LLM-ach i budowaniu agentów — ranking

## Podsumowanie

Do budowania agentów rekomenduję przede wszystkim **Hugging Face Agents Course, Anthropic Engineering, Hamela Husaina i Chip Huyen**. Do bieżącej praktyki — **Simona Willisona**. Do codziennej pracy z AI bez programowania — **Ethana Mollicka**. Na YouTube — **Andreja Karpathy’ego** do fundamentów.

Najlepszy zestaw to kilka uzupełniających się źródeł, nie jedna platforma. Kurs daje strukturę, artykuły techniczne uczą projektowania i ewaluacji, blogi pomagają śledzić zmiany, a społeczności służą do zadawania konkretnych pytań.

## Zakres i ograniczenia researchu

Research podzielono między trzech agentów na modelu Sonnet, po nieudanych próbach uruchomienia tańszego Haiku. Koordynator dodatkowo odczytał wybrane artykuły, m.in. Hamela Husaina, Chip Huyen i Ethana Mollicka.

- Wyszukiwarka zwracała puste wyniki. Działał bezpośredni odczyt części stron.
- Reddit był niedostępny do oceny treści, a odczyt Facebooka nie udostępnił materiałów. Instagram nie został bezpośrednio sprawdzony.
- Część stron kanałów YouTube prowadziła do strony zgody Google. Dostępne były niektóre strony filmów i odsyłacze na stronach autorów.
- Oceny opierają się na odczytanych artykułach, stronach repozytoriów, programach kursów lub ograniczonych materiałach o kanałach. Nie ukończono kursów, nie obejrzano całych kanałów i nie uruchomiono przykładów kodu.
- Jest to **ranking wartościowej shortlisty, nie pełny audyt internetu**. Dobór źródeł ograniczała dostępność narzędzi i znajomość ich adresów.
- Nie potwierdzono aktualnych cen płatnych ofert. Brak dostępu do źródła nie oznacza jego niskiej jakości.
- Dokument utrwala wynik rozmowy; zapis pliku nie obejmował ponownej weryfikacji źródeł.

## Metodologia scoringu

Każda składowa ma skalę 0–5.

| Kryterium | Waga | Co premiuje |
|---|---:|---|
| P — praktyczność | 30% | Przykłady, kod, zastosowania i konkretne procedury |
| R — wiarygodność | 25% | Uzasadnienia, doświadczenie i transparentność ograniczeń |
| D — głębokość | 20% | Wyjaśnienie mechanizmów i kompromisów, nie tylko demo |
| F — aktualność | 15% | Przydatność do obecnych narzędzi i praktyk |
| S — sygnał/szum | 10% | Mało marketingu, clickbaitu i powierzchownych porad |

**Wynik = 6P + 5R + 4D + 3F + 2S**, maksymalnie 100 punktów.

To ocena redakcyjna, nie pomiar naukowy. Różnice kilku punktów nie powinny przesądzać o wyborze. Ranking premiuje praktykę techniczną i budowanie agentów; dla osoby nietechnicznej kolejność będzie inna. Status weryfikacji należy czytać niezależnie od wyniku. Niska ocena aktualności może odzwierciedlać wiek sprawdzonego materiału lub brak potwierdzenia jego aktualizacji, a nie niską jakość zasad, które przedstawia.

## 1. Ranking źródeł do nauki i praktycznej pracy

| # | Źródło | Wynik | P/R/D/F/S | Największa wartość |
|---|---|---:|---|---|
| 1 | [Hamel Husain](https://hamel.dev/blog/posts/evals/) | 86/100 | 5/4/5/2/5 | Ewaluacja: jak sprawdzić, czy aplikacja AI naprawdę działa |
| 2 | [Chip Huyen — Agents](https://huyenchip.com/2025/01/07/agents.html) | 86/100 | 5/4/5/2/5 | Projektowanie agentów jako systemów |
| 3 | [Simon Willison](https://simonwillison.net/) | 85/100 | 5/4/3/5/4 | Bieżąca praktyka LLM, narzędzia, eksperymenty i bezpieczeństwo |
| 4 | [Hugging Face Agents Course](https://huggingface.co/learn/agents-course/unit0/introduction) | 83/100 | 5/4/4/3/4 | Uporządkowane wejście w tworzenie agentów |
| 5 | [Anthropic — Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) | 82/100 | 5/4/4/2/5 | Kiedy używać agenta, a kiedy prostszego workflow |
| 6 | [Ethan Mollick — One Useful Thing](https://www.oneusefulthing.org/p/getting-started-with-ai-good-enough) | 78/100 | 5/4/3/2/5 | Codzienna praca z AI: kontekst, iteracja i kontrola wyniku |
| 7 | [Sekurak — AI](https://sekurak.pl/tag/ai/) | 78/100 | 3/5/3/5/4 | Polskojęzyczne źródło o zagrożeniach i bezpieczeństwie AI |
| 8 | [OpenAI Cookbook](https://github.com/openai/openai-cookbook) | 76/100 | 5/4/3/2/4 | Przykłady implementacyjne i notebooki do adaptacji |
| 9 | [AI_devs](https://www.aidevs.pl/) | 76/100 | 4/4/4/4/2 | Polska, zadaniowa ścieżka nauki dla programistów |

### Hamel Husain — ewaluacja zamiast poprawiania promptów na wyczucie

**Sprawdzony materiał:** [Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/), 29 marca 2024.

Artykuł pokazuje testy, analizę rzeczywistych błędów, ocenę przez ludzi i kalibrację automatycznych sędziów. Omawia m.in. tanie testy konkretnych funkcji, rozbudowywanie przykładów na podstawie zaobserwowanych porażek, rejestrowanie interakcji oraz porównywanie ocen automatycznych z ludzkimi.

- **Dla kogo:** twórcy aplikacji LLM i agentów, którzy chcą wyjść poza prototyp.
- **Zaleta:** konkretne przykłady, kod i procedury diagnostyczne.
- **Ograniczenie:** sprawdzony tekst pochodzi z 2024 roku; nie jest instrukcją najnowszego SDK ani kompletnym przeglądem benchmarków agentowych.
- **Język i dostęp:** angielski, publiczny artykuł.

### Chip Huyen — architektura, planowanie i ograniczenia agentów

**Sprawdzony materiał:** [Agents](https://huyenchip.com/2025/01/07/agents.html), 7 stycznia 2025.

Tekst omawia dobór narzędzi, planowanie, oddzielenie planu od wykonania, kontrolę działań o istotnych skutkach oraz ocenę poprawności. Uwzględnia koszty, czas wykonania, liczbę działań i rejestrowanie wywołań narzędzi.

- **Dla kogo:** programiści i projektanci systemów AI.
- **Zaleta:** uczy rozumowania o całym systemie, nie tylko o pętli wywołującej model.
- **Ograniczenie:** materiał koncepcyjny z 2025 roku; aktualne API należy sprawdzać osobno.
- **Język i dostęp:** angielski, publiczny artykuł.

### Simon Willison — regularne źródło praktycznych obserwacji

**Źródło:** [simonwillison.net](https://simonwillison.net/).

Łączy eksperymenty z narzędziami z krytycznym spojrzeniem na ograniczenia modeli, prompt injection i pracę z kodem generowanym przez AI.

- **Dla kogo:** praktykujący programiści i osoby techniczne śledzące rozwój LLM.
- **Zaleta:** praktyczne doświadczenia i zainteresowanie ograniczeniami, nie tylko premierami.
- **Ograniczenie:** perspektywa jednego autora, różna głębokość wpisów; nie zastępuje kursu od zera. Autor często opisuje również własne narzędzia.
- **Język i dostęp:** angielski, publiczny blog, dostępny RSS.

### Hugging Face Agents Course — uporządkowany start

**Sprawdzony materiał:** [wprowadzenie i program kursu](https://huggingface.co/learn/agents-course/unit0/introduction).

Program obejmuje podstawy agentów, używanie narzędzi, cykl działania i obserwacji oraz frameworki takie jak smolagents, LlamaIndex i LangGraph. Zawiera zadania i projekt związany z oceną działania agentów.

- **Dla kogo:** osoby znające podstawy Pythona i LLM.
- **Zaleta:** struktura nauki zamiast zbioru niepowiązanych tutoriali.
- **Ograniczenie:** odczyt programu nie jest audytem jakości każdej lekcji; część przykładów wiąże się z ekosystemem Hugging Face.
- **Język i dostęp:** sprawdzona wersja angielska; materiały bezpłatne. Ćwiczenia mogą wymagać kont i zasobów obliczeniowych.

### Anthropic Engineering — agent czy workflow?

**Sprawdzony materiał:** [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents), opublikowany 19 grudnia 2024.

Najważniejsza lekcja: nie każda automatyzacja wymaga autonomicznego agenta. Materiał porządkuje wzorce takie jak prompt chaining, routing, równoległe wykonanie, orchestrator–workers i evaluator–optimizer.

- **Dla kogo:** programiści i liderzy techniczni wybierający architekturę aplikacji LLM.
- **Zaleta:** zachęca do prostoty i dodawania złożoności dopiero wtedy, gdy jest uzasadniona.
- **Ograniczenie:** materiał producenta modeli; część przykładów wiąże się z jego ekosystemem. To odniesienie architektoniczne, nie gwarancja aktualności porad narzędziowych.
- **Język i dostęp:** angielski, publiczny artykuł.

### Ethan Mollick — codzienna praca z AI

**Sprawdzony materiał:** [Getting started with AI: Good enough prompting](https://www.oneusefulthing.org/p/getting-started-with-ai-good-enough), 24 listopada 2024.

Zaleca rozpoczynanie od znanych sobie zadań, dostarczanie kontekstu i przykładów, proszenie o warianty oraz poprawianie wyniku w rozmowie. Znajomość zadania pomaga wykrywać przekonująco brzmiące błędy.

- **Dla kogo:** osoby nietechniczne, pracownicy wiedzy, biznes i edukacja.
- **Zaleta:** praktyczny sposób uczenia się pracy z AI bez nadmiernego komplikowania promptów.
- **Ograniczenie:** nie jest to źródło do implementowania infrastruktury agentów.
- **Język i dostęp:** angielski; odczytany artykuł był dostępny. Warunków dostępu do całej publikacji nie zweryfikowano.
- **Wskazówka:** dla osoby nietechnicznej przesunąłbym to źródło na pierwsze miejsce.

Ocena 78/100 uwzględnia odczyt pełnego artykułu przez koordynatora. Zastępuje wstępne 75/100 agenta, oparte jedynie na fragmencie strony głównej.

### Sekurak — bezpieczeństwo AI po polsku

**Sprawdzony materiał:** [strona tagu AI](https://sekurak.pl/tag/ai/).

Źródło uzupełniające o prompt injection, zagrożeniach związanych z agentami i bezpieczeństwie narzędzi AI.

- **Dla kogo:** security, IT i programiści integrujący agentów z innymi systemami.
- **Zaleta:** perspektywa bezpieczeństwa i język polski.
- **Ograniczenie:** nie zastąpi kursu budowania aplikacji; ton części publikacji bywa alarmistyczny. Odczyt strony tagu nie oznacza audytu wszystkich artykułów.
- **Język i dostęp:** polski, publiczne materiały redakcyjne.

### OpenAI Cookbook — przykłady do konkretnego zadania

**Sprawdzony materiał:** [repozytorium OpenAI Cookbook](https://github.com/openai/openai-cookbook).

Zbiór notebooków i przykładów zastosowań API, m.in. związanych z wywoływaniem funkcji, embeddingami i RAG.

- **Dla kogo:** programiści pracujący z API OpenAI.
- **Zaleta:** materiał do adaptacji, kiedy znasz już zadanie implementacyjne.
- **Ograniczenie:** silne powiązanie z dostawcą. Nie potwierdzono aktualności całego repozytorium ani nie uruchomiono przykładów; sprawdzaj wersje bibliotek i modeli.
- **Język i dostęp:** angielski; repozytorium publiczne. Wywołania API mogą być płatne.

### AI_devs — zadaniowa nauka dla programistów po polsku

**Sprawdzony materiał:** [publiczna strona programu](https://www.aidevs.pl/).

Program obejmuje m.in. tool calling, MCP, RAG, pamięć, multimodalność, ewaluację, bezpieczeństwo i wdrażanie agentów.

- **Dla kogo:** programiści szukający uporządkowanej ścieżki i zadań.
- **Zaleta:** polski język i nacisk na praktykę.
- **Ograniczenie:** ocena dotyczy publicznego programu, nie płatnych lekcji, wsparcia ani wyników absolwentów. Strona jest również materiałem sprzedażowym.
- **Język i dostęp:** polski, płatny kurs; aktualnej ceny nie potwierdzono.

## 2. YouTube — rekomendacje z oceną wstępną

Weryfikacja objęła strony autorów, odsyłacze i dostępne informacje o materiałach, nie obejrzenie całych kanałów. Wyniki mają niższą pewność niż oceny odczytanych artykułów.

| Źródło | Ocena wstępna | P/R/D/F/S | Do czego polecam | Zastrzeżenie |
|---|---:|---|---|---|
| [Andrej Karpathy](https://www.youtube.com/@AndrejKarpathy) | 85/100 | 4/5/5/2/5 | Zrozumienie LLM i fundamentów sieci neuronowych | Długie materiały, nie głównie wdrażanie agentów |
| [Dave Ebbelaar](https://www.youtube.com/@daveebbelaar) | 75/100 | 5/3/3/4/3 | Projekty AI i automatyzacje biznesowe | Powiązanie z ofertą szkoleniowo-konsultingową; ocena głównie na podstawie strony firmy |

### Materiał na start

Karpathy: [Intro to Large Language Models](https://www.youtube.com/watch?v=zjkBMFhNj_g).

Kanał Karpathy’ego potwierdzono przez [stronę autora](https://karpathy.ai/), a kanał Dave’a Ebbelaar przez [Datalumina](https://www.datalumina.com/). Samo potwierdzenie kanału nie jest potwierdzeniem jakości każdego filmu.

James Briggs, Cole Medin i kanał AI Engineer pozostali kandydatami do dalszej weryfikacji. Nie przyznano im punktów wyłącznie na podstawie rozpoznawalności nazw.

## 3. Reddit — kandydaci bez punktacji

Poniższe zastosowania to wskazówki oparte na ogólnej znajomości społeczności, nie wynik przeglądu ich aktualnych wątków w tej sesji.

| Społeczność | Po co tam zaglądać |
|---|---|
| [r/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/) | Lokalne modele, inference, sprzęt, porównania i eksperymenty |
| [r/LLMDevs](https://www.reddit.com/r/LLMDevs/) | Problemy implementacyjne aplikacji LLM |
| [r/AI_Agents](https://www.reddit.com/r/AI_Agents/) | Projekty agentowe i narzędzia; konieczny filtr autopromocji |
| [r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/) | Praktyka pracy z konkretnym produktem i zgłaszane problemy |

Reddit służy do znajdowania hipotez, przykładów i problemów innych osób. Twierdzenia typu „model X jest najlepszy” należy sprawdzać na własnych zadaniach. Najcenniejsze posty zawierają kod, konfigurację, dane testowe i opis porażek.

Brak punktacji oznacza brak wystarczających dowodów w tym researchu, nie negatywną ocenę społeczności.

## 4. Facebook, Instagram, LinkedIn i X

Nie uzyskano wystarczającej próbki treści do rzetelnego rankingu konkretnych profili i grup.

- **Facebook:** próba odczytu nie udostępniła treści. Nie potwierdzono konkretnej grupy AI_devs; nie należy traktować zgadywanego adresu jako rekomendacji.
- **Instagram:** nie wykonano osobnej weryfikacji. Nie można z tego wnioskować, że wszystkie profile są niedostępne lub mało wartościowe.
- **LinkedIn/X:** wzmianki o autorach w biogramach na innych stronach nie zastępują przeglądu ich profili.
- **Zrozumieć AI i Bunkier AI:** brak wystarczającej weryfikacji w tej sesji; bez punktacji.

Do nauki pracy z AI traktowałbym te platformy jako kanały odkrywania autorów i materiałów, nie samodzielną podstawę nauki.

### Filtr jakości autora

1. Czy pokazuje cały proces, czy tylko efekt?
2. Czy podaje kod, konfigurację albo procedurę do odtworzenia?
3. Czy mówi o kosztach, błędach i ograniczeniach?
4. Czy materiały prowadzą do czegoś więcej niż sprzedaż kursu lub paczki promptów?
5. Czy odróżnia działające demo od systemu, którego jakość sprawdzono na rzeczywistych zadaniach?

## 5. Inne miejsca i kandydaci do dalszej weryfikacji

- [Hacker News](https://news.ycombinator.com/) — dyskusje branżowe i krytyczne spojrzenie na narzędzia. Odczyt strony głównej nie wystarczył do porównywalnej oceny jakości dyskusji.
- [Latent Space](https://www.latent.space/) — newsletter i rozmowy o inżynierii AI. Zweryfikowano stronę, ale nie dostatecznie szeroką próbkę materiałów. Nie utożsamiano jej automatycznie z osobnym kanałem YouTube AI Engineer.
- [DeepLearning.AI Short Courses](https://www.deeplearning.ai/short-courses/) — kandydat do dalszego sprawdzenia; katalog, aktualność i warunki dostępu nie zostały zweryfikowane w tym researchu.

Nie przeniesiono do finalnego rankingu punktacji zaproponowanej przez agentów dla źródeł, których treść była zbyt słabo zweryfikowana.

## 6. Rekomendowany zestaw i kolejność korzystania

Dla osoby, która chce pracować z LLM-ami i budować agentów:

1. **Hugging Face Agents Course** — przejdź uporządkowaną ścieżkę.
2. **Anthropic: Building Effective Agents** — wybierz architekturę i sprawdź, czy agent jest potrzebny.
3. **Hamel Husain** — naucz się mierzyć jakość i analizować błędy.
4. **Chip Huyen** — zrozum projektowanie systemu, narzędzia i ograniczenia.
5. **Simon Willison** — regularnie śledź zmiany i doświadczenia praktyków.

Uzupełnienia:

- **Mollick:** codzienna praca, również bez programowania.
- **Karpathy:** fundamenty LLM.
- **OpenAI Cookbook:** konkretne zadania implementacyjne.
- **Sekurak:** bezpieczeństwo i perspektywa polskojęzyczna.
- **AI_devs:** płatna ścieżka zadaniowa po polsku, po osobnej ocenie programu i ceny.
- **Reddit:** konkretne pytania, problemy i hipotezy do samodzielnego sprawdzenia.

Nie warto próbować śledzić dwudziestu kanałów jednocześnie. Lepszy jest niewielki zestaw źródeł oraz własny projekt, na którym można sprawdzać zdobytą wiedzę.

> Dobre źródło uczy nie tylko „jak uruchomić agenta”, ale też „jak wykryć, że działa źle, ile kosztuje i kiedy nie dawać mu autonomii”.
