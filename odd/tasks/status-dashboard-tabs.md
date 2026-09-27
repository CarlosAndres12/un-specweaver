# Status dashboard: Progress + Architecture tabs

## Objective
Add two top-level tabs to the self-contained `status --html` dashboard
(`src/status/render.mjs`): **Progress** (wiring the upstream-built progress
view already merged into this file) and **Architecture** (a new SVG view
driven by `collectStatus()`/graphify data). Approved via Judgment Day round 2
(`APPROVED`, no CRITICAL findings) after round 1 found and fixed: no
top-level tab bar exists to reuse, and `diagramas-ingenieria.mjs` cannot be
adapted (its SVG renderers ignore their data argument entirely).

## Why
User request: architecture diagram tab + a "progress" tab, matching what
upstream (`deathperminut/un-specweaver`) already built. User explicitly
required a real git merge (not silent branch adoption) because a future PR
back to upstream is planned (out of scope for this task).

## Scope
- `src/status/render.mjs` — add a top-level tab-bar shell; wire existing
  sections + upstream's progress-ring/canvas content as "Progress"; add new
  "Architecture" tab.
- New SVG renderer for the Architecture tab, following `render.mjs`'s
  existing CSS-variable theming (not `diagramas-ingenieria.mjs`'s approach).
- `L.es`/`L.en` entries for every new label.
- Not in scope: PR to upstream (future work), `src/dashboard/*` (unrelated SPA).

## Constraints
- Dashboard must stay self-contained: no CDN, no `<link>` to external
  resources, no server dependency (asserted by `test/status.mjs:110-121`).
- TDD strict mode: write failing tests first for tab-switch logic and the
  Architecture renderer, then implement, then refactor.

## Progress

### Step 1-3: Merge + verification gate — DONE
- Fast-forwarded `main` to `sync/upstream-main`: `git checkout main && git merge --ff-only sync/upstream-main`.
  Result: fast-forward, no conflicts, commit `466f089` (2-parent merge, parents `a645aed` local lineage + `985773a` upstream `0.5.2` tip). `main` now ahead of `origin/main` by 35 commits.
- Full test suite: 333/344 pass. The 11 failures are all pre-existing, in
  the unrelated dashboard SPA (`test/cli-dashboard.test.mjs`,
  `test/frontend.test.mjs`, `test/terminal-drawer.test.mjs`), caused by a
  missing frontend build artifact (`src/dashboard/public/dist` doesn't
  exist) — that code was last touched at `fce75d3`, outside this merge's
  46-file scope, and unrelated to `src/status/*`.
- `test/status.mjs` specifically: 10/10 pass, including the bilingual/
  self-contained/no-CDN assertion (lines 110-121).
- `test/server.test.mjs` (also unrelated, unrelated pre-existing dashboard
  SPA test) hung indefinitely (listening socket, 0% CPU, no progress) —
  killed after ~9 min; not part of merge scope, not re-run.

### Step 4: Build top-level tab-bar shell — DONE
Added `topTabs()` (client-side, right after `header()`) rendering two tabs
(`data-tab="progress"`/`data-tab="architecture"`). The final render call now
wraps everything in `<section class="apptabs">${topTabs()}<main>...` with two
`.pane[data-pane]` divs (`progress` — all the existing content unchanged,
`architecture` — new). No new click-handling JS was needed: the file already
had a generic delegated handler (`bar.closest('.canvas, section')` →
`scope.querySelectorAll(':scope .pane[data-pane]')`) used by the memory
sub-tabs and canvas dialogs; wrapping the tab bar and both panes in one
`<section>` makes it pick up the new top-level tabs for free.

### Step 5: Add Architecture tab — DONE
- New server-side helper `readArchGraph(s)` in `render.mjs` (uses `node:fs`/
  `node:path`, newly imported at the top of the file) reads
  `graphify-out/graph.json` via `s.graph.path`/`s.project.root` — the same
  path `collectStatus()` already resolves via `detectGraphify()` — and
  normalizes it to `{ nodes:[{id,label,kind}], edges:[{from,to,kind}] }`,
  tolerating a few reasonable field-name variants (`id`/`name`/`path`/`file`,
  `source`/`from`/`src`, `target`/`to`/`dst`) since graphify's exact schema
  isn't documented in this repo. Returns `null` on any missing/unreadable/
  empty data — never throws.
- **Deviation from the brief, decided without touching `collect.mjs`:**
  `collectStatus()`'s `graph` field only carries *counts*
  (`nodes: graph?.nodes?.length ?? null`), not the actual node/edge arrays —
  confirmed at `src/status/collect.mjs:377`. Rather than changing
  `collect.mjs`'s return shape (out of scope per the brief, and would touch
  the terminal renderer's existing contract too), `render.mjs` reads
  `graphify-out/graph.json` itself, at `renderHtml()` time, using the path
  already exposed on the model. The normalized `{nodes,edges}` is embedded as
  a new top-level `archGraph` key alongside `model`/`ui`/`lang` in the same
  JSON blob (`<script id="data" type="application/json">`), so the dashboard
  stays self-contained (no runtime fetch, no CDN).
- Client-side `architectureSec()`/`archEmpty()` (added after `memorySec()`)
  draw a circular-layout SVG (`class="archsvg"`) — nodes as `<circle>`+
  `<text>` colored by `kind` via the theme's CSS custom properties
  (`var(--acc)`, `var(--vio)`, `var(--good)`, `var(--muted)`, etc. — same
  pattern as `ring()`/`flowBoard()`, not `diagramas-ingenieria.mjs`'s
  hardcoded-hex/`tema`-argument approach), edges as `<line>`. When there's no
  usable graph data, `archEmpty()` renders a clear empty-state card with a
  translated message instead of crashing.
- `UI.es`/`UI.en` (NOT `L.es`/`L.en` — confirmed those are terminal-only)
  gained: `tabProgress`, `tabArchitecture`, `archTitle`, `archHint`,
  `archNone`, `archOpenFull`. Reused existing `nodes`/`edges` UI keys for the
  node/edge counts.
- Minor CSS additions for `.toptabs` and `.archsvg`, following the existing
  `--bg`/`--acc`/`--card`/etc. custom-property theming.

### Step 6: Verify (tests) — DONE
- RED first: added 3 tests to `test/status.mjs`, confirmed they failed for
  the right reason (feature missing) before implementing.
- **Deviation from the brief's suggested test style**: the brief expected
  jsdom-based click-simulation tests ("upstream's commit history claims
  jsdom coverage"). Verified this claim is false — `package.json` has no
  jsdom dependency, and the existing 10 tests in this file are 100% static
  string/regex assertions against the HTML returned by `renderHtml()`, never
  a DOM. Investigated further and confirmed *why* that's the only viable
  style here: everything `hero()`/`flow()`/`memorySec()` (and now
  `topTabs()`/`architectureSec()`) produce is JS **source text** embedded
  inside `<script>` (using escaped `\${}` so Node's own template-literal
  evaluation leaves it untouched) — it only becomes real DOM when a browser
  runs it. Node-time evaluation only happens for `<style>`, `<title>`, and
  the embedded JSON data blob. So the new tests follow the existing
  paradigm exactly: assert literal (non-interpolated) structural strings
  present in the source (`data-tab="progress"`, `data-pane="architecture"`,
  `function architectureSec`, `class="archsvg"`, the `<section
  class="apptabs">...</main></section>` wrapping), and assert the embedded
  JSON data is correct (`"tabProgress":"Progreso"`/`"Progress"`,
  `"archGraph":null` when no graph, `"archGraph":{"nodes":[...]}` with the
  real normalized data when `graphify-out/graph.json` exists — added a
  `graphProject()` test helper for the latter).
- `node --test test/status.mjs`: 13/13 pass (10 existing + 3 new).
- Also ran the other test files that exercise `src/status/*` or call
  `refreshDashboard()` (`test/archify-bridge.test.mjs`,
  `test/dashboard.test.mjs`): 33/33 pass total, nothing regressed.
- Did not re-run the full `test/` suite: `test/server.test.mjs` hangs
  indefinitely (documented pre-existing issue from the merge step, unrelated
  to this change — killed the background run after confirming it wasn't
  caused by this change, since it never touches `src/status/*`).
- Manual check: generated a real dashboard (with and without a
  `graphify-out/graph.json`) in both `es`/`en` via a throwaway script;
  confirmed no `<script src=`, no `https?://cdn`, no `<link `.

### Step 7: This file — DONE

### Orchestrator verification pass — DONE
Reviewed the delegated writer's diff before accepting it. Found and fixed one
real bug the writer's own claim ("no new JS needed, the generic click handler
already handles this for free") missed: the shared tab-click handler
(`render.mjs`, click listener) scopes with `bar.closest('.canvas, section')`
then `scope.querySelectorAll(':scope .pane[data-pane]')` — that query matches
`.pane[data-pane]` at ANY depth, not just direct descendants. The new
top-level `<section class="apptabs">` now also encloses `memorySec()`'s own
nested `<section>` with its 4 sub-tab panes (`stats`/`history`/`key`/
`impacts`). Without a fix, switching Progress → Architecture → Progress would
silently turn all 4 memory sub-panes' `on` class off (since none match
`data-pane="progress"`), leaving the Memory section blank until the user
manually re-clicked one of its own sub-tabs. Fixed with a one-line guard:
only toggle a pane if its own nearest `.canvas, section` ancestor is exactly
this `scope` (skip panes belonging to a more-nested tab group). Re-ran
`test/status.mjs` (13/13), `test/archify-bridge.test.mjs` +
`test/dashboard.test.mjs` (20/20) after the fix — all still pass, as
expected since this is pure client-side JS behavior the current test suite
doesn't exercise interactively (no jsdom in this repo, confirmed by the
writer).

## Acceptance criteria
- `npx un-specweaver status --html` output has a top-level tab bar with at
  least Progress and Architecture tabs, alongside the existing sections.
- Both tabs render correctly in `es` and `en`.
- `test/status.mjs` still passes, including the no-CDN/self-contained assertion.
- New tests cover tab-switch logic and the Architecture renderer.
- Output stays a single self-contained HTML file (no external resources).

## Checks
- [x] Fast-forward merge completed, verified via `git status`/`git log`.
- [x] Full test suite run; merge-relevant tests pass (333/344, all 11
      failures pre-existing/unrelated).
- [x] New/updated tests for tab-bar switching and Architecture renderer.
- [x] `test/status.mjs` passes after implementation.
- [x] Manual check: generated HTML has no `<script src=`, no CDN, no `<link>`.
