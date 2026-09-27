# Plan: fix MiniMap/node overlap in the Architecture tab (round 3 — pivoted)

## History
- **Round 1** (Judgment Day, judges A+B): proposed a "nearest-anchor-point
  distance" corner-picking heuristic. **CRITICAL ISSUES FOUND** — degenerate
  ties on single-column/single-row/single-node graphs (the corner reference
  point coincided exactly with a real node's anchor, distance 0), plus a
  false claim that `@xyflow/react` Panels "stack" (they don't — same-corner
  panels fully overlap).
- **Round 2**: rewrote as a quadrant node-count heuristic in a pure,
  unit-testable module. Judge A found no critical algorithmic bug but
  caught a wrong constant (real default node width is 150px, not 140px).
  **Judge B found a deeper CRITICAL issue**: the quadrant classification
  used only each node's anchor point, ignoring that the node's own
  rendered footprint can straddle the quadrant split — in exactly the
  "fixed" cases (single node, single column, single row), the node's body
  physically occupies the quadrant the algorithm reports as empty.
- **Decision point**: two straight rounds found real bugs in a
  graph-space heuristic trying to predict a screen-space (post-`fitView`)
  outcome. User chose to **pivot away from per-graph clever heuristics**
  entirely, in favor of a directly, empirically-verified fix — see
  `AskUserQuestion` exchange in the conversation: "Pivot to padding-based
  fix (recommended)".

## Empirical investigation (this round)
Tested two independent levers against a matrix of 6 fixture graphs (single
node; single column, 2 nodes; single row, 2 kinds; dense 2×2 grid; the
original 3-node/2-kind repro; a 12-node stress case with an 8-row single
column), using the same real headless-Chromium/CDP verification technique
already trusted for this feature (ground truth: actual
`getBoundingClientRect()` overlap between `.react-flow__node` and
`.react-flow__minimap`), not hand-derived math:

1. **`fitViewOptions.padding` (0.3 → 0.6)**: measured **zero effect** — the
   two fixtures that overlapped at `padding: 0.3` (dense-grid, three-node)
   still overlapped identically at `padding: 0.6` (same node, `b.mjs`,
   same overlap). Real measured node scale/position was unchanged between
   the two padding values in the actual rendered DOM. Whatever
   `fitViewOptions.padding` is doing in this `@xyflow/react` version for
   these small/dense graphs, it did not measurably move content away from
   the MiniMap's corner. Root-caused no further — not worth it, the next
   lever fixed it directly and simply. Padding is left at its existing
   `0.3` (harmless, from the prior commit `8b2a639`) but is not load-bearing
   for this fix.
2. **Explicit smaller `MiniMap` footprint** (`style={{ width: 100, height:
   75 }}` vs. the default ~202×152): **fixed all 6 fixtures**, zero overlap,
   confirmed by direct measurement, re-confirmed after reverting the
   padding experiment back to `0.3` (isolating this as the actual effective
   change).

This is a directly verifiable, low-risk fix: shrink the one fixed-size
overlay that was the actual colliding object, verified against real
rendered output across representative graph shapes — no formula to get
subtly wrong, no per-graph logic to unit-test-and-still-miss a screen-space
effect.

## Chosen fix
`src/dashboard/frontend/src/ArchitectureTab.jsx`:
```diff
 <MiniMap
   nodeColor={...}
   nodeStrokeWidth={2}
   position="bottom-left"
+  style={{ width: 100, height: 75 }}
 />
```
One line. `Controls` and `fitViewOptions={{ padding: 0.3 }}` are unchanged.
No new module, no new algorithm, no new test file needed for a formula
(there is no formula) — the verification *is* the evidence.

## Why this over the abandoned per-graph heuristic approaches
- **Simplicity**: one style prop vs. a new pure module + wiring + unit
  tests, all of which twice produced real, non-obvious bugs under
  adversarial review.
- **Directness**: shrinks the actual colliding object instead of trying to
  predict, from raw layout coordinates, where a post-`fitView`,
  post-zoom/pan screen-space collision will land — the exact class of
  reasoning that failed twice.
- **Falsifiability**: the claim "no overlap" is checked by literally
  measuring `getBoundingClientRect()` overlap in a real browser across 6
  representative fixtures (including a 12-node stress case), not proven by
  hand-traced arithmetic that reviewers then had to disprove by hand twice.
- Still imperfect in principle (a sufficiently pathological/huge graph
  could theoretically still place a node under a 100×75 corner), but this
  is true of *any* fixed-corner overlay approach, including the
  pre-existing sibling `ArchitectureFlow.jsx` component's identical
  convention (out of scope to change) — this fix reduces the collision
  *area* by ~75% (100×75=7500px² vs ~202×152=30700px²) without attempting
  to eliminate the category, which was never proportionate for a
  cosmetic-only issue.

## Known, disclosed, unchanged limitation
Same as both prior rounds: the corner choice (still hardcoded
`'bottom-left'`) is fixed at whatever `fitView` computes on initial load;
user pan/zoom afterward isn't tracked or re-evaluated. Unchanged from
today's behavior, not worsened, not solved — disclosed, not silently
dropped.

## Scope
- `src/dashboard/frontend/src/ArchitectureTab.jsx` only (one prop added to
  the existing `<MiniMap>` element). No new files. No backend change. No
  change to `layoutGraph()`, `ArchitectureFlow.jsx` (sibling, pre-existing,
  out of scope), or any test file (there's no new logic to unit-test; the
  verification is the browser measurement below, already performed).

## Verification (already performed this round, ground truth)
Isolated `HOME` + temp project + 6 fixture `graphify-out/graph.json` files
(single-node, single-column, single-row, dense-grid, three-node,
tall-column/12-node), each checked via headless-Chromium CDP
`getBoundingClientRect()` overlap test between every `.react-flow__node`
and `.react-flow__minimap`: **0/6 fixtures show any overlap** with the
one-line fix, versus 2/6 (dense-grid, three-node) overlapping before it.
Visual screenshot of the 12-node case confirms a legible, non-overlapping
render. Remaining before calling this done: `npm run build:ui` (already
run repeatedly during tuning, succeeds), and a final full
`node --test test/dashboard.test.mjs test/frontend.test.mjs
test/cli-dashboard.test.mjs test/status.mjs` pass check (no logic changed
there, not expected to regress, but will be re-run before commit per this
repo's existing convention).

## Risk
Very low: single CSS-sizing prop on an existing, already-used component;
no logic, no new dependency, no data/API change. Worst case if some
untested graph shape still collides: same cosmetic-only ceiling as the
original bug, now with 75% less collision area — never a functional
regression.
