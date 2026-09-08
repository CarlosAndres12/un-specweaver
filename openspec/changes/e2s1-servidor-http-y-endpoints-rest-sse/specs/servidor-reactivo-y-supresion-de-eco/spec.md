## ADDED Requirements

### Requirement: Servidor HTTP y endpoints REST/SSE
The system SHALL support servidor HTTP y endpoints REST/SSE.

#### Scenario: Hace boot
- **GIVEN** el servidor inicia con `port 3100` ocupado
- **WHEN** hace boot
- **THEN** reintenta `3101`, `3102`… hasta puerto libre, sirve `GET /` con la SPA y loguea `Dashboard en http://127.0.0.1:<port>`

#### Scenario: Hago `GET /api/events` (SSE)
- **GIVEN** el servidor en puerto libre
- **WHEN** hago `GET /api/events` (SSE)
- **THEN** responde `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` y envía ping `: keepalive` cada ~25 s

#### Scenario: Hago `GET /api/projects/:id/state` o `PUT /api/projects/:id/epics`
- **GIVEN** cualquier endpoint con `:id` inexistente
- **WHEN** hago `GET /api/projects/:id/state` o `PUT /api/projects/:id/epics`
- **THEN** retorna `404 PROJECT_NOT_FOUND`

#### Scenario: Los invoco según contrato
- **GIVEN** todos los endpoints listados en FR-020
- **WHEN** los invoco según contrato
- **THEN** cada uno responde con el status y forma documentada en `architecture.md#4.5` (incluyendo `GET /api/projects/:id/diagram`, `PUT /epics`, `POST /changes`, `POST /commands`, `GET /commands/:execId/stream`)
