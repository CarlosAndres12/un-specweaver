---
name: adopt
title: "UB: Adopt existing project"
description: "Bring an existing project into this flow: map the real code, derive its architecture, raise a brownfield PRD and set a spec baseline."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Write, Edit, Glob, Grep
---

# /sw:adopt — existing project

The classic mistake is planning against what you **think** the code does. Map it first.

## Phase 1 — Map what actually exists

The classic mistake in this phase is planning against what you think the code does.

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

## Phase 2 — Real architecture vs declared architecture

1. Derive the **real** architecture from the graph: layers, boundaries, dependencies, where the
   domain lives.
2. Contrast it against `docs/architecture-base.md`.
3. **Write the differences down explicitly.** Do not silence them or mentally "fix" them.

Each difference is one of three things, and you must decide which before moving on:
- known technical debt → document it and leave it
- the baseline is stale → update `docs/architecture-base.md`
- a real violation → turn it into a remediation epic

## Phase 3 — Brownfield PRD

`bmad-document-project` to capture what the system does today, then `bmad-prd` on top of that.

Rule: the brownfield PRD describes **what exists**, not what you wish existed. New behavior
comes later through `/sw:change`.

## Phase 4 — Spec baseline

For each capability that already works, write its spec in `openspec/specs/<capability>/spec.md`
with `## Purpose` and its `### Requirement:` entries in present tense. This baseline is what
`/sw:change` measures scope against; without it, scope control has nothing to compare to.

Verify: `npx @fission-ai/openspec validate --all --strict`

## Phase 5 — From here on

The project is in the flow. New behavior enters through `/sw:change`, tickets through
`/sw:ticket`, and new epics via `bmad-create-epics-and-stories` + `npx un-specweaver bridge`.
