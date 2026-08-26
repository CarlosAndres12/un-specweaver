---
name: build
title: "UB: Build a change"
description: "Hand an OpenSpec change to the SDD flow for implementation, after verifying its dependencies are satisfied."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Write, Edit, Glob, Grep, Bash
---

# /sw:build — build a change

The change-id comes in `$ARGUMENTS`. If empty, show the current wave from
`.un-specweaver/sprint-plan.md` and ask which.

**This is the only phase that writes product code.** BMAD's building skills are pruned from this
project on purpose: if you look for `bmad-build` or `bmad-agent-dev` and they are missing, that
is not an error.

## Step 0 — Verify the build environment is complete

`npx un-specweaver doctor`. Here the Gentle-AI steps (`gentle-bin`, `gentle-config`) **do**
block: they are the SDD that does the building. If they read missing, fix them with
`npx un-specweaver init` before continuing.

## Step 1 — Verify you can start

Before writing anything:

1. Find the change in `.un-specweaver/sprint-plan.md`. If it declares `depende de` / depends on,
   verify **each** dependency is archived (`openspec/changes/archive/`) or has a complete `tasks.md`.
2. If a dependency is not ready, **stop and say so**. Building on a spec that can still change is
   work that will be thrown away.
3. Read the whole change: `proposal.md`, `specs/**/spec.md`, `tasks.md`.

## Step 2 — Load the right context

```
npx un-specweaver context
```

Lists the artifacts BMAD already produced, at their real paths (they are dated and configurable,
do not guess them). **Load them before designing**:

- **`architecture/ARCHITECTURE-SPINE.md`** — technical decisions already made and reviewed.
  **Binding.** SDD design does not relitigate them: it implements them.
- **`ux-designs/DESIGN.md` and `EXPERIENCE.md`** — design and experience. **Binding** for
  everything visual and interactive. The UX-DRs this story covers come from here.
- **`epics.md`** — the story this change came from, with its full criteria.
- **`prds/prd.md`** — only if you need the why behind a requirement.

And also:

- **`docs/architecture-base.md`** — organization constraints; it overrides any default you would
  assume, and overrides ARCHITECTURE-SPINE if they contradict (say so if that happens).
- the code map, **if available** (see below)
- Engram for related prior decisions, **if available** (see below)

Skipping the planning artifacts is this flow's most expensive waste: it means redesigning from
scratch what was already decided, reviewed and approved.

## Code map (graphify)

graphify is **optional**. Resolve in this order and **say which branch you took**:

0. **Read `.un-specweaver/config.json`.** If `preferences.graphify` is `"off"`, the user chose not
   to use it: jump to branch 3 even if installed. The preference overrides detection.

1. **`graphify-out/graph.json` exists** → query it with `/graphify query "<question>"`.
   Do not read files blind when a graph exists.
2. **The graphify skill exists but there is no graph** → offer to build it with `/graphify .`
   before continuing. On large repos this takes a while, so ask instead of assuming.
3. **Neither exists** → fall back to normal exploration (Glob/Grep/Read) and **explicitly warn
   that the map will be less reliable**.

The only serious failure here is the silent one: invoking `/graphify`, nothing happening, and
carrying on as if you had the map. `npx un-specweaver doctor` reports whether it is available and where.

Note: the skill usually lives in `~/.claude/skills/`, so it may exist for Claude Code and not for
OpenCode. Check in the agent you are actually running in; do not assume.

## Step 3 — Build against the spec

**This is the only phase that writes product code.** You build it here, against the contract
that already exists. There are no intermediate phases to orchestrate.

The spec **is** the specification. Every `#### Scenario:` in `specs/**/spec.md` is a test case
that must have a test exercising it. `tasks.md` is the checklist.

1. Implement each task in `tasks.md`, respecting the Step 2 constraints.
2. Write the test for each scenario. A scenario with no test is an unverified requirement.
3. **Do not invent new criteria.** If something is missing, it is missing from the spec, and
   that gets fixed through `/sw:change`, not here.
4. If the change needs deep technical decisions — a new pattern, an external dependency, a
   migration, something cross-cutting — write `design.md` in the change folder before coding.
   **Only if it applies**: OpenSpec asks for it conditionally, not by default.

### Gentle-AI skills that help here

Invoke them by asking in plain language, no ceremony:

- **`work-unit-commits`** — group changes into reviewable commits instead of one blob
- **`judgment-day`** — adversarial review with two judges that contradict each other
- the **`review-readability`**, **`review-reliability`**, **`review-resilience`**,
  **`review-risk`** subagents — each looks through a different lens
- **`branch-pr`** / **`chained-pr`** — PRs with issue-first checks; splits anything over 400 lines

Offer them at close; do not impose them.

## Step 4 — Close out

1. Tick the `tasks.md` boxes that are genuinely done
2. `npx @fission-ai/openspec validate --all --strict`
3. Record the implementation decisions that are not obvious from the code (see "Memory" below)
4. `openspec archive <change-id>` once delivered — that folds the delta into the main spec

## Decision memory (Engram)

Engram is **optional**. `npx un-specweaver doctor` says whether it is available, and
`.un-specweaver/config.json` says at what scope: `preferences.engramScope` set to `"project"`
means this project cannot see other projects' memory; set to `"global"`, it shares it.
If you are about to store something sensitive from a client and the scope is global, **say so first**.

- **If `engram` is on PATH** → store the decision and its reason there.
- **If it is not** → write it anyway, in the change's `design.md` under `## Decisions`, and
  **tell the user** it went there because Engram is not installed.

What is not acceptable is invoking Engram, nothing happening, and losing the rationale silently.
A "why" that ends up written nowhere is lost just as if it had never been thought.

## Boundary

One change at a time. If something outside the change's scope surfaces while building,
**do not fold it in**: note it and route it through `/sw:change`. A change that grows
mid-build is a change that no longer matches its spec.
