# SRS Invoice Manager — Standalone Setup

## Requirements
- Node.js 20+ → https://nodejs.org
- pnpm 9+ → `npm install -g pnpm`
- PostgreSQL 14+ running locally (or a cloud Postgres URL)

---

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Set your database URL
#    Create a .env file at the project root:
echo "DATABASE_URL=postgresql://user:password@localhost:5432/srs_invoices" > .env

# 3. Push the schema to your database
pnpm --filter @workspace/db db:push

# 4. (Optional) Seed sample data
pnpm --filter @workspace/db db:seed

# 5. Start the API server  (runs on port 3001 by default)
pnpm --filter @workspace/api-server dev

# 6. In a new terminal — start the web app  (runs on port 5173)
pnpm --filter @workspace/invoice-app dev
```

Open http://localhost:5173 in your browser.

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/      Express 5 + Drizzle ORM backend
│   └── invoice-app/     React + Vite frontend
├── lib/
│   ├── db/              Drizzle schema & migrations
│   ├── api-spec/        OpenAPI spec (openapi.yaml)
│   ├── api-client-react/ Generated React Query hooks
│   └── api-zod/         Generated Zod schemas
├── pnpm-workspace.yaml
└── package.json
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://user:pass@localhost:5432/srs` |
| `PORT` | API server port (default 3001) | `3001` |
| `SESSION_SECRET` | Express session secret | any random string |

---

## Print / Export Invoice

Open any invoice → click **Print** → use browser "Save as PDF".

---

## Tech Stack
- Frontend: React 18, Vite, TailwindCSS, shadcn/ui, React Query, Wouter
- Backend: Express 5, Drizzle ORM, Zod
- Database: PostgreSQL
- Codegen: Orval (OpenAPI → TypeScript hooks + Zod schemas)
