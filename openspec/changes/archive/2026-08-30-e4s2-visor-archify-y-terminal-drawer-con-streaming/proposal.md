## Why

Entrega la Story 4.2 del Epic 4: Frontend y CLI/Tests.

## What Changes

- Visor Archify y terminal drawer con streaming.
- El visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping).
- Se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos.
- Hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver.
- El drawer de `proj-1` conserva su historial sin cruzar con `proj-2`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `frontend-y-cli-tests`: agrega el requisito "Visor Archify y terminal drawer con streaming".

## Impact

- Origen: BMAD Story 4.2 — Epic 4: Frontend y CLI/Tests
- Requisitos de esta story: FR-052, FR-053, FR-056
- Capability: `frontend-y-cli-tests`
