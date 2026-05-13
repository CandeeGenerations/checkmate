#!/usr/bin/env bash
# Build the frontend with source maps, upload them to Sentry tagged with the
# current git SHA, update the launchd plist's SENTRY_RELEASE, and restart the
# service so the new release is live.
#
# Required env vars (build-time, typically from ~/.zshrc for org-level keys
# and the per-project .env for project-level keys):
#   SENTRY_AUTH_TOKEN, SENTRY_ORG  (org-level, ~/.zshrc)
#   VITE_SENTRY_DSN                (per-project, .env)
# Optional:
#   SENTRY_PROJECT_WEB             (per-project; defaults to checkmate-web)

set -euo pipefail

LABEL="cc.cgen.checkmate"
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PLIST_TARGET="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ ! -f "$PLIST_TARGET" ]; then
  echo "ERROR: plist not installed at $PLIST_TARGET — run deploy/install.sh first" >&2
  exit 1
fi

cd "$PROJECT_DIR"

# Defensively scrub any per-project build-time vars the parent shell may have
# inherited from a sibling cgen project (e.g. sourcing central-flock's
# .env.deploy leaks VITE_SENTRY_DSN — confirmed in the wild on 2026-05-13).
# Without this, Vite would happily bake the WRONG DSN into the bundle.
unset VITE_SENTRY_DSN SENTRY_PROJECT_WEB

# Source per-project .env so VITE_SENTRY_DSN / SENTRY_PROJECT_WEB are available
# to the Vite build without forcing them into ~/.zshrc (which is shared across
# every cgen project — per-project keys would collide there).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SHA=$(git rev-parse --short HEAD)
DIRTY=""
if ! git diff --quiet || ! git diff --cached --quiet; then
  DIRTY="-dirty"
fi
RELEASE="${SHA}${DIRTY}"

echo "==> Deploying $LABEL @ $RELEASE"

if [ -z "${SENTRY_AUTH_TOKEN:-}" ] || [ -z "${SENTRY_ORG:-}" ]; then
  echo "  ⚠  SENTRY_AUTH_TOKEN / SENTRY_ORG not set — building without source map upload."
fi

echo "Step 1/5: lint + typecheck"
# Invoke tools directly rather than via `pnpm lint` to skirt pnpm 11's
# pre-run deps-status check, which trips on @sentry/cli's ignored postinstall
# (a sandbox-blocked binary download we don't actually need).
node ./node_modules/typescript/bin/tsc -b
node ./node_modules/typescript/bin/tsc -p tsconfig.server.json
node ./node_modules/eslint/bin/eslint.js .
echo "  ✓ clean"

echo "Step 2/5: building"
SENTRY_RELEASE="$RELEASE" node ./node_modules/typescript/bin/tsc -b
SENTRY_RELEASE="$RELEASE" node ./node_modules/vite/bin/vite.js build
echo "  ✓ built"

echo "Step 3/5: updating plist SENTRY_RELEASE → $RELEASE"
/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:SENTRY_RELEASE $RELEASE" "$PLIST_TARGET"
echo "  ✓ updated"

echo "Step 4/5: reloading launchd service"
# `launchctl kickstart -k` is NOT sufficient here: it restarts the running
# program but keeps launchd's cached env vars from when the plist was first
# bootstrapped. After editing plist EnvironmentVariables (we just did, via
# PlistBuddy), the new value only takes effect after a full bootout/bootstrap.
DOMAIN="gui/$(id -u)"
if launchctl print "${DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${DOMAIN}/${LABEL}"
fi
launchctl bootstrap "${DOMAIN}" "$PLIST_TARGET"
echo "  ✓ reloaded"

echo "Step 5/5: verifying env propagated"
# `ps eww` prints the process environment; grep for the new release to confirm
# launchd actually picked up the plist change (not just restarted the old env).
sleep 1
PID=$(launchctl print "${DOMAIN}/${LABEL}" | awk '/^\tpid =/ {print $3}' | head -1)
if [ -n "${PID:-}" ]; then
  if ps eww -p "$PID" 2>/dev/null | grep -q "SENTRY_RELEASE=${RELEASE}"; then
    echo "  ✓ env confirmed: SENTRY_RELEASE=${RELEASE} on pid $PID"
  else
    echo "  ⚠  could not confirm SENTRY_RELEASE on pid $PID — inspect:"
    echo "      ps eww -p $PID | tr ' ' '\\n' | grep SENTRY"
  fi
else
  echo "  ⚠  service has no pid yet — check $HOME/Library/Logs/checkmate.log"
fi

echo
echo "==> Done. Release $RELEASE is live."
echo "    Tail the log:  tail -f $HOME/Library/Logs/checkmate.log"
