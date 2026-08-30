## Why

Entrega la Story 1.3 del Epic 1: Gestión multi-proyecto y aislamiento de estado.

## What Changes

- Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor).
- Cada uno retorna las épicas de su propio `projectPath` sin usar `process.chdir` (grep `process.chdir` en `src/dashboard/` = 0).
- Retorna `200 { epics, sprint, git, doctor }` agregado por adaptadores con `projectPath` explícito; si `bridge/parse-epics.mjs` o `plan-sprint.mjs` no encuentran artefactos, retornan estructura vacía sin `500`.
- Retorna `404 PROJECT_NOT_FOUND` con código tipado.
- Recibe `projectPath` como argumento explícito o `cwd` de subprocess, nunca cwd global.

## Capabilities

### New Capabilities

### Modified Capabilities

- `gestion-multi-proyecto-y-aislamiento-de-estado`: agrega el requisito "Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor)".

## Impact

- Origen: BMAD Story 1.3 — Epic 1: Gestión multi-proyecto y aislamiento de estado
- Requisitos de esta story: FR-010, FR-011, FR-012, FR-013, FR-014, FR-015
- Capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
