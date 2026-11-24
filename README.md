# Zory Scan

PoC: skaner kodów QR (PWA) + dashboard administratora z mapą punktów.

- `frontend/`: React, Vite, PWA, Leaflet (OSM), React Query
- `backend/`: NestJS, Drizzle ORM, SQLite lokalnie / Turso na produkcji
- Design: [DESIGN.md](DESIGN.md)

## Jak to działa

1. Admin (`/admin`) klika na mapie → tworzy punkt (nazwa, treść, współrzędne).
2. Każdy punkt (słup) ma kod QR z linkiem `https://<frontend>/scan?p=<id>` (zakładka **QR Code**).
3. Użytkownik loguje się do skanera (`/scan`), skanuje kod → widzi treść punktu, skan zapisuje się w bazie.
4. Admin widzi listę ostatnich skanów i punkty na mapie (świeżo zeskanowane pulsują na turkusowo).

### Sieć oświetleniowa

Model: **szafa SOU → obwody (zwykle do ~6) → słupy → oprawy**.

- Słup ma: obwód (z niego wynika szafa), słup poprzedzający („zasilany z”, pusty = prosto z szafy), numer w obwodzie, nr inwentarzowy, stan (istniejący / projektowany), długość i typ kabla.
- Numeracja jak na tabliczkach: `84/I/8/2/1` = SOU-84, obwód I, słup 8/2/1. Kolejne słupy w linii: 1, 2, 3… Odgałęzienie od słupa 8: 8/1, 8/2… Formularz podpowiada numer, ale **nie przenumerowuje** istniejących słupów, żeby dane zgadzały się z tabliczkami.
- Oprawa ma: indeks (a, b przy kilku oprawach na słupie), fazę L1/L2/L3 (podpowiadana rotacyjnie), moc i typ.
- Na mapie: przełącznik „Słup / SOU” decyduje, co dodaje kliknięcie. Ikona ołówka przy obwodzie (panel szafy albo zakładka „Sieć”) włącza **rysowanie obwodu**: każde kliknięcie dodaje kolejny słup z numerem i fazą, a kliknięcie istniejącego słupa zaczyna odgałęzienie od niego.
- Walidacja w API: poprzednik musi być w tym samym obwodzie, bez cykli, numer unikalny w obwodzie. Usunięcie słupa podpina jego następników pod poprzednika. Usunięcie szafy albo obwodu robi z jego słupów „nieprzypisane”.

Logowanie: dwa wspólne konta z env (`SCANNER_*` i `ADMIN_*`). Konto admina działa też w skanerze.

## Lokalnie

```bash
npm run install:all
cp backend/.env.example backend/.env   # domyślnie scanner/scanner i admin/admin
npm run dev:api                        # http://localhost:3000 (migracje odpalają się przy starcie)
npm run dev:web                        # http://localhost:5173
```

- Skaner: http://localhost:5173/scan
- Dashboard: http://localhost:5173/admin

Frontend w dev woła `/api/*`, a Vite przekazuje to do Nesta (proxy), więc nie trzeba ustawiać `VITE_API_URL`.

### Test z telefonu w sieci lokalnej

Kamera wymaga HTTPS, więc:

```bash
npm --prefix frontend run dev:https    # https://<IP-komputera>:5173 (self-signed cert, zaakceptuj ostrzeżenie)
```

### Zmiany w schemacie bazy

```bash
cd backend
# edytuj src/db/schema.ts
npm run db:generate                    # tworzy plik SQL w backend/drizzle/ (commitujemy go)
```

Migracje wykonują się automatycznie przy starcie backendu.

### Dane przykładowe (sieć oświetleniowa w Żorach)

```bash
cd backend
npm run db:seed              # tylko gdy w bazie nie ma jeszcze szaf
npm run db:seed -- --reset   # czyści sieć i seeduje od nowa (nazwane punkty i punkty ze skanami zostają)
```

Seed tworzy 3 szafy (SOU-84 ul. Wodzisławska, SOU-12 Rynek, SOU-04 al. Zjednoczonej Europy), 13 obwodów, ok. 200 słupów i 240 opraw rozmieszczonych wzdłuż prawdziwych ulic (geometria z OpenStreetMap w `src/db/seed-streets.json`). Sama sieć jest **fikcyjna**, to dane pokazowe. Dotychczasowe nazwane punkty są podpinane do najbliższego słupa jako odgałęzienie.

## Deploy

### 1. Baza: Turso

```bash
brew install tursodatabase/tap/turso
turso auth signup                      # albo: turso auth login
turso db create zory-scan
turso db show zory-scan --url          # → DATABASE_URL (libsql://...)
turso db tokens create zory-scan       # → DATABASE_AUTH_TOKEN
```

### 2. Backend: Render

1. Wypchnij repo na GitHuba.
2. Render → **New → Blueprint** → wskaż repo (użyje `render.yaml`).
3. Uzupełnij zmienne: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, loginy/hasła, `CORS_ORIGIN` (URL frontendu z Cloudflare, np. `https://zory-scan.pages.dev`). `JWT_SECRET` generuje się sam.
4. Po deployu sprawdź `https://<serwis>.onrender.com/health`.

Darmowy Render usypia po 15 min bez ruchu. Workflow `.github/workflows/keepalive.yml` pinguje `/health` co 10 min. Wystarczy w GitHubie dodać zmienną repo `API_URL` (Settings → Secrets and variables → Actions → Variables).

### 3. Frontend: Cloudflare Pages

Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**:

| Ustawienie | Wartość |
|---|---|
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output | `dist` |
| Env: `VITE_API_URL` | URL backendu z Rendera |
| Env: `NODE_VERSION` | `22` |

Routing SPA działa automatycznie (brak `404.html` → Cloudflare serwuje `index.html`).

## API

| Metoda | Ścieżka | Rola |
|---|---|---|
| POST | `/auth/login` `{role, login, password}` | publiczne |
| POST | `/scans` `{pointId, lat?, lng?}` | scanner |
| GET | `/scans?limit=100` | admin |
| GET/POST | `/points` | admin |
| GET/PATCH/DELETE | `/points/:id` | admin |
| GET | `/health` | publiczne |
