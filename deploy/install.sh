#!/usr/bin/env bash
# Install checkmate as a launchd agent on macOS.
# Prompts for the password, generates a JWT secret, populates
# ~/Library/LaunchAgents/cc.cgen.checkmate.plist, and starts the service.

set -euo pipefail

LABEL="cc.cgen.checkmate"
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PLIST_TEMPLATE="$PROJECT_DIR/deploy/cc.cgen.checkmate.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/cc.cgen.checkmate.plist"
LOG_DIR="$HOME/Library/Logs"

if [ ! -f "$PLIST_TEMPLATE" ]; then
  echo "ERROR: plist template missing at $PLIST_TEMPLATE" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
mkdir -p "$( dirname "$PLIST_TARGET" )"

echo "==> Installing $LABEL"
echo "    Project: $PROJECT_DIR"
echo "    Plist:   $PLIST_TARGET"
echo

echo "Step 1/4: app password"
read -s -p "  Choose a password: " password
echo
read -s -p "  Confirm password:  " password_confirm
echo
if [ "$password" != "$password_confirm" ]; then
  echo "ERROR: passwords don't match" >&2
  exit 1
fi
if [ -z "$password" ]; then
  echo "ERROR: password cannot be empty" >&2
  exit 1
fi

cd "$PROJECT_DIR"
PASSWORD_HASH=$(node -e "
  const bcrypt = require('bcryptjs');
  let s='';
  process.stdin.on('data', d => s += d);
  process.stdin.on('end', async () => {
    const h = await bcrypt.hash(s, 10);
    process.stdout.write(h);
  });
" <<< "$password")
echo "  ✓ password hashed"

echo "Step 2/4: JWT secret"
JWT_SECRET=$(openssl rand -hex 32)
echo "  ✓ generated"

echo "Step 3/4: writing $PLIST_TARGET"
read -p "  Sentry server DSN (press enter to skip): " SENTRY_DSN_INPUT
SENTRY_DSN_VALUE=${SENTRY_DSN_INPUT:-}
ESCAPED_HASH=$(printf '%s\n' "$PASSWORD_HASH" | sed 's/[\/&]/\\&/g')
ESCAPED_SECRET=$(printf '%s\n' "$JWT_SECRET" | sed 's/[\/&]/\\&/g')
ESCAPED_DSN=$(printf '%s\n' "$SENTRY_DSN_VALUE" | sed 's/[\/&]/\\&/g')
sed \
  -e "s/__REPLACE_AUTH_PASSWORD_HASH__/$ESCAPED_HASH/" \
  -e "s/__REPLACE_JWT_SECRET__/$ESCAPED_SECRET/" \
  -e "s/__REPLACE_SENTRY_DSN_SERVER__/$ESCAPED_DSN/" \
  "$PLIST_TEMPLATE" > "$PLIST_TARGET"
chmod 600 "$PLIST_TARGET"
echo "  ✓ written ($PLIST_TARGET)"

echo "Step 4/4: starting the service"
if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
fi
launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"
echo "  ✓ loaded"
echo
echo "==> Done. The app should be running on http://localhost:5184 in a few seconds."
echo "    Tail the log:  tail -f $LOG_DIR/checkmate.log"
echo
echo "==> Next: expose it via the existing cgen-tunnel."
echo "    1. Edit ~/.cloudflared/config.yml — add (above the http_status:404 catch-all):"
echo
echo "         - hostname: checkmate.cgen.cc"
echo "           service: http://localhost:5184"
echo
echo "    2. Map the DNS:"
echo "         cloudflared tunnel route dns cgen-tunnel checkmate.cgen.cc"
echo
echo "    3. Reload the tunnel:"
echo "         launchctl kickstart -k gui/\$(id -u)/cc.cgen.cloudflared"
echo
echo "    Then browse https://checkmate.cgen.cc"
