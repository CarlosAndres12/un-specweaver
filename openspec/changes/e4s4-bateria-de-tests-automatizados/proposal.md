## Why

Entrega la Story 4.4 del Epic 4: Frontend y CLI/Tests.

## What Changes

- Batería de tests automatizados.
- Todos los tests pasan (incluyendo los existentes) y cubren: concurrencia: 5 `POST /api/projects` simultáneos sin corrupción SSE: `GET /api/events` emite `FS_CHANGE` tipado tras write en `epics.md` supresión eco: `PUT /epics` (Web) dentro de 500 ms → 0 eventos; write CLI → 1 evento filtrado: writes en `.git/`/`node_modules/` → 0 eventos debounce: ráfaga 10 writes → 1 evento cwd aislado: `POST /commands` hace `spawn { cwd: projectPath }` (spy o `pwd` check) `process.chdir` grep = 0.
- El test falla con mensaje tipado indicando AD violado.

## Capabilities

### New Capabilities

### Modified Capabilities

- `frontend-y-cli-tests`: agrega el requisito "Batería de tests automatizados".

## Impact

- Origen: BMAD Story 4.4 — Epic 4: Frontend y CLI/Tests
- Requisitos de esta story: FR-062, FR-064, NFR-015
- Capability: `frontend-y-cli-tests`
