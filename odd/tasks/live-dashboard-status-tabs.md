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

## Extension: diagram-type classification (Component / Package / C4-Container)

User request: the Architecture tab should not be locked to one flat
kind-grouped graph; an agent-style step should look at the target project
and produce whichever diagram type(s) from a broad engineering taxonomy
(UML behavioral/structural, ERD/DFD, C4, cloud topology, EDA) actually fit.
Scoped down after discussion: **start small** — pick only among diagram
types graphify's own data can actually support today (Component, Package,
C4-Container), not a full source-reading LLM agent yet. User also wants
this runnable both wired into the existing pipeline (feeds this tab) and as
a standalone step.

**Bug found during design, verified against the real `unal_dasboard`
graphify output (692 nodes)**: real graphify nodes have NO `kind`/`type`/
`category` field at all — `readArchGraph()`'s node-kind extraction
(`render.mjs:213`) silently collapses to `''` for every node on real data,
so the current "grouped by kind" Component view is actually one unsorted
column for real projects, not a bug the fixtures caught (fixtures always
set `kind` explicitly). Real edges carry `relation` (`imports`,
`re_exports`, `contains`, …), not `kind`/`type` either — edge semantics are
silently dropped too (`render.mjs:221`). What real graphify DOES provide:
`source_file` (86 distinct real directory paths in the sample) and
`community`/`community_name` (37 pre-computed clusters from graphify's own
analysis) per node. These are the actual signals available for
classification/grouping — not a new heuristic invented from scratch.

### T4 — Fix graphify field extraction; add diagram-type classification + grouping — DONE
Route: delegated direct (writer trigger — `render.mjs`, `ArchitectureTab.jsx`,
`test/status.mjs`, 3+ non-trivial files).
- [x] `readArchGraph()` (`src/status/render.mjs`): now reads `source_file`
      (→ `sourceFile`), `community` (stringified), `community_name` (→
      `communityName`) per node, alongside the existing `kind/type/category`
      fallback (kept as-is for the hand-written fixtures already in
      `test/status.mjs`); reads `relation` per edge alongside the existing
      `kind/type` fallback (kept, not removed).
- [x] New exported pure function `classifyDiagramType(archGraph)` in
      `render.mjs`: no I/O, no LLM, takes the already-normalized
      `{nodes, edges}` shape (not raw graphify JSON) so it's directly
      unit-testable with in-memory fixtures. Returns
      `{ diagramType, groups: Map<nodeId, {group, groupLabel}> }`.
      Rules implemented exactly as scoped: (a) every node has non-empty
      `kind` → `component`, grouped by `kind` (today's behavior, byte-for-
      byte unchanged); (b) else, top-level `sourceFile` segment counted —
      if there are non-empty segments, `distinctSegments.size <= 8`, and
      `nodeCount / distinctSegments.size >= 3` → `c4-container`, grouped by
      that top-level segment (nodes with empty `sourceFile` fall back to
      `community`/`'other'`); (c) else if any node has `sourceFile` →
      `package`, grouped by the full directory portion (everything before
      the last `/`; a file directly at the root groups under `''`/label
      `'(root)'` — not explicitly specified in the task, my own reasonable
      default, flagging it as a minor decision beyond the letter of the
      spec); (d) else (no `sourceFile` at all) → `component`, grouped by
      `community` (label `communityName` if present).
- [x] `readArchGraph()` wires `classifyDiagramType()` in: attaches
      `group`/`groupLabel` per node and a top-level `archGraph.diagramType`.
      All existing fields (`kind`, `id`, `label`, edge `kind`) are kept,
      only new fields were added.
- [x] RED confirmed first: added the `classifyDiagramType` import to
      `test/status.mjs` before the export existed —
      `node --test test/status.mjs` failed at module-load time
      (`SyntaxError: ... does not provide an export named
      'classifyDiagramType'`), i.e. the whole file failed to even run,
      which counts as RED for every new test in it.
