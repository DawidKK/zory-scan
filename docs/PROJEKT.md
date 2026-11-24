# Zory Scan: dokumentacja projektowa

Żywy dokument: co budujemy, po co i według jakich reguł. Aktualizujemy go przy każdej zmianie logiki biznesowej
(nowa funkcja, zmiana reguły, ważna decyzja). Szczegóły techniczne uruchomienia są w [README](../README.md),
a wygląd w [DESIGN.md](../DESIGN.md).

---

## 1. Cel projektu

Aplikacja webowa dla **urzędów (gmin, zarządców dróg)** do ewidencji **oświetlenia ulicznego** na mapie:
gdzie stoją słupy i oprawy oraz **jak są połączone w sieci energetycznej** (z której szafy i którego obwodu są zasilane).

Obecny etap: **proof of concept / MVP**, z danymi pokazowymi dla Żor.

Główne potrzeby użytkownika:
- zobaczyć na mapie całą sieć: szafy, obwody, linie kablowe, słupy;
- wprowadzać i poprawiać dane przez formularze (szafa, obwód, słup, oprawy);
- z numeru na tabliczce słupa (np. `84/I/8/2/1`) od razu wiedzieć, skąd jest zasilany;
- w terenie zeskanować kod QR na słupie i zobaczyć jego dane.

## 2. Użytkownicy i role

| Rola | Co robi | Gdzie |
|---|---|---|
| **Administrator** (urzędnik) | zarządza siecią: szafy, obwody, słupy, oprawy, kody QR; podgląd skanów | `/admin` |
| **Skaner** (pracownik w terenie) | skanuje QR na słupie i widzi dane słupa; skan zapisuje się w bazie | `/scan` (PWA) |

Logowanie przez dwa wspólne konta z env (`ADMIN_*`, `SCANNER_*`). Konto admina działa też w skanerze.
Nie ma kont imiennych (to jedna z rzeczy do zrobienia przed wdrożeniem produkcyjnym).

## 3. Słownik domeny

| Pojęcie | Znaczenie |
|---|---|
| **SOU** (szafa oświetlenia ulicznego, też SON / SO) | punkt zasilania i sterowania; z niej wychodzą obwody. Oznaczenie `SOU-84` |
| **Obwód** | linia oświetleniowa podpięta pod jedno zabezpieczenie w szafie. Zwykle **do ok. 6** na szafę. Oznaczenie cyframi rzymskimi: `Obw. I` |
| **Słup** | fizyczny słup z tabliczką i kodem QR. Ma lokalizację i miejsce w drzewie zasilania |
| **Oprawa** | lampa zamontowana na słupie. Na jednym słupie może być kilka (drogowa, chodnikowa, doświetlenie przejścia) |
| **Faza** | L1 / L2 / L3, czyli przewód fazowy, do którego podłączona jest oprawa |
| **Słup poprzedzający** („zasilany z”) | słup, od którego przychodzi kabel; brak = słup zasilany prosto z szafy |
| **Istniejący / projektowany** | stan słupa: już stoi albo jest w projekcie (na mapie biała pinezka i przerywana linia) |
| **Nieprzypisany** | słup bez obwodu (np. dodany przed wprowadzeniem sieci albo po usunięciu obwodu) |

## 4. Reguły biznesowe

### 4.1 Numeracja eksploatacyjna (tabliczki na słupach)

Pełne oznaczenie: **`<nr szafy>/<obwód rzymsko>/<numer słupa>`**, np. `84/I/8/2/1`.

- **Kierunek:** numer rośnie od szafy wzdłuż kabla: 1, 2, 3…
- **Odgałęzienia:** łamanie numerów. Od słupa `8` odchodzą `8/1`, `8/2`…, od `8/2` odchodzą `8/2/1`…
  „Dalej w linii” oznacza zwiększenie ostatniego segmentu (`8/2` → `8/3`), a „odgałęzienie” dopisanie `/1` (`8/2` → `8/2/1`).
- **Kilka opraw na słupie:** słup zachowuje numer, oprawy dostają indeksy literowe `a`, `b`… (`15a`, `15b`).
- **Numer jest unikalny w obrębie obwodu** (walidacja w API).
- **Numer jest podpowiadany, nigdy nie jest przenumerowywany automatycznie.** Dostawienie słupa w środku linii
  nie zmienia numerów pozostałych, bo numery w systemie muszą zgadzać się z fizycznymi tabliczkami.
- Unikalny **numer inwentarzowy** (np. `OU-14582`) jest osobnym polem, niezależnym od numeracji eksploatacyjnej.

### 4.2 Fazy

Oprawy podłącza się naprzemiennie, żeby równomiernie obciążyć sieć: **1 – L1, 2 – L2, 3 – L3, 4 – L1…**
Formularz i tryb rysowania podpowiadają fazę jako następną po ostatniej oprawie słupa poprzedzającego.
W panelu szafy widać bilans mocy na fazach dla każdego obwodu.

### 4.3 Topologia (drzewo zasilania)

- Każdy obwód to **drzewo**: korzenie to słupy zasilane z szafy, krawędź prowadzi od słupa poprzedzającego do słupa.
- Słup poprzedzający musi należeć do **tego samego obwodu**; **cykle są zabronione** (walidacja w API).
- Szafa słupa **wynika z obwodu** (słup nie ma osobnego pola szafy).
- **Usunięcie słupa:** słupy, które zasilał, są podpinane pod jego słup poprzedzający, żeby linia się nie zerwała.
- **Zmiana obwodu słupa:** słupy, które zasilał, zostają w starym obwodzie i są podpinane pod jego dotychczasowego poprzednika.
- **Usunięcie obwodu lub szafy:** słupy stają się nieprzypisane; nic nie jest kasowane.

### 4.4 Kabel

Przy słupie zapisujemy odcinek kabla **od słupa poprzedzającego (lub szafy)**: długość w metrach i typ (np. `YAKXS 4x35`).
Jeśli długość nie jest wpisana, UI pokazuje szacunek z odległości na mapie (oznaczony `≈`).
Na mapie kable to **proste odcinki** między słupami (bez rzeczywistego przebiegu).

### 4.5 Kody QR i skany

- Kod QR słupa zawiera link `https://<frontend>/scan?p=<id słupa>`, więc działa też aparatem systemowym.
- Skan zapisuje: słup, czas, user-agent i (opcjonalnie) lokalizację telefonu.
- Po skanie skaner pokazuje: oznaczenie słupa, szafę, obwód, numer, nr inwentarzowy, oprawy (faza, moc, typ), adres i treść.

## 5. Model danych

```
cabinets (SOU)   id, number (unikalny, tekst np. "84"), name, lat, lng, address, notes
circuits         id, cabinet_id, number (int, unikalny w szafie), description
points (słup)    id, name (opis/lokalizacja, opcjonalny), lat, lng, address, content (treść po skanie),
                 circuit_id?, parent_id? (słup poprzedzający), number? ("8/2/1"), inventory_id?,
                 status (existing|planned), cable_length?, cable_type?
fixtures         id, point_id, suffix? ("a"), phase? (L1|L2|L3), power_w?, model, position
scans            id, point_id, scanned_at, user_agent, lat?, lng?
```

Tabela słupów historycznie nazywa się `points` (projekt zaczynał jako „punkty z QR”). W UI mówimy „słup”.
Adres jest pobierany z Nominatim (OSM) przy zapisie, gdy obiekt jest nowy albo zmienił położenie.

## 6. Interfejs (najważniejsze zachowania)

- **Kolory:** szafa SOU = **niebieski** (wyłącznie dla szaf), słup/oprawa = **czerwony**,
  linie obwodów = osobna paleta **bez czerwieni i niebieskiego** (kolor wynika z numeru obwodu). Szczegóły w DESIGN.md.
- **Mapa:** przełącznik „Słup / SOU” decyduje, co tworzy kliknięcie. Po kliknięciu słupa podświetla się droga od szafy
  i słupy zasilane dalej. Numery słupów są widoczne od przybliżenia 17. Filtry: zakres (cała sieć / szafa / nieprzypisane),
  linie, numery, heatmapa skanów.
