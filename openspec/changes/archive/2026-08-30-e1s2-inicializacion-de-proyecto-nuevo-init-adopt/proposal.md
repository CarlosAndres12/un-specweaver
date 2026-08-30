## Why

Entrega la Story 1.2 del Epic 1: Gestión multi-proyecto y aislamiento de estado.

## What Changes

- Inicialización de proyecto nuevo (init/adopt).
- El servidor ejecuta `init` (o `adopt` si ya hay artefactos) con `{ cwd: projectPath }`, crea `.spec/` (o `specDir` correspondiente), registra el proyecto y retorna `201 { project }`.
- Retorna `400 INVALID_PATH` y no invoca `init`.
- El nuevo proyecto aparece con `specDir` correcto y `createdAt`/`lastActive` ISO-8601.

## Capabilities

### New Capabilities

### Modified Capabilities

- `gestion-multi-proyecto-y-aislamiento-de-estado`: agrega el requisito "Inicialización de proyecto nuevo (init/adopt)".

## Impact

- Origen: BMAD Story 1.2 — Epic 1: Gestión multi-proyecto y aislamiento de estado
- Requisitos de esta story: FR-002, FR-005
- Capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
