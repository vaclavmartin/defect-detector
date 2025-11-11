#!/usr/bin/env bash
set -euo pipefail

# Launch Next.js dev server and open Chrome to the app page on macOS.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

# Ensure no previous dev servers are still running on the target port
if command -v lsof >/dev/null 2>&1; then
  EXISTING_PIDS="$(lsof -ti tcp:${PORT} || true)"
  if [ -n "${EXISTING_PIDS}" ]; then
    echo "Terminating existing processes on port ${PORT}: ${EXISTING_PIDS}"
    kill ${EXISTING_PIDS} >/dev/null 2>&1 || true
    # Grace period
    for i in {1..10}; do
      sleep 0.3
      REMAINING="$(lsof -ti tcp:${PORT} || true)"
      if [ -z "${REMAINING}" ]; then
        break
      fi
    done
    # Force kill if still present
    REMAINING="$(lsof -ti tcp:${PORT} || true)"
    if [ -n "${REMAINING}" ]; then
      echo "Forcibly killing remaining processes on port ${PORT}: ${REMAINING}"
      kill -9 ${REMAINING} >/dev/null 2>&1 || true
    fi
  fi
fi

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


