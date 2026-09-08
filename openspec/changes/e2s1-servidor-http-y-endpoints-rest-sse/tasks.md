## 1. Implementacion

- [ ] 1.1 reintenta `3101`, `3102`… hasta puerto libre, sirve `GET /` con la SPA y loguea `Dashboard en http://127.0.0.1:<port>`
- [ ] 1.2 responde `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` y envía ping `: keepalive` cada ~25 s
- [ ] 1.3 retorna `404 PROJECT_NOT_FOUND`
- [ ] 1.4 cada uno responde con el status y forma documentada en `architecture.md#4.5` (incluyendo `GET /api/projects/:id/diagram`, `PUT /epics`, `POST /changes`, `POST /commands`, `GET /commands/:execId/stream`)

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: reintenta `3101`, `3102`… hasta puerto libre, sirve `GET /` con la SPA y loguea `Dashboard en http://127.0.0.1:<port>`
- [ ] 2.2 Test del criterio 2: responde `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` y envía ping `: keepalive` cada ~25 s
- [ ] 2.3 Test del criterio 3: retorna `404 PROJECT_NOT_FOUND`
- [ ] 2.4 Test del criterio 4: cada uno responde con el status y forma documentada en `architecture.md#4.5` (incluyendo `GET /api/projects/:id/diagram`, `PUT /epics`, `POST /changes`, `POST /commands`, `GET /commands/:execId/stream`)
