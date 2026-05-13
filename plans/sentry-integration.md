# Sentry Integration — Plan

Reference implementation: `central-flock` (PR #11). This adapts that pattern to Checkmate's smaller surface.

## Goals

- Catch unhandled exceptions on **server** and **frontend**.
- Perf traces on both sides so slow routes / slow renders are visible after the fact.
- Keep user-generated content (item titles, category names) **out** of Sentry.

## Products

- **Errors** + **performance traces**.
- **No** session replay (overkill for a single-operator app, and replay would capture item titles in the DOM — a PII leak we don't need).

## What we are NOT doing (and why)

| Skipped                                       | Why it doesn't apply to Checkmate                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Cron monitors (`Sentry.withMonitor`)          | No background schedulers in the server. Everything is request-driven.                             |
| Aggregate threshold events for batch failures | No batch operations (no SMS, no bulk imports).                                                    |
| URL-path token redaction in `scrubEvent`      | No tokens in URL paths. Auth is JWT-cookie based, login uses POST body (which we drop wholesale). |

If schedulers or batch ops are added later, revisit Steps 9 and 10 of the integrate-sentry skill.

## Architecture decisions

1. **Strict PII scrubbing.** Drop `request.body`, `request.query_string`, `request.cookies`, and breadcrumb `data.input`/`data.response`. See `docs/adr/0002-sentry-pii-policy.md`.
2. **`asyncHandler` chokepoint.** Checkmate's routes currently use direct `async (req, res) => { ... }` handlers and return `res.status(400/404)` for validation errors without throwing. We introduce `server/lib/asyncHandler.ts` and migrate every route. Unhandled throws then route through one place that calls `Sentry.captureException` before responding 500.
3. **`--import` for Sentry preload.** ESM auto-instrumentation only patches http/express if `Sentry.init` runs before those modules load. `tsx --import ./server/lib/sentry.ts server/index.ts` for both dev and prod.
4. **Plist becomes server-only.** Today the launchd plist runs `pnpm dev` (vite + tsx concurrently). Switched to `tsx --import ./server/lib/sentry.ts server/index.ts` — vite isn't needed in production because Express already serves `dist/` static.
5. **Release tagging via git SHA.** `scripts/deploy.sh` writes the current SHA to the plist `SENTRY_RELEASE` env var and passes it to the Vite build for source map upload.
6. **Env-var-gated init.** Without `SENTRY_DSN_SERVER` / `VITE_SENTRY_DSN`, the SDKs no-op. `pnpm build` works without `SENTRY_AUTH_TOKEN` because the Vite plugin is added only when `SENTRY_AUTH_TOKEN && SENTRY_ORG` are both set.

## Sentry projects to create

Product name is _Checkmate_, repo name is `checkmate` — no divergence, so the project slugs are straightforward:

- `checkmate-server` (Node)
- `checkmate-web` (React)

One auth token with `project:releases` scope under the cgen Sentry org. The token is org-wide and is reused across every cgen project; no per-project token needed.

## Deploy shape

**Shape A — built bundle.** The launchd plist runs `tsx --import ./server/lib/sentry.ts server/index.ts`. Express serves the frontend out of `dist/`. There is no Vite at runtime in production; `pnpm build` runs at deploy time via `scripts/deploy.sh`. This is the _same_ shape as `central-flock`.

(`the-amazing-chore-app` is shape B — plist runs `pnpm dev` and Vite serves the frontend at runtime. That shape needs `VITE_SENTRY_DSN` _in the plist_ because launchd doesn't read your shell. Checkmate doesn't, since the bundle is pre-built and `VITE_SENTRY_DSN` is read at build time.)

## Env var topology

The rule, in one line: **org-level keys live in `~/.zshrc`, per-project keys live in the plist or the gitignored `.env`.** Multiple cgen projects share `~/.zshrc`, so any per-project DSN/slug stuffed there would collide with the next project.

| Var                  | Where                              | When       | Purpose                                                                                                                   |
| -------------------- | ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN_SERVER`  | plist + `.env`                     | runtime    | Server SDK DSN                                                                                                            |
| `SENTRY_ENVIRONMENT` | plist + `.env`                     | runtime    | `production` / `development`                                                                                              |
| `SENTRY_RELEASE`     | plist (rewritten by deploy script) | runtime    | Git SHA — tags errors with the deploy that produced them                                                                  |
| `VITE_SENTRY_DSN`    | `.env` (gitignored, per-project)   | build time | Browser DSN baked into `dist/` by Vite                                                                                    |
| `SENTRY_PROJECT_WEB` | `.env` (gitignored, per-project)   | build time | Sentry project slug for source map upload. Default in `vite.config.ts` is `'checkmate-web'`; only override if it diverges |
| `SENTRY_AUTH_TOKEN`  | `~/.zshrc` (org-level)             | build time | Source map upload — same token covers every cgen project                                                                  |
| `SENTRY_ORG`         | `~/.zshrc` (org-level)             | build time | Same org for every cgen project                                                                                           |

`SENTRY_AUTH_TOKEN` never goes in the plist — it's a build-time secret and writing it into runtime env widens its exposure for no benefit. `scripts/deploy.sh` sources the per-project `.env` at the top, so `VITE_SENTRY_DSN` and `SENTRY_PROJECT_WEB` reach the Vite build automatically.

## Things that bite (checkmate-specific)

- **`launchctl kickstart -k` does not reload plist env vars.** After `scripts/deploy.sh` rewrites `SENTRY_RELEASE` via `PlistBuddy`, kickstart alone would restart the running program with launchd's cached env from the original bootstrap — the new release tag would not propagate. The deploy script does a full `bootout` + `bootstrap` and then verifies with `ps eww -p <pid>` that the new value actually reached the process. If you ever hand-edit the installed plist, do the same — never trust kickstart alone for env changes.
- **`bootstrap` failing with `Input/output error` after a plist edit.** Reproducible: every `launchctl bootstrap` invocation immediately after `bootout` in this session failed with `5: Input/output error`. `xattr -c "$PLIST"` does _not_ actually remove the offending `com.apple.provenance` attribute (it's system-protected), but **simply retrying `launchctl bootstrap` once** succeeds every time. Best guess: launchd's per-domain registry hasn't fully released the previous service when bootstrap fires too quickly. If you see this error, just rerun the same bootstrap command. Burned three times during 2026-05-12 work before settling on retry-once as the recipe.
- **`~/.zshrc` is shared.** Every cgen project on this Mac sources the same `~/.zshrc`. Per-project keys (DSNs, project slugs) belong in this repo's `.env` (gitignored) — not in the shell profile.
- **Sibling repos' `.env.deploy` files leak into the parent shell.** Husky's post-commit / post-merge hooks `source .env.deploy`, which exports any per-project vars into the calling shell. If you `cd` between cgen repos in one terminal session, vars from the last `.env.deploy` you triggered will still be set — and Vite reads `process.env` before `.env`, so the wrong DSN ends up baked into the next bundle. Burned on 2026-05-13 when central-flock's `VITE_SENTRY_DSN` poisoned checkmate's build. Two defenses: (a) `scripts/deploy.sh` does an explicit `unset VITE_SENTRY_DSN SENTRY_PROJECT_WEB` before sourcing `.env`; (b) sibling repos should keep build-time DSNs in their own `.env`, not `.env.deploy`. Verify which DSN actually shipped with `grep -hoE 'https://[a-f0-9]+@o[0-9]+\.ingest\.us\.sentry\.io/[0-9]+' dist/assets/index-*.js`.
- **No `VITE_SENTRY_DSN` in the plist.** Checkmate is shape A; Vite is not running in production. The browser DSN is baked into `dist/` at build time. The plist only carries runtime keys.
- **Cloudflared ingress is managed remotely.** This Mac's `~/.cloudflared/config.yml` does _not_ contain a `checkmate.cgen.cc` rule, yet the hostname routes correctly — meaning the tunnel reads its public-hostname config from the Cloudflare dashboard rather than the local YAML. The README's "edit `~/.cloudflared/config.yml`" step doesn't apply; manage `checkmate.cgen.cc → http://localhost:5186` in Cloudflare → Zero Trust → Networks → Tunnels → Public Hostname instead.

## Smoke tests after wiring

1. Throw from a server route — confirm Sentry event has no `request.body`.
2. Throw from a React component render — confirm `ErrorBoundary` fallback shows AND event lands.
3. Throw from a `useQuery` queryFn — confirm event arrives via `QueryCache.onError`.
4. Trigger 401 (expired cookie) — confirm it is **not** captured (filtered by `ignoreErrors: ['Unauthorized']`).
5. Force a 500 inside an `asyncHandler`-wrapped route — confirm event arrives and response is `{error: 'Internal server error'}`.
6. After running `scripts/deploy.sh`, confirm the running process actually has the new `SENTRY_RELEASE` via `ps eww -p <pid> | tr ' ' '\n' | grep SENTRY` — guards against the kickstart-stale-env trap.