- **Tryb rysowania obwodu** (ołówek przy obwodzie): każde kliknięcie mapy tworzy słup z podpowiedzianym numerem i fazą;
  kliknięcie słupa obwodu zaczyna od niego odgałęzienie; „Od szafy” zaczyna nową linię z szafy; Esc kończy.
- **Wskazanie poprzednika:** przycisk „Wskaż” w formularzu słupa, potem kliknięcie słupa na mapie (ustawia też szafę i obwód).
- **Panel boczny:** zakładki „Sieć” (drzewo SOU › obwód › słupy) i „Ostatnie skany”.

## 7. Środowiska i dane

| | Lokalnie | Produkcja |
|---|---|---|
| Frontend | Vite `:5173` | Cloudflare Pages |
| Backend | Nest `:3000` | Render (free, usypia; keepalive w GitHub Actions) |
| Baza | SQLite `backend/local.db` (`DATABASE_URL=file:local.db`) | **Turso**, osobna baza |

- To są **dwie niezależne bazy**. Push wdraża kod i migracje, **nie dane**.
- Migracje (`backend/drizzle/*.sql`) wykonują się automatycznie przy starcie backendu.
- **Dane pokazowe:** `npm run db:seed` (`--reset` czyści sieć). 3 szafy, 13 obwodów, ok. 200 słupów wzdłuż prawdziwych
  ulic Żor (geometria OSM w `backend/src/db/seed-streets.json`). **Sieć jest fikcyjna.** Nazwane punkty i punkty ze skanami
  są zachowywane i podpinane do najbliższego słupa.

## 8. Decyzje

| Data | Decyzja | Powód |
|---|---|---|
| 2026-11-24 | Topologia jako drzewo (`parent_id` na słupie) zamiast samych atrybutów tekstowych | z jednego pola wynika numeracja, linie na mapie, droga zasilania i walidacja |
| 2026-11-24 | Słup i oprawa jako osobne encje od początku | tabliczka/QR są na słupie, a faza i moc należą do oprawy; na słupie bywa kilka opraw |
| 2026-11-24 | Numer zapisany w bazie, tylko podpowiadany | zgodność z fizycznymi tabliczkami; przenumerowanie ma być osobną, świadomą akcją |
| 2026-11-24 | Obwody numerowane liczbą, wyświetlane rzymsko (`I`, `II`) | zgodnie z praktyką na schematach (`84/I/…`) |
| 2026-11-24 | Szafy na niebiesko, oprawy na czerwono (wymaganie klienta); inny kształt znacznika SOU | czytelność, nie tylko kolor (daltonizm) |
| 2026-11-24 | Kable jako proste odcinki | wystarczające dla MVP; rzeczywisty przebieg kabla to osobna funkcja |

## 9. Backlog / pomysły

- Przenumerowanie odcinka lub obwodu z podglądem zmian.
- Import z istniejącej ewidencji (CSV / Excel / GIS) i eksport.
- Rzeczywisty przebieg kabla (polilinia z punktami załamania) i odcinki kabli jako osobna encja.
- Analiza awarii: „co zgaśnie”, gdy padnie zabezpieczenie obwodu albo kabel między słupami.
- Ostrzeżenie o niezbalansowanych fazach w obwodzie.
- Imienne konta użytkowników, role, historia zmian (kto, co, kiedy).
- Zgłoszenia awarii ze skanera (zdjęcie, opis) przypięte do słupa.
- Raporty: moc zainstalowana, liczba opraw wg typu, oprawy sodowe do wymiany na LED.

## 10. Historia zmian

- **2026-11-24:** sieć oświetleniowa: szafy SOU, obwody, słupy w drzewie zasilania, oprawy z fazami, numeracja
  eksploatacyjna, linie na mapie, tryb rysowania, drzewo sieci, dane w skanerze, seed danych pokazowych dla Żor.
- **Wcześniej (init):** PoC skanera QR + dashboard z mapą punktów, heatmapa skanów, reverse geocoding.
