# 0002 — Sentry PII Policy

## Status

Accepted.

## Context

Checkmate is a single-operator personal to-do tracker. The items the user writes (e.g. _"call dentist"_, _"check on Mom"_) are personal in tone and not intended for third parties. Category names are similarly user-authored. None of this is "PII" in the regulatory sense, but it is the kind of content a user reasonably expects to live only on their own machine and never leave it.

Sentry, by default, attaches a fair amount of request context to error events: request body, query string, cookies, and breadcrumb data containing function input/output. With no scrubbing, an error in `POST /api/items` would ship the item title to Sentry.

We had to decide how aggressively to scrub before turning Sentry on.

## Decision

**Strict scrubbing by default.** Before any event leaves the process we drop:

- `event.request.data` — POST/PUT bodies. Eliminates item titles, category names, passwords.
- `event.request.query_string` — query params. Currently only `date=YYYY-MM-DD`, but cheap insurance against future params.
- `event.request.cookies` — including the JWT auth cookie.
- Breadcrumb `data.input` and `data.response` — Sentry attaches these to console/fetch breadcrumbs and they can carry payload bodies.

We do **not** strip URL paths. Checkmate's routes have no tokens in their paths (auth is cookie-based, no magic links), so `/api/items/42` is fine to send — and the route shape is the most useful aggregation key Sentry has.

We do **not** enable `sendDefaultPii` (it stays false).

We do **not** enable session replay. Replay would record the rendered item titles in the DOM, defeating the body scrub.

For batch / aggregate events (none today, but if added later): counts and IDs only. Never recipient identities or payload contents.

## Rationale

- **One-way easy.** Loosening scrubbing later is a one-line config change. Tightening retroactively requires trusting Sentry's deletion endpoints and remembering which events leaked.
- **Single operator, no incident response volume.** We're not going to miss the body — when an error happens we can reproduce it locally with the same user account. Body context provides marginal debugging value at a real privacy cost.
- **Item titles are the product.** If Sentry contains every item title for every error, Sentry effectively contains the user's to-do list. That's a defensible default to refuse, even on a single-user app.

## Consequences

- Some debugging will require reproducing the failure locally rather than reading the Sentry payload. Acceptable given how easy local repro is.
- If we ever add multi-user mode or webhooks with tokens in URL paths, this ADR needs to be reopened — the assumptions don't transfer.

## Implementation

See `server/lib/sentry.ts` (`scrubEvent`, `scrubBreadcrumb`) and `src/lib/sentry.ts`. Both initialize with `sendDefaultPii: false` and the scrub functions wired into `beforeSend`, `beforeSendTransaction`, and `beforeBreadcrumb`.
