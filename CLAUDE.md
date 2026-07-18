# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Movie Night Picker: a one-link movie-night invite. A host shortlists three movies; a guest opens
a link, browses, and punches a ticket for one; the host gets a web-push notification the instant
it's picked. No accounts, no guest install. Full functional spec: `docs/Technical Requirements.md`.

## Commands

```bash
# Postgres (required for backend)
docker compose up -d db

# Backend (from backend/) — runs idempotent migrations on every boot
cd backend
go run .                  # serve on :8080
go run . seed              # insert a sample invite, print guest & host links
go vet ./...
DATABASE_URL=postgres://movienight:movienight@localhost:5432/movienight go test ./...
DATABASE_URL=postgres://movienight:movienight@localhost:5432/movienight go test ./... -run TestPickStateMachine -v

# Frontend (from frontend/)
cd frontend
npm install
npm run dev                # Vite dev server on :5173
npm run build               # tsc -b && vite build
npm run preview             # serve the production build (needed to exercise the real service worker)
npm run lint                 # oxlint
npx tsc -b --noEmit          # typecheck only
```

There is no test runner configured on the frontend. The backend test (`backend/invite_test.go`)
runs against a real Postgres instance (via `DATABASE_URL`), not mocks — start `docker compose up -d db`
first.

## Architecture

**Backend** is plain Go stdlib `net/http` (Go 1.22+ pattern routing, e.g. `GET /api/invite/{token}`) —
no web framework. Six routes wired in `backend/main.go`, each backed by one handler file:
- `invite.go` — create/get invite, and the `pick` handler, which is the single source of truth for
  the state machine (waiting → answered → one re-pick → locked, plus expiry). This gate is enforced
  once here, not duplicated per caller.
- `host.go` — host read (includes push-enabled flag) and push subscription storage.
- `push.go` — VAPID web push via `webpush-go`; silently no-ops if `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`
  are unset. Deletes a subscription on a 404/410 send response.
- `seed.go` — `go run . seed` inserts one sample invite and prints both links; the only way to create
  an invite today (no authoring UI, by design — v1 scope).
- `db.go` — `Store` wraps a `pgxpool.Pool`; runs `migrations/001_init.sql` on every boot (migration is
  `CREATE TABLE IF NOT EXISTS`, so this is safe to repeat).

**Data model**: one `invites` table. The three movies for an invite are embedded as a `movies` JSONB
column (ordered array) rather than a join/authoring table, since v1 is exactly-3-per-invite with no
reuse. `expires_at` is stored, but `expired` is *derived* (`now() > expires_at`) on every read in
`models.go` (`Invite.Expired()`), never stored, so guest and host views can never disagree about it.
A separate `push_subs` table holds host push subscriptions, keyed by `host_token`.

**Auth model**: no accounts. Two independent opaque tokens per invite (`token()` in `db.go`, 128-bit
random, URL-safe base64): `invite_token` for the guest link (`/i/:token`) and `host_token` for the
host link (`/host/:token`), which also gates push registration. The guest-facing JSON view
(`guestView` in `models.go`) never includes `host_token`.

**Pick/re-pick rule** (`invite.go`'s `pick` handler): first pick sets `status=answered`; a second pick
with a *different* movie is allowed once (`swaps_used` 0→1); re-committing the same movie is a no-op;
anything beyond that, or any pick on an expired invite, returns 409. This is the only place this rule
is enforced.

**Frontend** is Vite + React + TypeScript, routed with `react-router-dom` (`frontend/src/App.tsx`):
`/i/:token` → guest flow, `/host/:token` → host view. `frontend/src/screens/GuestFlow.tsx` implements
the guest state machine as a single component tree: invite → picker → detail (sheet) → punch (overlay)
→ confirm, driven by server `status`/`expired`, not client-only state — opening a movie card is
never a commit. `frontend/src/api.ts` / `types.ts` mirror the Go JSON shapes field-for-field.

**PWA**: `vite-plugin-pwa` runs in `injectManifest` mode, so `frontend/src/sw.ts` is a hand-written
service worker owning both app-shell precaching and the `push`/`notificationclick` handlers (not the
generated default). Building with `npm run build` + `npm run preview` is required to test push end
to end — the dev server does not register a real service worker reliably.

**Design fidelity**: colors, fonts, copy, and animation timings throughout the frontend are carried
verbatim from the Claude Design source (`Movie Night Picker.dc.html`) — treat these as intentional,
not arbitrary, when touching styles. All animations are gated behind
`@media (prefers-reduced-motion: reduce)` (see `frontend/src/theme.css` and the
`useReducedMotion` hook) and must degrade to an instant/static path, not just a shorter one.
