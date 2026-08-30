## Why

Entrega la Story 1.4 del Epic 1: Gestión multi-proyecto y aislamiento de estado.

## What Changes

- Gestión de proyecto activo y metadatos.
- `projects.json` actualiza `activeProjectId = proj-2` y `lastActive` de `proj-2` a `now()` ISO-8601 con escritura atómica.
- `activeProjectId` persiste el último valor guardado.

## Capabilities

### New Capabilities

### Modified Capabilities

- `gestion-multi-proyecto-y-aislamiento-de-estado`: agrega el requisito "Gestión de proyecto activo y metadatos".

## Impact

- Origen: BMAD Story 1.4 — Epic 1: Gestión multi-proyecto y aislamiento de estado
- Requisitos de esta story: FR-007, FR-004
- Capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
