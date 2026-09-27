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

### T2 — Frontend: tab switcher shell + Progress tab — DONE
Route: delegated direct (writer trigger — `App.jsx` + new `ProgressTab.jsx`,
2+ non-trivial files).
- [x] Added `VIEW_TABS` + `activeTab` state and a `.view-tabs` switcher in
      `App.jsx`, between the header and the main viewport: "Dependencias"
      (existing `ArchitectureFlow`, unchanged) and "Progreso" (new). The
      tabs array is structured so T3 can append an `architecture` entry
      without restructuring.
- [x] `ProgressTab.jsx`: fetches `GET /api/projects/:id/status`, renders
      `model` from `collectStatus()` (field names verified against
      `src/status/collect.mjs`) — metric tiles (requirements coverage/done
      %, stories, tasks, active changes), a phases stepper (6 phases),
      sprint tiles when present, requirements group tiles + orphans, and a
      key-decisions list. Spanish UI copy, matching this app's existing
      convention (`App.jsx` header/buttons are already Spanish).
      Styled with `index.css`'s existing tokens, not `render.mjs`'s inline
      CSS (deliberately out of scope, per the task file).
- [x] `npm run build:ui`: succeeded (`index-BapFwsKo.js`, `index-Cl3eaJL-.css`).
- [x] Manual check: started `node bin/un-specweaver.mjs dashboard --port 0`
      against this repo itself (already a registered `un-specweaver`
      project). `curl /` confirmed the served `index.html` references the
      freshly-built asset filenames. `curl /api/projects/:id/status`
      returned real `model` data (project name, 6 phases with real
      done/partial flags, real `metrics.requirements`, `archGraph: null`
      since no `graphify-out/graph.json` exists here). **No interactive
      browser click-through was performed** — only HTTP-level verification
      that the right bytes/data are served; the tab-click UI itself was not
      visually exercised in a browser.
- [x] Commit (`41d6da5`).

### T3 — Frontend: Architecture tab — DONE
Route: delegated direct (writer trigger — new `ArchitectureTab.jsx` +
`App.jsx` wiring).
- [x] `ArchitectureTab.jsx`: renders `archGraph` (nodes/edges) via
      `@xyflow/react` (no new deps — no dagre/elk in `package.json`, so
      layout is a simple deterministic grid, one column per `node.kind`,
      stacked rows within it, mirroring `ArchitectureFlow`'s own
      wave-column layout instead of adding a layout library). Node kind is
      color-coded using the app's existing accent tokens
      (`--accent-cyan/purple/green/amber/rose`) for on-screen node borders;
      the `MiniMap` uses literal hex fallbacks for the same colors since
      canvas `fillStyle` cannot resolve CSS custom properties — the same
      tradeoff `ArchitectureFlow`'s own `MiniMap` already makes with
      hardcoded hex. Read-only view (`nodesDraggable`/`nodesConnectable`/
      `elementsSelectable` all `false`) since there's no mutation API for
      this graph, unlike the Dependencies tab.
- [x] Wired into `App.jsx`'s `VIEW_TABS` as "Arquitectura", third tab.
- [x] `npm run build:ui`: succeeded (`index-BcF4I95Y.js`, `index-Cl3eaJL-.css`).
- [x] Manual check: `curl /` confirmed `index.html` references the new
      asset filenames. Bonus real-graph check (not skipped): wrote a
      throwaway script that registers a temp project with a real
      `graphify-out/graph.json` (3 nodes, 2 edges) via
      `project-manager.registerProject`, starts `createServer` in-process,
      and curls `/api/projects/:id/status` — confirmed `archGraph` comes
      back correctly normalized (`{id,label,kind}` nodes / `{from,to,kind}`
      edges), matching exactly what `ArchitectureTab.jsx` expects. **No
      interactive browser click-through was performed** — same disclosure
      as T2, only HTTP-level/data verification, not visual/interactive.
- [x] Commit (`cd90c57`).

## Acceptance criteria
- Opening the live dashboard for a project shows Progress and Architecture
  tabs alongside the existing dependency graph, without running `status
  --html`. — **Met**: all three tabs are wired in `App.jsx`'s `VIEW_TABS`;
  end-to-end data flow (real project → endpoint → `archGraph` → rendered
  React Flow nodes/edges shape) verified via the T3 throwaway script. No
  interactive browser click-through was ever performed across T2/T3 —
  disclosed explicitly in both.
- New backend endpoint covered by a `node --test` test (RED confirmed before
  GREEN). — **Met** (T1).
- `npm run build:ui` succeeds after each frontend task. — **Met** (T2, T3).
- No new regressions in `test/dashboard.test.mjs`, `test/frontend.test.mjs`,
  `test/cli-dashboard.test.mjs`, `test/status.mjs` beyond the documented
  pre-existing failures. — **Met, note widened**: T1 found the pre-existing
  failure set is actually 9 tests (all legacy vanilla-SPA related,
  `E4S1-*`/`4.3-1*`/`4.3-2b`), not just the single `terminal-drawer.test.mjs`
  case originally flagged — confirmed via `git stash` to exist identically
  on the clean pre-T1 checkout, so still zero new regressions.

