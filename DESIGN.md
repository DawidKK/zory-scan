# Design System — zory-scan

Inspiracja: **Linear**. Spokojny, gęsty, precyzyjny interfejs narzędziowy.
Zero „AI-lookа”: bez gradientów, glassmorphismu, fioletów, dużych zaokrągleń i kolorowych cieni.

---

## 1. Zasady

1. **Neutralna baza, oszczędne akcenty.** 90% UI to odcienie szarości. Kolory brandu tylko tam, gdzie niosą znaczenie (akcja, status, marker).
2. **Gęstość ponad dekorację.** Listy z wierszami zamiast kart, małe fonty, ciasne odstępy.
3. **Linie, nie cienie.** Podział przestrzeni przez 1px obramowania. Cienie tylko dla warstw pływających (dropdown, modal, popover).
4. **Szybkość.** Krótkie animacje (120–180 ms), brak efektów „wow”. Skróty klawiszowe w dashboardzie.
5. **Spójność.** Jeden zestaw tokenów (CSS variables) dla light i dark mode.

---

## 2. Kolory

### Akcenty brandu (z logo)

| Token | HEX | RGB | Zastosowanie |
|---|---|---|---|
| `--brand-red` | `#D83C32` | 216, 60, 50 | akcja główna (primary button), destrukcyjne akcje, błędy |
| `--brand-orange` | `#EDAD42` | 237, 173, 66 | markery na mapie, wyróżnienia, statusy „uwaga” |
| `--brand-teal` | `#85C8CC` | 133, 200, 204 | info, sukces, świeże skany, focus ring |

Warianty do tekstu (kontrast WCAG AA na jasnym tle). Pełne kolory brandu na białym tle są za jasne do tekstu:

| Token | HEX | Uwagi |
|---|---|---|
| `--brand-red-text` | `#B8322A` | tekst/linki w kolorze czerwonym |
| `--brand-orange-text` | `#9A6A14` | tekst statusu pomarańczowego |
| `--brand-teal-text` | `#2E7F84` | tekst statusu turkusowego |

Tła subtelne (badge, zaznaczenia) — kolor brandu z niską przezroczystością:

```css
--brand-red-soft:    rgb(216 60 50 / 0.10);
--brand-orange-soft: rgb(237 173 66 / 0.14);
--brand-teal-soft:   rgb(133 200 204 / 0.18);
```

### Kolory sieci oświetleniowej

| Token / wartość | Zastosowanie |
|---|---|
| `--sou-blue` `#2F6FDB` (`--sou-blue-strong` `#1F4FA8` zaznaczony) | **wyłącznie** szafy oświetlenia ulicznego (SOU): znacznik, etykieta, swatch |
| `--sou-blue-text` / `--sou-blue-soft` | tekst / tło w kolorze SOU |
| `--brand-red` | słupy i oprawy (pinezka) |
| Paleta obwodów `#E08A1E #2A9AA3 #3E9650 #8C7F22 #9A5B34 #5E6672 #4E8F7C #B7791F` | linie kablowe; kolor wynika z numeru obwodu (`lib/network.ts`). Celowo bez czerwieni i niebieskiego, żeby linie nie zlewały się z markerami |

### Neutralne — Light (domyślny)

| Token | HEX | Zastosowanie |
|---|---|---|
| `--bg` | `#FBFBFB` | tło aplikacji |
| `--bg-sidebar` | `#F4F4F5` | sidebar |
| `--bg-elevated` | `#FFFFFF` | panele, modale, dropdowny |
| `--bg-hover` | `#EFEFF0` | hover wiersza / elementu |
| `--bg-active` | `#E8E8EA` | zaznaczony element |
| `--border` | `#E6E6E8` | obramowania standardowe |
| `--border-strong` | `#D4D4D8` | inputy, separatory akcentowane |
| `--text` | `#1B1B1F` | tekst podstawowy |
| `--text-secondary` | `#5C5C66` | tekst pomocniczy |
| `--text-tertiary` | `#8B8B94` | placeholdery, metadane, ikony |

### Neutralne — Dark

| Token | HEX |
|---|---|
| `--bg` | `#0F0F10` |
| `--bg-sidebar` | `#141416` |
| `--bg-elevated` | `#1A1A1C` |
| `--bg-hover` | `#222225` |
| `--bg-active` | `#2A2A2E` |
| `--border` | `#26262A` |
| `--border-strong` | `#333338` |
| `--text` | `#EDEDEF` |
| `--text-secondary` | `#A0A0AB` |
| `--text-tertiary` | `#6B6B75` |

