---
name: change
title: "UB: New requirement"
description: "Process a requirement that arrives mid-development: control scope first, then update the source document and regenerate only what is affected."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Write, Edit, Glob, Grep
---

# /sw:change — new requirement mid-development

This is the case that breaks most often when done by feel. **The order is not negotiable.**

The requirement comes in `$ARGUMENTS`. If empty, ask for it before doing anything.

## Step 1 — Scope control (before touching a single file)

Read `.un-specweaver/trace.json` and `_bmad-output/prd.md`. Classify the requirement as exactly **one** of:

| Classification | How to recognize it | What follows |
|---|---|---|
| **In scope** | refines an existing FR; adds no new behavior | Step 2 |
| **Scope creep** | new behavior the PRD does not cover, but it fits an existing epic | **Stop and say so.** Wait for a decision. |
| **New epic** | a whole new capability | **Stop.** This goes back to planning, it is not a patch. |

State the classification out loud, citing the specific FR or story that backs it. If torn between
two, pick the more restrictive one and explain why.

**Do not move to Step 2 without user confirmation for anything other than "in scope".**

## Step 2 — Update the source document, not the derived one

If behavior changes, change the PRD/epics with `bmad-correct-course`.

Editing the spec without updating the PRD leaves both lying: the spec says one thing, the PRD
another, and in three weeks nobody knows which wins. The spec is **derived** from epics.md — it
gets regenerated, not hand-edited.

## Step 3 — Regenerate only what is affected

```
npx un-specweaver bridge --only <N.M> --force
```

One `--only` per touched story. **Do not regenerate everything**: you would overwrite in-flight
changes other developers are already working on.

Before running it, check `.un-specweaver/sprint-plan.md`: if the affected story has dependents in
later waves, name which ones are impacted.

## Step 4 — Re-verify

```
npx @fission-ai/openspec validate --all --strict
```

## Step 5 — Record the why

Engram is **optional**. `npx un-specweaver doctor` says whether it is available, and
`.un-specweaver/config.json` says at what scope: `preferences.engramScope` set to `"project"`
means this project cannot see other projects' memory; set to `"global"`, it shares it.
If you are about to store something sensitive from a client and the scope is global, **say so first**.

- **If `engram` is on PATH** → store the decision and its reason there.
- **If it is not** → write it anyway, in the change's `design.md` under `## Decisions`, and
  **tell the user** it went there because Engram is not installed.

What is not acceptable is invoking Engram, nothing happening, and losing the rationale silently.
A "why" that ends up written nowhere is lost just as if it had never been thought.

Store the **decision and its reason**, not the what (that is already in the spec).
What always gets lost is why a scope change was accepted or rejected.

If the change was rejected as scope creep, record it anyway: next time someone proposes it, that
decision saves the entire discussion.
