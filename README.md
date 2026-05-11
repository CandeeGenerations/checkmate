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

The script prompts for the password, generates the JWT secret, populates `~/Library/LaunchAgents/cc.cgen.checkmate.plist`, and bootstraps the launchd agent. Then add the tunnel ingress rule:

```yaml
# ~/.cloudflared/config.yml — add ABOVE the http_status:404 catch-all
- hostname: checkmate.cgen.cc
  service: http://localhost:5184
```

Then:

```bash
cloudflared tunnel route dns cgen-tunnel checkmate.cgen.cc
launchctl kickstart -k gui/$(id -u)/cc.cgen.cloudflared
```

The app is reachable at https://checkmate.cgen.cc.

## Environment variables

| Var                  | Required | Notes                                       |
| -------------------- | -------- | ------------------------------------------- |
| `AUTH_PASSWORD_HASH` | yes      | bcrypt hash. Generate via `pnpm auth:hash`. |
| `JWT_SECRET`         | yes      | 32+ random chars. `openssl rand -hex 32`.   |
| `JWT_EXPIRY`         | no       | Default `7d`. Format `Nd \| Nh \| Nm`.      |
| `PORT`               | no       | Express port. Default `5186`.               |

When `AUTH_PASSWORD_HASH` is unset, the auth middleware passes everything through (handy for local dev without setting up creds).
