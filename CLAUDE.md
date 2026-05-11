# CLAUDE.md

## Project Overview

**Checkmate** is a repeatable to-do tracker. A single shared list of recurring items, each belonging to one of four frequencies (daily, weekly, monthly, quarterly) with an optional specific-day assignment within its period. Designed for desktop / wall-mounted iPad first; phone tolerated. Hosted at **checkmate.cgen.cc**. Full-stack TypeScript: React frontend, Express backend, SQLite storage. Modeled on `the-amazing-chore-app` and deployed identically (launchd + cloudflared tunnel).

## Commands

- `pnpm dev` — Start frontend (Vite, port 5184) and backend (Express, port 5186) concurrently
- `pnpm build` — TypeScript compile + Vite production build
- `pnpm lint` — ESLint + TypeScript type check (both `tsconfig.app.json` and `tsconfig.server.json`)
- `pnpm db:generate` — Generate Drizzle migration files
- `pnpm db:migrate` — Push schema changes to SQLite database
- `pnpm db:studio` — Open Drizzle Studio for visual DB management
- `pnpm auth:hash` — Generate a bcrypt hash for `AUTH_PASSWORD_HASH`

## Architecture

- **Frontend:** `src/` — React 19, React Router, TailwindCSS 4, Radix UI, TanStack React Query, framer-motion, @dnd-kit
- **Backend:** `server/` — Express 5, Drizzle ORM, better-sqlite3
- **Database:** SQLite file at `./checkmate.db`, schema in `server/db/schema.ts`
- **API proxy:** Vite proxies `/api` requests to `http://localhost:5186` in dev
- **Path alias:** `@` maps to `./src` (configured in `vite.config.ts` and `tsconfig.app.json`)

## Data model

- **items**: id, title, frequency ('daily'|'weekly'|'monthly'|'quarterly'), dayOfWeek?, dayOfMonth?, monthOfQuarter?, sortOrder, timestamps
- **completions**: id, itemId, completedDate (YYYY-MM-DD), completedAt
- **app_settings**: key, value, updatedAt

Completions are kept forever (full history). "Is this item done this period?" is **derived** by asking whether any completion's `completedDate` falls inside the current period under the item's *current* frequency. This means changing frequency naturally recomputes status from history.

## Period rules

- Calendar boundaries; **week starts Sunday**.
- Quarters are calendar-aligned (Q1=Jan–Mar, Q2=Apr–Jun, …).
- Quarterly assignment = `monthOfQuarter` (1–3) + `dayOfMonth` (1–31).
- Day overflow (Feb 30, Feb 31) clamps to the last day of the month.
- All shared in `server/lib/date.ts` and mirrored in `src/lib/date.ts` — keep them in sync.

## Views

- **Daily** = unified today agenda: all daily items + weekly/monthly/quarterly items whose dueDate equals today. Floating items (no assigned day) only appear in their own period view.
- **Weekly** = 8-column kanban: Unassigned + Sun–Sat.
- **Monthly / Quarterly** = flat lists (floats at top, then sorted by assigned day).

## Key patterns

- **Auth**: bcrypt password hash + JWT cookie (env vars: `AUTH_PASSWORD_HASH`, `JWT_SECRET`, `JWT_EXPIRY`). Single shared password gates the entire API except `/api/auth/*`.
- **API routes**: Express routes in `server/routes/`. `/api/auth` is open; everything else is gated by `requireAuth` middleware.
- **API client**: typed `request<T>()` helper in `src/lib/api.ts` with `credentials: 'include'`.
- **State**: TanStack React Query. Period view = `usePeriod(frequency, date)`. Toggle completion = `useToggleCompletion(frequency, date)` with optimistic updates.

## Code style

- Prettier: no semicolons, single quotes, no bracket spacing, 120 print width, 2-space indent
- Import sorting via `@trivago/prettier-plugin-sort-imports` (third-party first, then local)
- TypeScript strict mode for both frontend and server
- `noUnusedLocals` and `noUnusedParameters` enabled on server tsconfig
