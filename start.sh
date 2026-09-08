#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify Node.js is installed
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required but was not found in PATH." >&2
  exit 1
fi

# Detect target port from arguments (default 3100)
TARGET_PORT=3100
prev=""
for arg in "$@"; do
  if [ "$prev" = "--port" ]; then
    TARGET_PORT="$arg"
  elif [[ "$arg" =~ ^--port=([0-9]+)$ ]]; then
    TARGET_PORT="${BASH_REMATCH[1]}"
  fi
  prev="$arg"
done

# 1. Close any already running un-specweaver dashboard/ui instances
RUNNING_PIDS=$(pgrep -f "[u]n-specweaver(\.mjs)? (dashboard|ui)" 2>/dev/null || true)
for pid in $RUNNING_PIDS; do
  if [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ]; then
    echo "Closing existing un-specweaver dashboard instance (PID: $pid)..."
    kill -15 "$pid" 2>/dev/null || true
  fi
done

# 2. Release target port if still occupied by another process
if [ "$TARGET_PORT" != "0" ]; then
  if command -v lsof >/dev/null 2>&1; then
    PORT_PIDS=$(lsof -ti :"$TARGET_PORT" 2>/dev/null || true)
    for pid in $PORT_PIDS; do
      if [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ]; then
        echo "Releasing port $TARGET_PORT from PID $pid..."
        kill -15 "$pid" 2>/dev/null || true
      fi
    done
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k -TERM "$TARGET_PORT/tcp" 2>/dev/null || true
  fi
fi

# Short wait to let previous instances cleanly release port/resources
sleep 0.3

# 3. Launch the dashboard
if [[ "$*" == *"--no-open"* ]] || [[ "$*" == *"--open"* ]]; then
  exec node "$SCRIPT_DIR/bin/un-specweaver.mjs" dashboard "$@"
else
  exec node "$SCRIPT_DIR/bin/un-specweaver.mjs" dashboard --open "$@"
fi
