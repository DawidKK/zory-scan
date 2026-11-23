# Zory Scan

PoC: skaner kodów QR (PWA) + dashboard administratora z mapą punktów.

- `frontend/`: React, Vite, PWA, Leaflet (OSM), React Query
- `backend/`: NestJS, Drizzle ORM, SQLite lokalnie / Turso na produkcji
- Design: [DESIGN.md](DESIGN.md)

## Jak to działa

1. Admin (`/admin`) klika na mapie → tworzy punkt (nazwa, treść, współrzędne).
2. Każdy punkt ma kod QR z linkiem `https://<frontend>/scan?p=<id>` (zakładka **QR Code**).
3. Użytkownik loguje się do skanera (`/scan`), skanuje kod → widzi treść punktu, skan zapisuje się w bazie.
4. Admin widzi listę ostatnich skanów i punkty na mapie (świeżo zeskanowane pulsują na turkusowo).

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
