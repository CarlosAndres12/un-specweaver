# Live dashboard: Progress + Architecture tabs

## Objective
Bring the "Progress" and "Architecture" views that today only exist in the
standalone `un-specweaver status --html` report (`src/status/render.mjs`)
into the always-running multi-project web dashboard (`un-specweaver
dashboard`/`ui`, React app under `src/dashboard/frontend/src`), so viewing
them doesn't require a separate CLI command per project.

## Why
User request: navigating between CLI-generated reports and the live
dashboard is friction; wants both views reachable as tabs inside the
dashboard itself.

## Scope
- `src/dashboard/server.mjs` — new `GET /api/projects/:id/status` endpoint
  returning `{ model: collectStatus(project.path), archGraph }`.
- `src/status/render.mjs` — export `readArchGraph` (currently private) for
  reuse by the server instead of duplicating the graphify-JSON parsing.
- `src/dashboard/frontend/src/` — new tab switcher in `App.jsx` (existing
  React-Flow story-dependency view becomes one tab, e.g. "Dependencies");
  new `ProgressTab.jsx` (metrics/phases/requirements/changes/decisions,
  fed by the new endpoint) and `ArchitectureTab.jsx` (graphify module graph)
  components, styled with the dashboard's own tokens in `index.css` — not a
  port of `render.mjs`'s inline CSS, which belongs to the offline-report use
  case.
- Not in scope: `src/status/render.mjs`'s own tab UI (`status --html` stays
  as-is, self-contained/offline), the legacy vanilla `src/dashboard/public/
  app.mjs` + `components/*.mjs` (confirmed dead code — `index.html` does not
  load `app.mjs`), fixing pre-existing unrelated test failures.

## Constraints / known environment
- No frontend test framework exists in this repo (no jsdom/vitest/testing-
  library in `devDependencies`) — only `vite`/`@vitejs/plugin-react` for
  building. Strict TDD applies where a runner exists: the backend endpoint
  (`node --test`, existing pattern in `test/frontend.test.mjs`). The two
  frontend components have no automated-test path available; verification
  for those is build (`npm run build:ui`) + manual dashboard run + reporting
  that no interactive browser click-through was performed, per instructions
  not to claim UI verification that wasn't done.
- Known pre-existing failures, unrelated to this change (confirmed by
  running `node --test test/cli-dashboard.test.mjs test/dashboard.test.mjs
  test/frontend.test.mjs test/terminal-drawer.test.mjs` before starting):
  `test/terminal-drawer.test.mjs` asserts strings from the legacy vanilla
  frontend (`"Panel de Control"`, `#terminal-drawer`) against the actually-
  served React `index.html` — that frontend was already replaced before this
  task. Any other failure in those files is NOT automatically assumed
  pre-existing; re-check if a run surprises us.
- TDD mode: strict (source: user's global CLAUDE.md). Runner: `node --test
  test/*.mjs`.

## Progress

### T1 — Backend: `GET /api/projects/:id/status` endpoint — DONE
Route: delegated direct (writer trigger — `server.mjs` + `render.mjs` +
new/updated test file, 3 non-trivial files).
- [x] Export `readArchGraph` from `src/status/render.mjs`.
- [x] Add `GET /api/projects/:id/status` in `server.mjs`, following the
      existing `/api/projects/:id/graph` handler pattern (regex match,
      `pm.getProject`, typed error handling via `sendProjectNotFound`/
      `sendTypedError`).
- [x] RED: 2 tests added to `test/dashboard.test.mjs` (200 shape + 404
      unknown id). Confirmed the 200-case failed with `404 !== 200` before
      the route existed (endpoint missing, fell through to the generic
      catch-all).
- [x] GREEN: implemented, both new tests pass (12/12 in
      `test/dashboard.test.mjs`).
- [x] Ran `node --test test/dashboard.test.mjs test/frontend.test.mjs
      test/cli-dashboard.test.mjs test/status.mjs`: 36/45 pass, 9 fail.
      Verified via `git stash` that the exact same 9 failures (all legacy
      vanilla-SPA related: `E4S1-*`, `4.3-1*`) exist identically on the
      clean checkout before this change — zero new regressions, only the 2
      new tests added.
- [x] Commit (conventional commit, feature branch
      `feat/live-dashboard-status-tabs`).

### T2 — Frontend: tab switcher shell + Progress tab
Route: delegated direct (writer trigger — `App.jsx` + new `ProgressTab.jsx`,
2+ non-trivial files).
- [ ] Add a tab switcher in `App.jsx`: "Dependencies" (existing
      `ArchitectureFlow`), "Progress" (new).
- [ ] `ProgressTab.jsx`: fetch `/api/projects/:id/status`, render key
      metrics/phases/requirements/changes/decisions using `index.css`
      tokens.
- [ ] `npm run build:ui` succeeds.
- [ ] Manual check: start dashboard server, `curl` the served page and the
      new endpoint for a real project, confirm expected content/shape.
      Disclose explicitly that no interactive browser session was used.
- [ ] Commit.

### T3 — Frontend: Architecture tab
Route: delegated direct (writer trigger — new `ArchitectureTab.jsx` +
`App.jsx` wiring).
- [ ] `ArchitectureTab.jsx`: render `archGraph` (nodes/edges). Reuse
      `@xyflow/react` (already a dependency, already used for the
      Dependencies tab) instead of hand-rolled SVG, for a consistent
      pan/zoom UX — deviation from `render.mjs`'s static circular-SVG
      approach, justified by React Flow already being in place here.
- [ ] Wire into the tab switcher from T2.
- [ ] `npm run build:ui` succeeds.
- [ ] Manual check as in T2.
- [ ] Commit.

## Acceptance criteria
- Opening the live dashboard for a project shows Progress and Architecture
  tabs alongside the existing dependency graph, without running `status
  --html`.
- New backend endpoint covered by a `node --test` test (RED confirmed before
  GREEN).
- `npm run build:ui` succeeds after each frontend task.
- No new regressions in `test/dashboard.test.mjs`, `test/frontend.test.mjs`,
  `test/cli-dashboard.test.mjs`, `test/status.mjs` beyond the documented
  pre-existing `terminal-drawer.test.mjs` failures.

## Checks
- [ ] T1 done, tested, committed.
- [ ] T2 done, built, manually checked, committed.
- [ ] T3 done, built, manually checked, committed.