W dark mode warianty `*-text` = pełne kolory brandu (mają wystarczający kontrast na ciemnym tle).

---

## 3. Typografia

**Font:** [Montserrat](https://fonts.google.com/specimen/Montserrat) (Google Fonts), wagi 400 / 500 / 600.
Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
Liczby w tabelach/listach: `font-variant-numeric: tabular-nums;`

Rozmiary podniesione o 2px względem pierwotnej, bardzo gęstej skali (lepsza czytelność).

| Token | Rozmiar / line-height | Waga | Tracking | Zastosowanie |
|---|---|---|---|---|
| `--text-xs` | 13px / 18px | 500 | 0.01em | metadane, badge, timestampy |
| `--text-sm` | 14px / 20px | 500 | 0 | sidebar, wiersze list, labelki |
| `--text-base` | 15px / 22px | 400 | 0 | tekst podstawowy, inputy |
| `--text-md` | 17px / 24px | 500 | -0.01em | nagłówki sekcji |
| `--text-lg` | 20px / 28px | 600 | -0.015em | tytuł strony |
| `--text-xl` | 26px / 34px | 600 | -0.02em | ekran skanera (nazwa punktu), login |

Zasady:
- Nagłówki: waga 600, ujemny tracking. Nigdy 700+.
- Brak UPPERCASE poza drobnymi labelkami sekcji w sidebarze (11px, 500, tracking 0.04em, `--text-tertiary`).

---

## 4. Odstępy, rozmiary, zaokrąglenia

Skala 4px: `4, 8, 12, 16, 20, 24, 32, 48`.

| Element | Wartość |
|---|---|
| Wysokość wiersza listy | 36px |
| Wysokość przycisku / inputa | 28px (sm), 32px (md) — na mobile (skaner) 44px |
| Sidebar | 220px szerokości |
| Topbar strony | 44px wysokości |
| Radius — przyciski, inputy, badge | 6px |
| Radius — panele, modale, popovery | 8px |
| Radius — kropki statusu | 50% |
| Ikony | 14px (inline), 16px (sidebar, przyciski) — [Lucide](https://lucide.dev), stroke 1.75 |

---

## 5. Cienie i warstwy

Tylko dla elementów pływających:

```css
--shadow-popover: 0 4px 16px rgb(0 0 0 / 0.08), 0 0 0 1px var(--border);
--shadow-modal:   0 16px 48px rgb(0 0 0 / 0.16), 0 0 0 1px var(--border);
```

Overlay modala: `rgb(0 0 0 / 0.4)` (light), `rgb(0 0 0 / 0.6)` (dark). Bez blura.

---

## 6. Komponenty

### Przyciski
- **Primary:** tło `--brand-red`, tekst biały, hover — przyciemnienie o ~6%. Max jeden primary na widok.
- **Secondary:** tło `--bg-elevated`, border `--border-strong`, tekst `--text`, hover `--bg-hover`.
- **Ghost:** bez tła i obramowania, tekst `--text-secondary`, hover `--bg-hover`.
- **Danger:** jak secondary, tekst `--brand-red-text`; potwierdzenie w modalu z primary-red.

### Inputy / textarea / select
- Tło `--bg-elevated`, border `--border-strong`, radius 6px.
- Focus: border `--brand-teal-text` + ring `0 0 0 3px var(--brand-teal-soft)`.
- Label nad polem, `--text-sm`, `--text-secondary`.

### Listy (np. Ostatnie skany)
- Wiersze 36px, separator 1px `--border`, hover `--bg-hover`.
- Układ wiersza: kropka statusu · nazwa (`--text`) · metadane (`--text-tertiary`) · timestamp wyrównany do prawej (tabular-nums, format względny „2 min temu”).

### Badge / statusy
- Wysokość 20px, radius 6px, `--text-xs`, tło `*-soft`, tekst `*-text`.
- Kropka statusu 8px w pełnym kolorze brandu.

### Sidebar (dashboard)
- Tło `--bg-sidebar`, prawy border `--border`.
- Pozycje: ikona 16px w kolorze `--brand-teal-text` + label `--text-sm`, wysokość 28px, radius 6px.
- Aktywna pozycja: tło `--bg-active`, tekst `--text`. Nieaktywna: `--text-secondary`.
- Nawigacja: **Mapa**, **Skany**, **Punkty**, **QR Code**. Na dole: przełącznik motywu, wyloguj.

### Modal / panel boczny
- Edycja punktu w panelu bocznym (slide-over z prawej, 400px) — nie w pełnoekranowym modalu.
- Nagłówek panelu 44px z tytułem `--text-md` i przyciskiem zamknięcia (ghost).

### Toasty
- Dolny prawy róg, `--bg-elevated`, `--shadow-popover`, kropka koloru statusu po lewej. Auto-hide 3s.

---

## 7. Mapa

- **Biblioteka:** Leaflet + react-leaflet.
- **Kafelki:** standardowe OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), bez klucza API. Wymagana atrybucja „© OpenStreetMap contributors”. Te same kafelki w light i dark mode.
- **Układ strony Mapa:** mapa na środku, po prawej kolumna 320px z listą ostatnich skanów (kliknięcie = przelot do punktu). Na mobile: mapa 60% wysokości, lista pod spodem.
- **Marker punktu:** pinezka (kropla 26×34px) w `--brand-red`, biały obrys 1.5px i biały środek, delikatny cień. Zaznaczony: ciemniejsza czerwień `#9E2A22`, powiększony 1.2×. Nowy (niezapisany): `--brand-red` z przerywanym obrysem.
- **Marker świeżego skanu** (ostatnie 5 min): pulsująca turkusowa elipsa pod pinezką (`--brand-teal`).
- **Kontrolki Leaflet** przestylowane do tokenów (radius 6px, border `--border`, bez domyślnych cieni).
- Tooltip markera: nazwa punktu + adres (11px, `--text-tertiary`). Kliknięcie otwiera panel edycji.
- Panel punktu: blok „Adres” (Nominatim) i „Najbliższy punkt” (nazwa · odległość, klikalne), ikony w `--brand-teal-text`.
- **Filtry mapy:** pływające pudełko w prawym górnym rogu (`--bg-elevated`, border, radius 6px) z checkboxami. Checkbox 14px, zaznaczony = `--brand-teal-text` z białym ptaszkiem.
- **Szafa SOU:** niebieski zaokrąglony kwadrat 26×26px (`--sou-blue`, biały obrys 2px, biała błyskawica), stała etykieta `SOU-84` na niebieskim tle. Inny kształt niż pinezka słupa, żeby rozróżnienie nie opierało się tylko na kolorze.
- **Słup projektowany:** biała pinezka z przerywanym czerwonym obrysem; linia kabla do niego przerywana. Kilka opraw na słupie: czarny licznik w rogu pinezki.
- **Linie kablowe:** odcinek od słupa poprzedzającego (lub szafy) do słupa, 3px w kolorze obwodu. Po zaznaczeniu słupa droga zasilania i słupy zasilane dalej są pogrubione (5px), reszta przygaszona (30%).
- **Numery słupów:** stałe etykiety (12px, 600) od przybliżenia 17, z fazami opraw w `--text-tertiary`.
- **Tryb rysowania obwodu:** pasek u góry mapy z kolorem obwodu i podglądem kolejnego numeru, kursor krzyżyk, przerywany podgląd odcinka do kursora.
- **Heatmapa skanów:** gradient brandu turkus → pomarańcz → czerwień → `#9E2A22`. Waga punktu = liczba skanów względem najczęściej skanowanego.

---

## 8. Skaner (mobile PWA)

- Pełnoekranowy podgląd kamery, ciemne tło `#0F0F10` niezależnie od motywu.
- Ramka celownika: 4 narożniki 2px w kolorze `--brand-teal`, bez animowanej linii skanowania.
- Po skanie: bottom sheet (`--bg-elevated`, radius 12px u góry) z nazwą punktu (`--text-xl`), treścią (`--text-base`, zachowane łamania linii) i przyciskiem „Skanuj ponownie” (primary, 44px).
- Haptyka (`navigator.vibrate`) przy udanym skanie, jeśli dostępna.

---

## 9. Ruch

- Czas: 120 ms (hover, focus), 180 ms (panele, dropdowny), 240 ms (bottom sheet).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- `prefers-reduced-motion: reduce` → wyłączenie animacji poza zmianą opacity.

---

## 10. Czego unikamy

- Gradientów (tła, przyciski, tekst).
- Fioletów, neonów, „AI blue”.
- Dużych zaokrągleń (> 12px) i pigułkowych przycisków.
- Kart z cieniem jako podstawowego kontenera treści.
- Emoji w UI.
- Ilustracji i hero-sekcji w dashboardzie.
