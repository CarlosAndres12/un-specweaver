# servidor-reactivo-y-supresion-de-eco Specification

## Purpose
TBD - created by archiving change e2s1-servidor-http-y-endpoints-rest-sse. Update Purpose after archive.
## Requirements
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

### Requirement: Runner de comandos con cwd aislado y streaming SSE
The system SHALL support runner de comandos con cwd aislado y streaming SSE.

#### Scenario: Hago `POST /api/projects/proj-1/commands { command: "doctor" }`
- **GIVEN** un proyecto `proj-1` con `path /abs/repo-a`
- **WHEN** hago `POST /api/projects/proj-1/commands { command: "doctor" }`
- **THEN** retorna `202 { executionId }` inmediato y hace `spawn` con `{ cwd: "/abs/repo-a" }` (verificable vía `ps` o log)

#### Scenario: Hago `GET /api/projects/proj-1/commands/exec-123/stream` (SSE)
- **GIVEN** una ejecución activa `exec-123`
- **WHEN** hago `GET /api/projects/proj-1/commands/exec-123/stream` (SSE)
- **THEN** recibo chunks `event: COMMAND_OUTPUT` con `{ executionId, chunk, stream: "stdout"|"stderr" }` en orden y `event: COMMAND_CLOSE` con `exitCode` al terminar; múltiples suscriptores reciben lo mismo

#### Scenario: Ambos hacen streaming
- **GIVEN** dos proyectos A y B ejecutando `doctor` simultáneamente
- **WHEN** ambos hacen streaming
- **THEN** cada stream emite solo la salida de su propio `cwd`, sin cruzar

#### Scenario: Recibe `SIGTERM`
- **GIVEN** cierro el servidor con ejecuciones activas
- **WHEN** recibe `SIGTERM`
- **THEN** mata procesos hijos y cierra streams con `COMMAND_CLOSE`

### Requirement: Watcher filtrado con debounce 150 ms
The system SHALL support watcher filtrado con debounce 150 ms.

#### Scenario: Escribo en `/abs/repo-a/.git/index` o `/abs/repo-a/node_modules/foo/inde
- **GIVEN** un watcher activo para `proj-1`
- **WHEN** escribo en `/abs/repo-a/.git/index` o `/abs/repo-a/node_modules/foo/index.js` o `/abs/repo-a/dist/bundle.js`
- **THEN** 0 eventos `FS_CHANGE` emitidos

#### Scenario: El watcher observa
- **GIVEN** escribo en `/abs/repo-a/epics.md` y `/abs/repo-a/.spec/changes/foo/spec.md`
- **WHEN** el watcher observa
- **THEN** emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`

#### Scenario: Pasa debounce 150 ms
- **GIVEN** ráfaga de 10 writes a `epics.md` en 50 ms
- **WHEN** pasa debounce 150 ms
- **THEN** se emite exactamente 1 evento `FS_CHANGE` coalescado

#### Scenario: Escribo `epics.md` en A
- **GIVEN** dos proyectos A y B con watchers independientes
- **WHEN** escribo `epics.md` en A
- **THEN** solo A emite `FS_CHANGE` con `projectId: A`; B no emite

### Requirement: Supresión de eco 500 ms (Web→FS sin loop)
The system SHALL support supresión de eco 500 ms (Web→FS sin loop).

#### Scenario: El servidor escribe atómicamente y registra `recentWrites.set(absPath, {
- **GIVEN** hago `PUT /api/projects/proj-1/epics { content: "# nuevo" }` (origen Web)
- **WHEN** el servidor escribe atómicamente y registra `recentWrites.set(absPath, { hash, ts: now() })` y el watcher detecta el fs event dentro de 500 ms
- **THEN** el watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor)

#### Scenario: El watcher detecta el cambio
- **GIVEN** el mismo archivo `epics.md` es escrito por CLI/agente (sin `recentWrites`)
- **WHEN** el watcher detecta el cambio
- **THEN** emite `FS_CHANGE` normalmente sin supresión

#### Scenario: Hay un cambio posterior (CLI) sobre el mismo archivo
- **GIVEN** escribo desde Web y pasan >500 ms
- **WHEN** hay un cambio posterior (CLI) sobre el mismo archivo
- **THEN** sí emite `FS_CHANGE` (ventana expirada, hash distinto)

#### Scenario: Ambas escrituras son atómicas
- **GIVEN** `PUT /api/projects/:id/epics` concurrente
- **WHEN** ambas escrituras son atómicas
- **THEN** `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente

