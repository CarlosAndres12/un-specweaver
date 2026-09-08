## Why

Entrega la Story 4.1 del Epic 4: Frontend y CLI/Tests.

## What Changes

- Quick Switcher y tablero de control activo.
- Abre overlay Quick Switcher con búsqueda difusa por `name`/`path`, flechas + `Enter` selecciona, y conmuta contexto en <100 ms sin recarga (datos/diagramas/terminal cambian).
- El tablero muestra sprint activo, épicas por estado (Pendiente/En Progreso/Completada) y `doctor` del proyecto 2; `activeProjectId` persiste.
- Veo indicador pulso verde; si SSE se cae, pulso gris/rojo y reconecta automáticamente.
- 100% en español técnico (sin inglés en copy visible).

## Capabilities

### New Capabilities

### Modified Capabilities

- `frontend-y-cli-tests`: agrega el requisito "Quick Switcher y tablero de control activo".

## Impact

- Origen: BMAD Story 4.1 — Epic 4: Frontend y CLI/Tests
- Requisitos de esta story: FR-050, FR-051, FR-054, FR-055
- Capability: `frontend-y-cli-tests`
