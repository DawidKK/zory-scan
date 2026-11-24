# Zory Scan

Ewidencja oświetlenia ulicznego dla urzędów: mapa szaf SOU, obwodów, słupów i opraw oraz skaner QR w terenie. Etap: PoC/MVP.

**Zanim zaczniesz feature, przeczytaj [docs/PROJEKT.md](docs/PROJEKT.md)**: cel, słownik domeny, reguły biznesowe
(numeracja `84/I/8/2/1`, fazy, topologia), model danych, decyzje i backlog. Wygląd: [DESIGN.md](DESIGN.md).
Uruchomienie i deploy: [README.md](README.md).

## Stack

- `frontend/`: React 19, Vite, PWA, Leaflet (react-leaflet), React Query, lucide-react. Czysty CSS na tokenach (`src/styles/`).
- `backend/`: NestJS 11, Drizzle ORM, SQLite (libsql) lokalnie / Turso na produkcji. Walidacja: class-validator.

## Komendy

```bash
npm run dev:api                      # backend :3000 (migracje przy starcie)
npm run dev:web                      # frontend :5173 (proxy /api → :3000)
cd backend && npm run typecheck      # tsc --noEmit
cd frontend && npm run typecheck     # tsc -b
cd backend && npm run db:generate    # migracja SQL ze zmian w src/db/schema.ts (commitujemy plik)
cd backend && npm run db:seed -- --reset   # dane pokazowe (fikcyjna sieć w Żorach)
```

## Mapa kodu

- `backend/src/db/schema.ts`: tabele `cabinets`, `circuits`, `points` (= słupy), `fixtures`, `scans`.
- `backend/src/network/`: szafy i obwody (CRUD, synchronizacja listy obwodów), `label.ts` (oznaczenie słupa).
- `backend/src/points/`: słupy + oprawy, walidacja drzewa (ten sam obwód, brak cykli, unikalny numer).
- `frontend/src/lib/network.ts`: logika domeny po stronie UI: indeks sieci, numeracja, podpowiedzi numeru/fazy, statystyki, kolory obwodów.
- `frontend/src/pages/admin/MapPage.tsx`: mapa, tryby (dodawanie, rysowanie obwodu, wskazywanie poprzednika).
- `frontend/src/components/`: `PointPanel` (formularz słupa), `CabinetPanel` (szafa + obwody), `NetworkTree`.

## Zasady pracy

- UI, komunikaty błędów API i dokumentacja **po polsku**. W UI mówimy „słup”, nie „punkt”.
- Trzymaj się DESIGN.md (Linear-like, gęsto, bez gradientów). Niebieski tylko dla SOU, czerwony dla słupów,
  palety obwodów bez czerwieni i niebieskiego.
- Reguły domeny walidujemy w API (nie tylko w formularzu). Nie przenumerowujemy słupów automatycznie.
- Zmiana schematu: edytuj `schema.ts` → `npm run db:generate` → commit pliku SQL. Nie edytuj wygenerowanych migracji ręcznie.
- Lokalna baza (`backend/local.db`) i produkcyjna (Turso) to **osobne bazy**. Nie uruchamiaj niczego na produkcji
  bez wyraźnej zgody. Eksperymenty na kopii `local.db` (np. w katalogu tymczasowym), nie na oryginale.
- Po zmianie logiki biznesowej **zaktualizuj docs/PROJEKT.md** (reguły, model, decyzje z datą, historia zmian).
