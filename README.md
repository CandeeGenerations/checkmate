# Checkmate

A repeatable to-do tracker. Single shared list of recurring items, each belonging to one of four frequencies (daily, weekly, monthly, quarterly) with an optional specific-day assignment within its period. Designed for desktop / wall-mounted iPad first.

## Stack

- **Frontend** — React 19 + Vite + TypeScript + TailwindCSS + Radix UI + TanStack React Query + framer-motion + @dnd-kit + jspdf
- **Backend** — Express 5 + Drizzle ORM + better-sqlite3
- **Auth** — bcrypt password hash + JWT cookie (env-var seeded), gates the entire API

## Local development

```bash
pnpm install
pnpm db:migrate          # creates checkmate.db
pnpm auth:hash           # paste output into .env as AUTH_PASSWORD_HASH
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
pnpm dev                 # http://localhost:5184
```

Vite serves the frontend on **5184** and proxies `/api` to the Express backend on **5186**.

## Production deploy (macOS launchd + cloudflared)

```bash
deploy/install.sh
```

The script prompts for the password, generates the JWT secret, optionally takes a Sentry server DSN, populates `~/Library/LaunchAgents/cc.cgen.checkmate.plist`, and bootstraps the launchd agent.

The launchd service runs `tsx server/index.ts` directly — Express serves the built frontend out of `dist/` on port **5186** (not the Vite dev port 5184). Run `scripts/deploy.sh` once before `deploy/install.sh` so `dist/` exists.

Then add the tunnel ingress rule:

```yaml
# ~/.cloudflared/config.yml — add ABOVE the http_status:404 catch-all
- hostname: checkmate.cgen.cc
  service: http://localhost:5186
```

Then:

```bash
cloudflared tunnel route dns cgen-tunnel checkmate.cgen.cc
launchctl kickstart -k gui/$(id -u)/cc.cgen.cloudflared
```

The app is reachable at https://checkmate.cgen.cc.

## Sentry (errors + perf)

Both server and frontend are wired into Sentry; the SDKs are inert until the env vars are set, so checkmate runs fine without it. Full design + rationale: `plans/sentry-integration.md` and `docs/adr/0002-sentry-pii-policy.md`.

**Env var topology** — different keys live in different places:

| Var | Where | Why |
|---|---|---|
| `SENTRY_DSN_SERVER` | `~/Library/LaunchAgents/cc.cgen.checkmate.plist` | Runtime; per-project |
| `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | plist | Runtime; per-project (`SENTRY_RELEASE` is rewritten by `scripts/deploy.sh`) |
| `VITE_SENTRY_DSN`, `SENTRY_PROJECT_WEB` | repo's `.env` (gitignored) | Build-time; per-project |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` | `~/.zshrc` | Build-time; **org-level, shared across every cgen app** |

Per-project keys never go in `~/.zshrc` — multiple cgen projects share that file and would collide.

**Deploy:**

```bash
scripts/deploy.sh
```

Lints, builds with the current git short-SHA as `SENTRY_RELEASE`, uploads source maps to Sentry (if `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` are set), rewrites the plist's `SENTRY_RELEASE`, then `bootout`+`bootstrap`s the launchd service (a plain `kickstart` would keep the old env). Verifies with `ps eww`.

**Auto-deploy** — husky `post-commit` and `post-merge` hooks run `scripts/deploy.sh` automatically when `main` advances. Feature branches are unaffected. Bypass with `SKIP_DEPLOY=1 git pull` / `SKIP_DEPLOY=1 git commit`. If you use a GUI git client (GitHub Desktop, Tower), copy `.env.deploy.example` → `.env.deploy` (gitignored) so the hooks have `PATH` + `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` without depending on your shell profile.

## Environment variables

| Var                  | Required | Notes                                       |
| -------------------- | -------- | ------------------------------------------- |
| `AUTH_PASSWORD_HASH` | yes      | bcrypt hash. Generate via `pnpm auth:hash`. |
| `JWT_SECRET`         | yes      | 32+ random chars. `openssl rand -hex 32`.   |
| `JWT_EXPIRY`         | no       | Default `7d`. Format `Nd \| Nh \| Nm`.      |
| `PORT`               | no       | Express port. Default `5186`.               |

When `AUTH_PASSWORD_HASH` is unset, the auth middleware passes everything through (handy for local dev without setting up creds).

See the Sentry section above for the optional observability env vars.