- [x] GREEN: implemented; added 5 new tests to `test/status.mjs` — 4 pure
      `classifyDiagramType()` unit tests (one per branch: legacy-`kind`
      fixture unaffected, `c4-container` via 9-node/3-top-dir fixture,
      `package` via 5-node/5-distinct-top-dir fixture, `component`-via-
      community-only fallback with no `sourceFile` at all) plus 1
      integration test through `readArchGraph()` on a realistic no-`kind`
      graphify-shaped fixture (`source_file`/`community`/`community_name`
      on nodes, `relation` on edges, `links` not `edges`) confirming
      `diagramType`/`group`/`groupLabel` are wired end-to-end. Also had to
      update one pre-existing assertion (`test/status.mjs`, the
      "acepta el formato node-link de NetworkX" test) that did
      `assert.deepEqual(g.edges, [{from,to,kind}])` — adding the new
      `relation` field to every edge made that a structurally different
      object, so the expected literal now includes `relation: ''` (the
      fixture has no `relation` field). This is a mechanical consequence of
      adding a field alongside `kind`, not a behavior change — the fixture-
      style (`kind`-having) classification path itself is unaffected and
      re-verified by the first new unit test.
      `node --test test/status.mjs`: **19/19 pass** (14 pre-existing + 5
      new), zero failures.
- [x] `ArchitectureTab.jsx`: `layoutGraph()` now groups by `node.group`
      (falling back to `'other'`) instead of `node.kind`; renamed the
      internal color helpers/`kindOrder` → `groupOrder` accordingly (pure
      rename, same grid-layout algorithm). Added an `archGraph.diagramType`
      label via a small `<Panel position="top-left">` from `@xyflow/react`
      next to the toolbar (`DIAGRAM_TYPE_LABELS` maps `component`/`package`/
      `c4-container` to a short Spanish label, falling back to a generic
      "Diagrama de arquitectura" for an unknown/null value) — kept simple
      per instructions, no new UI chrome beyond that one label. The
      previous fixture-shaped (`kind`-having, classified as `component`)
      case is visually unaffected since grouping-by-kind is exactly what
      `classifyDiagramType()` does for that path.
- [x] `npm run build:ui`: succeeded (`index-BPmufDpS.js`,
      `index-Cl3eaJL-.css`, same CSS hash as T3 since no CSS changed).
      **No interactive browser click-through was performed** for this task
      (same disclosure as T2/T3) — verification here is
      `node --test`/pure-function coverage plus the build succeeding, not a
      visual/manual check against a real project's `graphify-out/graph.json`
      run through the actual dashboard UI. The realistic-shape coverage
      comes from the new `readArchGraph()` integration test (6-node,
      2-top-dir → `c4-container` fixture matching the real `unal_dasboard`
      field shapes), not a live run against `unal_dasboard` itself.
- [x] Full suite: `node --test test/dashboard.test.mjs test/frontend.test.mjs
      test/cli-dashboard.test.mjs test/status.mjs` → **51 tests, 42 pass, 9
      fail**. Re-verified the baseline via `git stash`: clean checkout is
      **46 tests, 37 pass, 9 fail**, same 9 failing test names
      (`4.3-1`, `4.3-1b`, `4.3-2b`, `E4S1-0`, `E4S1-1`, `E4S1-2`, `E4S1-3`,
      `E4S1-4`, `E4S1-extra` — all legacy vanilla-SPA-related, unrelated to
      this change). 51 − 46 = 5 = exactly the new tests added, all passing.
      Zero new regressions.
- [x] Committed: `bda2777`.