### Post-completion: real interactive browser verification (headless Chromium via CDP)
T2/T3 explicitly disclosed no browser click-through was done. Ran one now:
started the real dashboard server, drove headless `chromium` (`/usr/bin/chromium`,
no Playwright/Puppeteer in this repo) over the DevTools Protocol (raw
WebSocket, no new dependency) to click each tab and screenshot the result.

- Dependencias (unchanged): renders exactly as before, no regression.
- Progreso: renders real data — metric tiles (0/0 FR, 14/28 requirements,
  98/274 tasks 36%, 28 active changes), phases stepper with correct
  done/current state, sprint/requirements tiles, decisions section. Matches
  `collectStatus()`'s actual output for this repo.
- Arquitectura (this repo, no `graphify-out/graph.json`): correctly shows
  the empty state, "Sin grafo de arquitectura disponible (requiere
  graphify-out/graph.json)."
- Arquitectura (populated path): registered a temp project (isolated `HOME`,
  no pollution of the real project list) with a fixture `graphify-out/
  graph.json` (3 nodes, 2 edges, 2 kinds). React Flow rendered 3 nodes / 2
  edges with correct labels and kind-based coloring.

**Bug found and fixed**: the `MiniMap` (bottom-left, fixed overlay) visually
covered a node in the small fixture graph. Root cause: `layoutGraph`'s
deterministic grid always places column-0's last row near the bottom-left of
graph-space, which is exactly where `fitView` + a bottom-left `MiniMap`
collide for small/sparse graphs. Added `fitViewOptions={{ padding: 0.3 }}`
(harmless, more breathing room generally) — reduced but did not eliminate
the overlap for this pathological tiny-graph case. **Confirmed this exact
same MiniMap/node overlap already exists, pre-existing, in the untouched
Dependencies tab** (`ArchitectureFlow.jsx`, same `position="bottom-left"`
MiniMap convention, visible in the `01-dependencies.png` capture) — not a
regression introduced by this feature, and a real fix (e.g. collision-aware
layout or repositioning shared chrome) is out of scope for "add tabs to the
dashboard." Left as a known, pre-existing, cosmetic-only limitation (data/
edges/labels are all correct and unaffected); flagged to the user rather
than silently accepted or silently fixed beyond the small `fitViewOptions`
improvement.

### Follow-up: MiniMap overlap fix, evaluated via Judgment Day (3 rounds)
Full design/review history in `odd/tasks/plan-minimap-overlap.md`.

- **Round 1** (judges A+B, blind/parallel): proposed a nearest-anchor-
  distance corner-picking heuristic. **CRITICAL** — degenerated to ties
  (distance 0) on single-column/single-row/single-node graphs, exactly its
  own differentiating test cases; also a false claim that `@xyflow/react`
  Panels "stack" (they fully overlap).
- **Round 2**: rewrote as a quadrant node-count heuristic in a new pure,
  unit-testable module. Judge A: no critical bug, but a wrong node-width
  constant (150px real vs. 140px assumed). **Judge B: CRITICAL** — quadrant
  classification used only each node's anchor point, ignoring that its
  rendered footprint can straddle the quadrant split, so a node's body can
  still occupy the "empty" quadrant the algorithm picks.
- **User decision point**: two rounds of real bugs in a graph-space
  heuristic trying to predict a screen-space (`fitView`) outcome — user
  chose to abandon the clever-heuristic approach for an empirically-
  validated one instead.
- **Round 3** (final): empirically tested two levers against 7 fixture
  graphs (single-node, single-column, single-row, dense-grid, the original
  3-node repro, a 12-node stress case, a 3-column/long-label case — the
  last added after round-3 review flagged the coverage gap) via the same
  real headless-Chromium/CDP `getBoundingClientRect()` overlap measurement
  used for the original feature verification: `fitViewOptions.padding`
  (0.3→0.6) had **zero measured effect**; an explicit smaller `<MiniMap
  style={{width:100,height:75}}>` (vs. the ~202×152 default) **fixed all 7
  fixtures**, zero overlap. Both judges: **no critical issues** — findings
  were all WARNING/SUGGESTION (fixture coverage gap, since closed; an
  internal wording contradiction in the verification section, since fixed;
  orphaned build artifacts from tuning iterations, cleaned up; the
  now-confirmed-non-load-bearing `padding: 0.3` left without explanation,
  now commented; a cross-tab MiniMap-size inconsistency with the sibling
  `ArchitectureFlow.jsx`, disclosed as an accepted, intentional tradeoff
  rather than fixed — that sibling is pre-existing/out of scope).
