#!/usr/bin/env bash
set -euo pipefail

# Launch Next.js dev server and open Chrome to the app page on macOS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

echo "Starting Next.js dev server on ${URL}…"

# Start dev server in background
npm run dev &
DEV_PID=$!

# Ensure child is cleaned up when this script exits
cleanup() {
  if kill -0 "$DEV_PID" >/dev/null 2>&1; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup INT TERM EXIT

# Wait until the server responds or timeout (~30s)
for i in {1..60}; do
  if curl -sSf "$URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Open Chrome if available, otherwise default browser
if /usr/bin/osascript -e 'id of app "Google Chrome"' >/dev/null 2>&1; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi

# Forward output; wait until the dev server stops
wait "$DEV_PID"


