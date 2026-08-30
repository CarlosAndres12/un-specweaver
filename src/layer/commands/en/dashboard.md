---
name: dashboard
title: "UB: Dashboard"
description: "Start the multi-project web dashboard on a free port (default 3100), serve the SPA at / and optionally open the browser."
allowed-tools: Bash(npx:*), Read, Glob, Grep
---

# /sw:dashboard — control panel

Start the local dashboard server. Serves the SPA at `/` and exposes the dashboard REST/SSE endpoints.

## Usage

```bash
npx un-specweaver dashboard [--port <n>] [--host <h>] [--open] [--no-open]
npx un-specweaver ui       # alias for dashboard
npx un-specweaver dashboard --help
```

The server starts on a free port (default `3100`). If `3100` is busy it retries `3101`, `3102`... up to `10` attempts. With `--port 0` it uses an ephemeral system port. It always logs:

```
Dashboard en http://127.0.0.1:<port>
```

and serves the SPA at `GET /`.

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port <n>` | `3100` | Port to listen on. `0` = ephemeral. Retries next free port if busy. |
| `--host <h>` | `127.0.0.1` | Host to bind. Use `0.0.0.0` only to expose on LAN. |
| `--open` | `false` | Open the system browser to the effective URL without blocking. |
| `--no-open` | — | Do not open browser (default). Useful to disable inherited `--open`. |
| `--help`, `-h` | — | Show dashboard help. |
| `--version`, `-v` | — | Show version. |

Browser opening (Chromium preferred): `darwin` → `open -a Chromium` → `open -a "Google Chrome"` → `open`, `linux` → `chromium-browser` → `chromium` → `google-chrome` → `xdg-open`, `win32` → `cmd /c start chrome` → `cmd /c start`. Spawned detached + `unref` so it never blocks.

## Examples

```bash
# Start on 3100 (or next free) and print URL
npx un-specweaver dashboard

# Short alias
npx un-specweaver ui

# Fixed port and auto-open browser
npx un-specweaver dashboard --port 3200 --open

# Ephemeral port with explicit host
npx un-specweaver dashboard --port 0 --host 127.0.0.1

# Force no browser even if --open was implied
npx un-specweaver dashboard --no-open

# Help
npx un-specweaver dashboard --help
```

### `--open` with busy port

```bash
# If 3200 is busy the server starts on 3201 and opens http://127.0.0.1:3201
npx un-specweaver dashboard --open --port 3200
```

The opened URL is always the effective `host:port`, not the requested one.

## Notes

- **Strict ESM**: `type: module`, native `import`/`export`, no `require`. Requires **Node >=20.11** (`engines` in `package.json`).
- **No `process.chdir`**: the server never changes global cwd; every project path is absolute and passed as subprocess `cwd`.
- **Clean shutdown**: `SIGINT`/`SIGTERM` (and `SIGBREAK` on Windows) close the server and kill child processes.
- **SPA**: `src/dashboard/public/` is served as static; unknown non-extension routes fall back to `index.html`.
- **Logs**: only `Dashboard en http://...` on `stdout`; errors on `stderr` with `[dashboard]` prefix.