- Final diff: one `style` prop on `ArchitectureTab.jsx`'s `<MiniMap>`, plus
  a clarifying comment on the adjacent `fitViewOptions`. `npm run build:ui`
  succeeds; `node --test test/dashboard.test.mjs test/frontend.test.mjs
  test/cli-dashboard.test.mjs test/status.mjs`: 36/45 pass, 9 fail — the
  same, already-documented pre-existing legacy-frontend failures, zero new
  regressions.
- **Disclosed, not solved**: no persisted automated regression test exists
  for this (no jsdom/DOM test infra in this repo); a future change to
  `MiniMap` styling, node sizing, or `fitView` options could silently
  reintroduce the overlap with nothing to catch it. The CDP fixture script
  used for verification is ephemeral (scratchpad only, not committed).
  Corner choice remains fixed at whatever `fitView` computes on initial
  load; user pan/zoom afterward isn't re-evaluated (unchanged from before,
  not worsened).

## Checks
- [x] T1 done, tested, committed (`5efb800`).
- [x] T2 done, built, manually checked, committed (`41d6da5`).
- [x] T3 done, built, manually checked, committed (`cd90c57`).

### Native review assessment (RDD) — skipped, unavailable (infra limit)
RDD is `on` (global). Combined assessment against branch point `466f089`
(`--committed-only`, `.codegraph/` excluded via confirmed untracked
inventory digest): `risk: medium`, 14 files, 1239 changed lines,
`review_due: true` (`slice_budget_reached`). User consented (`granted`) to
review; `gentle-ai review start` failed closed with
`lens_context_budget_exceeded` — the candidate's reviewer evidence exceeds
the native context budget and "is never truncated".

Per-commit retry (isolated `git worktree` per commit, reviewed against its
own immediate parent, per the tool's own "split into smaller candidates"
guidance): T1 alone (195 lines) and T3 alone (229 lines) are `under_budget`
(no review needed there). **T2 alone (522 lines, 7 files) still hit the same
`lens_context_budget_exceeded`** even after user consent — root cause is the
committed minified frontend bundle itself
(`src/dashboard/public/assets/index-BapFwsKo.js`, ~762KB), not authored line
count. There is no supported flag to exclude a tracked path from the
review's diff scope, so further slicing cannot succeed while a built JS
bundle is committed in the same tree as source changes.

User decision (asked directly, `lens_context_budget_exceeded` is a
documented terminal reason code with prescribed continuations, not treated
as a Gentle AI defect): **skip review for this feature**. RDD stays enabled;
the reviewed boundary does NOT advance past `466f089` for this lineage (T2's
522 lines remain formally unreviewed). Push, PR, and merge remain separate,
user-owned decisions under ordinary repository policy, unaffected either
way. Temporary review worktrees (`review-t1`/`review-t2`/`review-t3` under
`../un-specweaver-worktrees/`) were removed after use.

### Follow-up: real-world testing against unal_dasboard found 2 more bugs
User tested the Architecture tab against a real external project
(`/home/carlos/Documents/projects/unal_dasboard`, real graphify output, 692
nodes). Found and fixed both (commit `447833f`; the stale-registration fix
is data, not code, no commit):

1. **Stale project registration** (data, not a code bug): the dashboard's
   own project store had `unal_dasboard` registered at
   `/home/carlos/laptop_ryzen/projects/unal_dasboard` (another machine,
   `exists: false`). With no matching `graphify-out/graph.json` reachable,
   `archGraph` was correctly `null` — the empty-state message was working
   as designed, just pointed at the wrong directory. Fixed by
   `pm.registerProject()` at the real path
   (`/home/carlos/Documents/projects/unal_dasboard`, new id
   `c82c994c-2537-431e-a169-cb1ef3ac9f0d`) and setting it active. The old
   stale entry (`8c3f2816-...`) was left in place — no `removeProject()`
   exists in `project-manager.mjs` to clean it up; harmless, just unused
   clutter in the project list.
2. **`readArchGraph()` only read `raw.edges`** — graphify's real output is
   `networkx.node_link_data()` JSON, where edges live under `links`. Real
   projects therefore always showed 0 edges (confirmed: unal_dasboard
   reported 1286 edges via graphify's own CLI output, but
   `readArchGraph()` returned `edges: []`). Fixed with a fallback to
   `raw.links` when `raw.edges` is absent (RED/GREEN, new test in
   `test/status.mjs`); verified against the real file:
   `{ nodes: 692, edges: 1286 }`, matching graphify exactly. Also verified
   end-to-end through the real (non-isolated-HOME) dashboard server hitting
   `/api/projects/:id/status` for the corrected project id.
3. `node --test test/dashboard.test.mjs test/frontend.test.mjs
   test/cli-dashboard.test.mjs test/status.mjs`: 37/46 pass, same 9
   pre-existing failures, zero new regressions (46 = 45 + 1 new test).
