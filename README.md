# Movie Night Picker

A one-link movie-night invite. A host shortlists three movies; a guest opens a link, browses,
and punches a ticket for one; the host gets a push notification the instant it's picked.
No accounts, no guest install.

See [`docs/Technical Requirements.md`](docs/Technical%20Requirements.md) for the full functional spec.

## Stack

- **Frontend** — React + TypeScript (Vite), `react-router-dom`, installable PWA
  (`vite-plugin-pwa`, custom service worker)
- **Backend** — Go (stdlib `net/http`, no framework), `pgx` for Postgres, `webpush-go` for
  VAPID web push
- **Database** — PostgreSQL

## Repo layout

```
backend/        Go server (invite/host/push handlers, migrations, seed command)
frontend/       Vite + React app (guest flow, host view, PWA assets)
docs/           Technical Requirements (functional spec)
docker-compose.yml   Local Postgres
```

## Running locally

```bash
# 1. Postgres
docker compose up -d db

# 2. Backend (from backend/) — migrations run automatically on boot
cd backend
go run .                # serve
go run . seed            # or: insert a sample invite, print guest & host links

# 3. Frontend (from frontend/)
cd frontend
npm install
npm run dev
```

Open the printed guest link (`/i/:token`) to pick a movie, and the host link (`/host/:token`)
to watch it update.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string (defaults to the docker-compose creds) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | backend | Web push signing keys; push is a no-op if unset |
| `VAPID_SUBJECT` | backend | Contact URI for push (`mailto:...`), optional |
| `CORS_ORIGIN` | backend | Allowed origin for the frontend, defaults to `*` |
| `EXPIRY_GRACE` | backend | Grace window after the event before an invite expires (default `4h`) |
| `APP_BASE_URL` | backend | Base URL used when printing seed links (default `http://localhost:5173`) |
| `VITE_API_BASE` | frontend | Backend URL the frontend calls (default `http://localhost:8080`) |

## Testing

```bash
cd backend
DATABASE_URL=postgres://movienight:movienight@localhost:5432/movienight go test ./...
```
