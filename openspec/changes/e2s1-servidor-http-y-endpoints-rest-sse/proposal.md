## Why

Entrega la Story 2.1 del Epic 2: Servidor reactivo y supresión de eco.

## What Changes

- Servidor HTTP y endpoints REST/SSE.
- Reintenta `3101`, `3102`… hasta puerto libre, sirve `GET /` con la SPA y loguea `Dashboard en http://127.0.0.1:<port>`.
- Responde `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` y envía ping `: keepalive` cada ~25 s.
- Retorna `404 PROJECT_NOT_FOUND`.
- Cada uno responde con el status y forma documentada en `architecture.md#4.5` (incluyendo `GET /api/projects/:id/diagram`, `PUT /epics`, `POST /changes`, `POST /commands`, `GET /commands/:execId/stream`).

## Capabilities

### New Capabilities

### Modified Capabilities

- `servidor-reactivo-y-supresion-de-eco`: agrega el requisito "Servidor HTTP y endpoints REST/SSE".

## Impact

- Origen: BMAD Story 2.1 — Epic 2: Servidor reactivo y supresión de eco
- Requisitos de esta story: FR-020, FR-021, FR-022, FR-015
- Capability: `servidor-reactivo-y-supresion-de-eco`
