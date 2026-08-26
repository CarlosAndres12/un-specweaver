---
name: un-specweaver
description: "Spec-driven development flow joining BMAD (planning) with OpenSpec/SDD (execution). Use when starting a project, adopting an existing one, processing new requirements or tickets, planning sprints, and building."
---

# un-specweaver

Joins the planning half of **BMAD METHOD** with the execution half of **OpenSpec / SDD**.
The bridge between them is deterministic: do not improvise it, run it.

## Commands

| Command | When |
|---|---|
| `/sw:new` | project from scratch |
| `/sw:adopt` | project that already exists |
| `/sw:change "<req>"` | new requirement: changes what was agreed, **goes through scope control** |
| `/sw:bug "<defect>"` | defect: what was agreed is right, the implementation does not meet it |
| `/sw:ticket <n>` | GitHub issue: classifies and routes to one of the two above |
| `/sw:sprint` | assign work by real dependencies |
| `/sw:build <change-id>` | build a change |
| `/sw:sync` | update vendors in a controlled way |
| `/sw:doctor` | environment and flow diagnostics |

In OpenCode the same commands are `/sw-new`, `/sw-change`, and so on.
If the user describes one of these situations without invoking the command, suggest it.

## Defect and requirement are two flows, not one

The difference is not size or urgency:

- **Defect** — the spec says the right thing, the implementation does not meet it. Does not
  touch the PRD. **No scope control**: what was agreed does not change.
- **Requirement** — the spec does not cover the case. It changes what was agreed, so it **does**
  go through scope control before touching a file.

When in doubt, treat it as a requirement: going through scope control unnecessarily costs one
conversation; skipping it lets new behavior in with nobody approving it.

## Boundary rule

BMAD **ends at the story**. From there the contract is the OpenSpec spec, and building happens
against it. Gentle-AI's SDD phases are not used: they redo work BMAD already did earlier and in
more depth (epics, stories, criteria, FR coverage).

What **is** used from Gentle-AI are its ceremony-free skills: `judgment-day` (adversarial
review), `work-unit-commits`, `branch-pr`, `chained-pr`, and the `review-readability` /
`review-reliability` / `review-resilience` / `review-risk` subagents. Invoke them by asking
in plain language.
`bmad-agent-dev`, `bmad-build`, `bmad-build-auto` and `bmad-spec` are pruned from this
installation on purpose. If you cannot find them, that is not an error: do not look for BMAD
developer agents, and do not use `bmad-spec` in place of OpenSpec.

## Source of truth per kind of data

Before looking for something, know where it lives. Do not duplicate across layers.

| Data | Where it lives | Do not look in |
|---|---|---|
| Product intent (the business *what*) | `_bmad-output/` (PRD, epics) | the specs |
| Behavior contract (the technical *what*) | `openspec/specs/` | the PRD |
| Decisions and rationale (the *why*) | Engram **if present**, else `design.md` | the docs |
| Code structure (the *where*) | graphify graph **if present** | reading files blind |
| Traceability FR ↔ story ↔ change | `.un-specweaver/trace.json` | anywhere else |
| Organization architecture | `docs/architecture-base.md` | inventing it |

Load `docs/architecture-base.md` in any design or build phase: it overrides any default you
would otherwise assume.

## Rules that apply across the whole flow

1. **Specs are derived.** They are regenerated from `_bmad-output/epics.md` with
   `npx un-specweaver bridge`, not hand-edited. If a spec is wrong, epics.md is wrong.
2. **Scope is controlled before touching files**, not after. See `/sw:change`.
3. **One developer, one change at a time.** Stories are sized for exactly that.
4. **The spec's `#### Scenario:` blocks are the test cases.** Do not invent new criteria
   during the build.

## Project preferences win

`.un-specweaver/config.json` stores what the user chose at init time:

```json
"preferences": { "lang": "es", "engramScope": "project", "graphify": "auto" }
```

**Read them before deciding on your own.** If `graphify` is `"off"`, do not use it even if
installed. If `engramScope` is `"global"`, memory is shared with the user's other projects and
it is worth saying so before storing anything sensitive. Never ask about these in conversation:
they are already decided, and they change with `npx un-specweaver init --graphify off`.

## Optional capabilities

**graphify** is detected, not installed. If `graphify-out/graph.json` exists, query it instead of
reading files blind. If the skill is there but no graph exists, offer to build it. If it is absent,
carry on without it and **say so** — the serious failure is invoking it, nothing happening, and
carrying on as if you had the map. `npx un-specweaver doctor` reports whether it is available and where.
It may exist for Claude Code and not for OpenCode.

**Engram** is installed by Gentle-AI, but can be blocked by Homebrew trust. If `engram` is not
on PATH, write the rationale in the change's `design.md` under `## Decisions` and say so.
Never lose it silently.

**uv** (Python) is used by BMAD to resolve its configuration. If missing, the skills have a manual
fallback: slower, not an error.

## Known limit

The sprint plan assumes epics are independent. A cross-epic dependency not written in the story
text does not show up in the waves. Verify it by hand against `trace.json` before handing out
parallel work.
