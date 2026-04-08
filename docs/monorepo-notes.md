# fluxora

## Next.js at the repo root

`create-next-app` only allows certain top-level names (see [Next.js `isFolderEmpty`](https://github.com/vercel/next.js/blob/canary/packages/create-next-app/helpers/is-folder-empty.ts)). The **`docs/`** folder name is allowlisted, so the previous FastAPI + Vite stack lives under **`docs/legacy-app/`** instead of `legacy-app/` at the root.

From the repo root:

```bash
npx create-next-app@latest .
```

## Legacy stack

The FastAPI + Vite app (SQLite DB, Alembic, etc.) is in **`docs/legacy-app/`**. See [legacy-app/README.md](legacy-app/README.md) for how to run it.
