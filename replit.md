# SRS Invoice Manager

A full-stack invoice management app for SRS Controls. Create clients, issue invoices, and track revenue — all in one place.

## Run & Operate

- **Frontend** (webview, port 5000): `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/invoice-app dev`
- **API server** (console, port 3001): `PORT=3001 pnpm --filter @workspace/api-server dev`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes to dev database (Drizzle)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Where things live

- `artifacts/api-server/` — Express 5 backend (builds with esbuild, runs on port 3001)
- `artifacts/invoice-app/` — React + Vite frontend (runs on port 5000, proxies `/api` → port 3001)
- `lib/db/` — Drizzle schema (`src/schema/`), drizzle.config.ts — source of truth for DB shape
- `lib/api-spec/` — OpenAPI spec (`openapi.yaml`) — source of truth for API contracts
- `lib/api-client-react/` — generated React Query hooks (run codegen to regenerate)
- `lib/api-zod/` — generated Zod schemas (run codegen to regenerate)

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 18, Vite, TailwindCSS, shadcn/ui, React Query, Wouter
- API: Express 5, Drizzle ORM, Zod (`zod/v4`)
- DB: PostgreSQL (Replit managed) + Drizzle ORM
- Codegen: Orval (OpenAPI → TypeScript hooks + Zod schemas)
- Build: esbuild (CJS bundle for API server)

## Architecture decisions

- The Vite dev server proxies `/api/*` to `http://localhost:3001` — no hardcoded API URLs in the frontend.
- `DATABASE_URL` is injected automatically by Replit at runtime — never set it in `.env`.
- `SESSION_SECRET` is stored as a Replit Secret.
- The API server does a full esbuild compile on each `dev` start — changes require a workflow restart.

## Product

- Dashboard: revenue totals and recent invoices at a glance
- Clients: create and manage client records
- Invoices: create, edit, view, and print/export invoices as PDF (via browser print)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After editing API server code, restart the **API Server** workflow (it doesn't hot-reload — it rebuilds with esbuild on each start).
- After editing frontend code, Vite hot-reloads automatically — no restart needed.
- Always run `pnpm --filter @workspace/db run push` after changing `lib/db/src/schema/` to apply schema changes to the dev database.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
