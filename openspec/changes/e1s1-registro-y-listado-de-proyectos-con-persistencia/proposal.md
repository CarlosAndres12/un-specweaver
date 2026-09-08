## Why

Entrega la Story 1.1 del Epic 1: Gestión multi-proyecto y aislamiento de estado.

## What Changes

- Registro y listado de proyectos con persistencia atómica.
- El servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto.
- Retorna `409 DUPLICATE` con código tipado y no duplica entrada.
- Retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack.
- Retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`).
- `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria).

## Capabilities

### New Capabilities

### Modified Capabilities

- `gestion-multi-proyecto-y-aislamiento-de-estado`: agrega el requisito "Registro y listado de proyectos con persistencia atómica".

## Impact

- Origen: BMAD Story 1.1 — Epic 1: Gestión multi-proyecto y aislamiento de estado
- Requisitos de esta story: FR-001, FR-003, FR-004, FR-005, FR-006
- Capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
