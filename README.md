# Acme Distribution ERP

Next.js (App Router) UI at the repo root; the previous FastAPI + Vite stack lives under [`docs/legacy-app/`](docs/legacy-app/).

## Local dev

1. **Backend** (from `docs/legacy-app/`): `./run-one-port.sh` or `uvicorn api.main:app --reload --host 127.0.0.1 --port 8005` so the API is on port **8005**.

2. **Frontend**: `npm run dev` (default [http://localhost:3000](http://localhost:3000)).

3. **Environment**: copy `.env.local.example` to `.env.local` and set **Better Auth** (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`), **Postgres** (`DATABASE_URL`), and optionally API rewrite vars.  
   If `NEXT_PUBLIC_API_URL` is unset, the app calls `/api` on the same origin; `next.config.ts` rewrites that to `ERP_API_ORIGIN` (default `http://127.0.0.1:8005`). Route handlers under `app/api/auth/*` are served by Next.js (Better Auth) and are not proxied to FastAPI.

See [`docs/monorepo-notes.md`](docs/monorepo-notes.md) for more.

## Layout

- `app/` — Next.js routes and `app/styles/erp.css` (legacy UI styles)
- `components/` — kebab-case React components (shell, auth, shared UI)
- `lib/` — API client, Better Auth, utilities
