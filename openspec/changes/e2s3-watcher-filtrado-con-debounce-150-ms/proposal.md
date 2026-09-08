## Why

Entrega la Story 2.3 del Epic 2: Servidor reactivo y supresión de eco.

## What Changes

- Watcher filtrado con debounce 150 ms.
- 0 eventos `FS_CHANGE` emitidos.
- Emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`.
- Se emite exactamente 1 evento `FS_CHANGE` coalescado.
- Solo A emite `FS_CHANGE` con `projectId: A`; B no emite.

## Capabilities

### New Capabilities

### Modified Capabilities

- `servidor-reactivo-y-supresion-de-eco`: agrega el requisito "Watcher filtrado con debounce 150 ms".

## Impact

- Origen: BMAD Story 2.3 — Epic 2: Servidor reactivo y supresión de eco
- Requisitos de esta story: FR-030, FR-031, FR-032, FR-034, FR-035
- Capability: `servidor-reactivo-y-supresion-de-eco`