#### Native review assessment (RDD) — skipped, same terminal condition as T2
RDD is `on` (global). Assessed against branch point `466f089` (still
unreviewed since T1-T3, per the earlier documented user decision):
`risk: medium`, 18 files, 1980 changed lines, `review_due: true`
(`slice_budget_reached`). User granted consent; `gentle-ai review start`
failed closed with `lens_context_budget_exceeded`. Retried isolated
(commit `bda2777` alone vs its immediate parent `b0df89e`, no worktree
needed since it's already `HEAD`): 6 files, 421 lines, still medium risk,
user granted consent again (fresh candidate, fresh consent) — **same
`lens_context_budget_exceeded` failure**, confirming the T2 precedent: the
committed minified bundle (`src/dashboard/public/assets/index-BPmufDpS.js`)
blows the reviewer's context budget regardless of authored line count, and
there is still no supported flag to exclude a tracked path from review
scope. User decision (asked directly): **skip review for T4**, same as T2.
RDD stays enabled; the reviewed boundary does not advance past `466f089`
for this lineage. Push, PR, and merge remain separate, user-owned
decisions, unaffected either way.

### T5 — Standalone step to run the same analysis outside the dashboard — DONE
Route: delegated direct.
- [x] New CLI entry point: `un-specweaver architecture [dir] [--json]`
      (`bin/un-specweaver.mjs`, new `case 'architecture'` in the main
      switch, right before `vendors`, same pattern as `status`: positional
      `[dir]` resolved with `path.resolve(o._[0] || process.cwd())`, reuses
      the shared `flags()`/`o.json` parsing already used by `status --json`
      — no bespoke arg parser like `dashboard`'s, since this command has no
      flags beyond `--json`/`--help`/`--version` that `flags()` doesn't
      already cover). Does NOT call `collectStatus()` (the full
      BMAD/OpenSpec/decisions pipeline) — builds only the minimal
      `{ project: { root }, graph: { path } }` shape `readArchGraph()`
      actually needs, via `detectGraphify(root)` from `src/env.mjs` (the
      same helper `collectStatus()` itself uses internally to build
      `s.graph.path`), confirmed by reading `collectStatus()` before
      reusing it rather than guessing the contract. Calls
      `readArchGraph()` (which internally calls `classifyDiagramType()` and
      attaches `group`/`groupLabel`/`diagramType`, both already exported
      from T4) and prints either `{ archGraph }` as JSON (`--json`) or a
      concise Spanish summary: diagram type (with the same
      `DIAGRAM_TYPE_LABELS` wording as `ArchitectureTab.jsx`, kept in sync
      manually since there's no shared module for it), node/edge counts,
      and the top 10 groups by node count. Missing
      `graphify-out/graph.json` does not crash: `readArchGraph()` already
      returns `null` in that case (same helper the dashboard's empty state
      relies on), and the CLI prints one line ("Sin grafo de arquitectura
      disponible... Corre: graphify update .") and exits 0 — mirrors the
      dashboard's empty-state handling exactly, no new error path invented.
- [x] RED confirmed first: added 2 new tests to `test/status.mjs` invoking
      `node bin/un-specweaver.mjs architecture` via `execFileSync` (same
      subprocess-CLI-test pattern already used in that file for `status`,
      `close`, `doctor`) before the subcommand existed —
      `node --test test/status.mjs`: 19 pass, 2 fail (`Comando desconocido:
      architecture`, exit 2), confirming the tests fail for the right
      reason against current code.
- [x] GREEN: implemented; `node --test test/status.mjs`: **21/21 pass**
      (19 pre-existing + 2 new), zero failures. New tests: (a) happy path —
      reuses the existing `graphProject(nodes, edges)` fixture helper (a
      3-node/2-edge graph with explicit `kind`, same fixture already used
      for the `Arquitectura: con graph.json real...` test above) to build a
      temp project with `graphify-out/graph.json`, then asserts the
      terminal summary (`component`, `Nodos: 3`, `Aristas: 2`), that the
      same command also accepts the path as a positional argument (not
      just via `cwd`, mirroring `status [dir]`), and that `--json` prints
      `{ archGraph: { diagramType, nodes, edges, ... } }` with the expected
      shape (including a spot-check that `group` was attached per node);
      (b) missing-graph path — reuses `midProject()` (a fixture with no
      `graphify-out/`) and asserts the CLI prints the "Sin grafo..."
      message and `--json` prints `{"archGraph":null}`, both via
      `execFileSync` with no try/catch — a non-zero exit code would have
      made `execFileSync` itself throw and fail the test, so this doubles
      as the exit-code-0 assertion.
- [x] Full regression: `node --test test/dashboard.test.mjs
      test/frontend.test.mjs test/cli-dashboard.test.mjs test/status.mjs`
      → **53 tests, 44 pass, 9 fail**. Same exact 9 pre-existing failing
      test names as T4's baseline (`4.3-1`, `4.3-1b`, `4.3-2b`, `E4S1-0`,
      `E4S1-1`, `E4S1-2`, `E4S1-3`, `E4S1-4`, `E4S1-extra` — all legacy
      vanilla-SPA-related, unrelated to this change). 53 − 51 (T4 total) =
      2 = exactly the new tests added, both passing. Zero new regressions.
- [x] Manual check against real fixtures (pasted verbatim below), not just
      `node --test`: (1) this repo itself (`un-specweaver architecture .`
      and `--json`), no `graphify-out/graph.json` here — prints the empty
      message, exits 0, `--json` prints `{"archGraph":null}`; (2) the real
      external `unal_dasboard` project (`/home/carlos/Documents/projects/
      unal_dasboard`, real graphify output, 692 nodes/1286 edges, already
      used for the T4 real-world bugfix) — classified `c4-container`,
      matching T4's earlier finding for this exact project, with
      `dashboard`/`converter`/`tests`/`scripts` as the largest groups;
      `--json` output shape (`id`/`label`/`kind`/`sourceFile`/`community`/
      `communityName`/`group`/`groupLabel` per node) matches exactly what
      `readArchGraph()` produces and what `ArchitectureTab.jsx` already
      expects. Also checked `architecture --help` falls back to the global
      help and exits 0, same convention every other non-`dashboard`
      subcommand already follows (no bespoke per-command help function was
      added, since none of the other status-like commands have one
      either).
- [x] Updated `README.md`: added `architecture [dir]` to the CLI examples
      block, the command table (new row, right after `status [dir]`), and
      a new `### \`architecture\`` prose subsection mirroring the
      `history`/`status` subsection style. Also corrected "Quince
      comandos" (fifteen) → "Dieciseis comandos" (sixteen) in the same
      section, since counting alias-groups as one row each (as the
      existing table already does for `change/bug/ticket` and
      `dashboard/ui`) the table had exactly 15 rows before this change and
      now has 16 — the pre-existing omission of `close` from that same
      table (it's documented in prose above the table but has no row) was
      left as-is, out of scope for this task.

TDD mode: strict (source: user's global CLAUDE.md), runner `node --test`
(same as T1-T4). T5 closes with its own conventional-commit work-unit on
`feat/live-dashboard-status-tabs`.

#### Deviations / judgment calls from the T5 spec
- The spec suggested reusing "existing helpers from `collect.mjs`/
  `render.mjs`... if such a builder already exists". No standalone
  `s`-shape builder exists outside `collectStatus()` itself (which runs
  the full pipeline) — so the minimal shape is built inline in
  `bin/un-specweaver.mjs` from `detectGraphify()` (from `src/env.mjs`,
  already imported elsewhere in this same file for other commands), not
  duplicated parsing logic, just the same two-line construction
  `collectStatus()` itself does internally (confirmed by reading it, not
  guessed).
- Command name/argument shape: `architecture [dir]` (raw path, not a
  registered-project id) — chosen because `status`, the closest sibling
  command, already takes a raw `[dir]` positional; only `dashboard`/`ui`
  work with registered-project ids (via `project-manager.mjs`), and this
  is explicitly a single-project standalone analysis tool, not a
  multi-project dashboard feature.
#### Native review assessment (RDD) — ran successfully this time, approved
Unlike T2/T4, this commit (`415c4d8`) has no committed frontend bundle in
its diff (4 files: README.md, bin/un-specweaver.mjs, the task doc,
test/status.mjs), so it cleared the `lens_context_budget_exceeded` wall
those hit. Isolated review vs. immediate parent `bda2777` (T4): 4 files,
237 lines, `risk: medium` (`executable_change` in `bin/un-specweaver.mjs`).
User granted consent. `review-reliability` lens ran, **approved**, 3
non-blocking findings (informational, no correction offered/required):
1. **WARNING** (`bin/un-specweaver.mjs:480-484`) — the new `architecture`
   command has no try/catch around `detectGraphify()`/`readArchGraph()`,
   and no test covers an invalid `dir` or a malformed/corrupt
   `graphify-out/graph.json`; such input could surface a raw stack trace
   instead of the CLI's documented 0/1/2 exit-code contract.
2. **WARNING** (`bin/un-specweaver.mjs:490`) — `DIAGRAM_TYPE_LABELS` is a
   hand-duplicated copy of `ArchitectureTab.jsx`'s label map (already
   flagged above as a manual-sync judgment call); no test asserts the two
   stay in sync, so future edits to one without the other would silently
   desync the CLI summary from the dashboard UI.
3. **SUGGESTION** (`test/status.mjs:404-446`) — `architecture --help`'s
   fallback-to-global-help behavior was only checked manually (see above),
   not asserted by an automated test.

Acknowledged (`gentle-ai review acknowledge-approved`), authority burned,
lineage `review-92c70b894142d5a7`. Reviewed boundary for this isolated
lineage now sits at `415c4d8`; the T1-T4 backlog since `466f089` remains
formally unreviewed per the earlier documented decision — unaffected by
this. Push, PR, and merge remain separate, user-owned decisions. The 3
findings above are follow-up candidates, not blockers — not applied here
since none opened a correction.

### T6 — Fix the 3 non-blocking findings from T5's review — DONE
User decision: fix now rather than leave as follow-up.
Route: delegated direct (writer trigger — `bin/un-specweaver.mjs`,
`src/status/render.mjs`, `src/status/diagram-labels.mjs` (new),
`src/dashboard/frontend/src/ArchitectureTab.jsx`, `test/status.mjs`,
5 non-trivial files).

**Empirical correction to the finding-1 premise, verified before writing any
fix**: the reviewer's WARNING used hedged language ("could surface a raw
stack trace"). Before touching code, ran both named scenarios directly
against the pre-fix binary:
- `node bin/un-specweaver.mjs architecture /nonexistent/path` → printed
  "Sin grafo de arquitectura disponible..." and exited **0**, no crash.
- `node bin/un-specweaver.mjs architecture <dir-with-corrupt-graph.json>` →
  same message, same exit **0**, no crash.

Root cause of why neither crashes: `readArchGraph()` (`src/status/
render.mjs`) already wraps its entire body — including the
`JSON.parse`/`fs.readFileSync` — in a `try { ... } catch { return null; }`,
by design (its own comment: "Si no hay archivo, no se puede leer o esta
vacio, no hay grafo: se embebe null... en vez de reventar"), and
`detectGraphify()`/`fs.existsSync` never throw for a nonexistent path. Also
checked the two closest sibling commands for their own convention on an
invalid `[dir]`: `node bin/un-specweaver.mjs status /nonexistent/x` and
`... doctor /nonexistent/x` **both** treat it as an empty/uninitialized
project (exit 0 / exit 1-from-doctor's-own-scoring respectively) — neither
validates `dir` existence either. So finding 1's two named scenarios were
already non-crashing and already consistent with existing CLI convention;
the WARNING's underlying static-analysis premise doesn't hold at runtime.
This is disclosed rather than silently "fixed nothing": the fix below adds
real value on top of this correction (see next paragraph), it just isn't a
crash fix for the two literal scenarios named.

**What was actually broken, found during this same verification**: a
corrupt-but-existing `graphify-out/graph.json` was **silently
indistinguishable** from "graphify never ran" — both produced the exact
same "Sin grafo..." message and exit 0, giving a user who HAS run graphify
zero signal that their output is corrupted. That's the real, fixable gap.

- [x] Finding 1 (`bin/un-specweaver.mjs:480-484`, now ~474-506): wrapped
      `detectGraphify()`/`readArchGraph()` in try/catch (defense-in-depth,
      matches the literal remediation ask even though nothing currently
      throws through it). Added a targeted health-check: if
      `detectGraphify()` reports `graph` (file exists on disk) but
      `JSON.parse(fs.readFileSync(...))` on it fails, catch that
      specifically and print `[architecture] no se pudo leer
      graphify-out/graph.json en <root>: <e.message>` to stderr, exit **1**
      — matching the CLI's own established runtime-error convention (same
      pattern as `dashboard`'s `[dashboard] no se pudo iniciar:
      ${e.message}` / exit 1 in the same file; exit 2 is reserved for
      argument-parsing errors like "Opcion desconocida" — confirmed by
      grepping every `process.exit(` call site in `bin/un-specweaver.mjs`).
      This does NOT duplicate the graph-building parse (`readArchGraph()`
      remains the single place that builds the actual `archGraph` model);
      it's a narrow, separate health-check read solely to distinguish
      "no file" from "corrupt file" for the error message/exit code, kept
      inside the same try block as the real call.
      The nonexistent-`dir` case is deliberately left producing the same
      exit-0 "Sin grafo..." message as before, per the sibling-command
      precedent above — changing that would make `architecture` LESS
      consistent with `status [dir]`/`doctor [dir]`, not more.
      Tests added to `test/status.mjs`: (a) nonexistent dir → regression
      test locking in the existing-and-correct exit-0 behavior (RED/GREEN
      note: this test passed unchanged before and after — no crash existed
      to fix, see correction above); (b) corrupt JSON → genuine RED/GREEN:
      before the fix, asserting `r.status !== 0` failed (`actual: 0`,
      i.e. exit 0 exactly like the "no file" case); after the fix, exit 1
      with a `[architecture] ...graph.json...` stderr message, distinct
      from the "Sin grafo..." stdout message.
- [x] Finding 2 (`bin/un-specweaver.mjs:490`): took the **preferred path**
      (real shared module, not a sync test) — created
      `src/status/diagram-labels.mjs`, a module with zero Node-specific
      imports (no `fs`/`path`) exporting `DIAGRAM_TYPE_LABELS`. Re-exported
      from `src/status/render.mjs` (`export { DIAGRAM_TYPE_LABELS } from
      './diagram-labels.mjs'`) so existing Node-side importers (CLI,
      dashboard server) can keep importing from `render.mjs` in one line;
      `bin/un-specweaver.mjs`'s `case 'architecture'` now destructures
      `DIAGRAM_TYPE_LABELS` from that same `render.mjs` import instead of
      a hand-copied literal. `ArchitectureTab.jsx` imports directly from
      `../../../status/diagram-labels.mjs` (NOT from `render.mjs`, since
      that file imports `fs`/`path` at module scope — importing it from the
      browser-bundled frontend would be the actual risk flagged in the
      task; the new module has no such import, so it's safe for Vite).
      Chose this over trying to get Vite to tree-shake around
      `render.mjs`'s unused `fs`/`path` imports for a single named export —
      that would depend on Rollup's ability to fully eliminate a
      side-effectful top-level `import fs from 'node:fs'` for a browser
      target, which isn't guaranteed and wasn't worth the risk when a
      2-line dependency-free module does the same job with certainty.
      `npm run build:ui` succeeded afterward (`vite build`, 2048 modules
      transformed, `index-DztItjiW.js`/`index-Cl3eaJL-.css`, 488ms) —
      confirms the frontend can resolve an import path that reaches
      outside the Vite project root (`src/dashboard/frontend/`) into
      `src/status/`.
      Added a regression test in `test/status.mjs` that (a) asserts
      `DIAGRAM_TYPE_LABELS` (imported from `render.mjs`) has the exact
      expected 3 entries, (b) greps `bin/un-specweaver.mjs`'s source to
      confirm it no longer has its own `const DIAGRAM_TYPE_LABELS = {`
      literal, and (c) greps `ArchitectureTab.jsx`'s source the same way
      plus confirms it imports from `diagram-labels.mjs` — this is a
      stronger regression guard than the fallback "structurally identical"
      sync test would have been, since it fails if either file's
      duplicate copy is ever silently reintroduced, not just if the two
      diverge in content.
- [x] Finding 3 (`test/status.mjs:404-446`): added
      `architecture desde el CLI: --help cae al help global (exit 0), como
      el resto de subcomandos` — runs `node bin/un-specweaver.mjs
      architecture --help` via `spawnSync`, asserts `status === 0` and
      that stdout matches the global `HELP` text (`/USO/`,
      `/un-specweaver/`). RED confirmed: didn't exist before, so this is a
      pure addition (no prior assertion to fail against); its value is
      replacing the previously-manual-only check documented in T5.
- [x] RED before each fix: confirmed for finding 2 by adding
      `DIAGRAM_TYPE_LABELS` to `test/status.mjs`'s top-level import from
      `render.mjs` before the export existed — `node --test test/status.mjs`
      failed at module-load time (`SyntaxError: ... does not provide an
      export named 'DIAGRAM_TYPE_LABELS'`), same style as T4's own RED
      (whole file fails to run). Confirmed for finding 1's corrupt-JSON
      case as a real assertion failure (`actual: 0` where `notEqual 0` was
      expected) — pasted above. Finding 1's nonexistent-dir case and
      finding 3's `--help` case are additions with no crash to reproduce
      (documented, not fabricated).
      Full run before any implementation: `node --test test/status.mjs` →
      1 test, 1 fail (whole-file module-load `SyntaxError`, expected —
      matches T4's own precedent for how a missing export shows up).
      After adding just the `render.mjs` re-export (before touching
      `bin/un-specweaver.mjs`/`ArchitectureTab.jsx`): 25 tests, 23 pass, 2
      fail — the corrupt-JSON test (`actual: 0`) and the dedup-source test
      (still finds the old `const DIAGRAM_TYPE_LABELS = {` literals in
      both files). GREEN after implementing both fixes: **25/25 pass**.
- [x] Full regression: `node --test test/dashboard.test.mjs
      test/frontend.test.mjs test/cli-dashboard.test.mjs test/status.mjs`
      → **57 tests, 48 pass, 9 fail**. Same 9 pre-existing failing test
      names as every prior task's baseline (`4.3-1`, `4.3-1b`, `4.3-2b`,
      `E4S1-0`, `E4S1-1`, `E4S1-2`, `E4S1-3`, `E4S1-4`, `E4S1-extra` — all
      legacy vanilla-SPA-related, unrelated to this change). 57 − 53 (T5
      total) = 4 = exactly the new tests added (nonexistent-dir, corrupt-
      JSON, `--help` fallback, DIAGRAM_TYPE_LABELS dedup/sync), all
      passing. Zero new regressions.
- [x] `npm run build:ui`: succeeded (`index-DztItjiW.js`,
      `index-Cl3eaJL-.css` — same CSS hash as T5 since no CSS changed).
      Verified the built bundle actually contains the label strings
      (`grep -o "Diagrama de componentes" index-DztItjiW.js` → 1 match, as
      expected from a single bundled copy).
- [x] Manual verification (exact terminal output):
      ```
      $ node bin/un-specweaver.mjs architecture /nonexistent/path
      Sin grafo de arquitectura disponible (requiere graphify-out/graph.json). Corre: graphify update .
      EXIT:0

      $ node bin/un-specweaver.mjs architecture <tmpdir-with-corrupt-graphify-out/graph.json>
      [architecture] no se pudo leer graphify-out/graph.json en <tmpdir>: Expected property name or '}' in JSON at position 2 (line 1 column 3)
      EXIT:1
      ```
      Also re-ran `node bin/un-specweaver.mjs architecture .` (this repo,
      no `graphify-out/`) to confirm the happy/empty path is unaffected by
      the new health-check: same "Sin grafo..." message, exit 0.
- [x] Committed (conventional commit) on `feat/live-dashboard-status-tabs`.

#### Native review (RDD) for T6 — declined, not attempted-and-failed
Isolated review vs. immediate parent `415c4d8` was preflighted
successfully this time (unlike the T2/T4 precedent, preflight did NOT fail
with `lens_context_budget_exceeded` before consent was even asked — 8
files, 355 lines, medium risk, `executable_change` in
`bin/un-specweaver.mjs`, lineage `review-a8cf6de114fd7218`). Asked the
user directly whether to review given this commit again includes a
rebuilt frontend bundle (`index-DztItjiW.js`) that might still hit the
same wall once the reviewer lens actually ran; user chose **skip this
time** before the actual reviewer lens was invoked. Declined cleanly
(`consent: declined_this_candidate`), no review record created, RDD stays
enabled. Reviewed boundary stays at `415c4d8` for the isolated-lineage
approach (T5's own boundary); this commit itself is not reviewed.
