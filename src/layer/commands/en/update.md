---
name: update
title: "UB: Update skills and environment"
description: "Update skills, commands, and agent configuration in an existing project without modifying architecture or specs."
allowed-tools: Bash(npx:*), Bash(git:*), Read, Glob
---

# /sw:update — update skills and environment

Synchronize the un-specweaver skills and commands layer in an already initialized repository.

## Step 1 — Check repository status

Before updating, verify that the working tree is clean:

```bash
git status
```

If there are uncommitted changes, commit or stash them first. The update rewrites generated skills and commands; having a clean restore point ensures you can revert if needed.

## Step 2 — Run update

To update the skills and commands layer using the configured agents:

```bash
npx un-specweaver update
```

To add support for a new agent (e.g., Antigravity):

```bash
npx un-specweaver update --agents antigravity
```

To also reconcile and update dependencies and vendors:

```bash
npx un-specweaver update --vendors
```

## Step 3 — Verify the environment

Run doctor to ensure everything is consistent:

```bash
npx un-specweaver doctor
```
