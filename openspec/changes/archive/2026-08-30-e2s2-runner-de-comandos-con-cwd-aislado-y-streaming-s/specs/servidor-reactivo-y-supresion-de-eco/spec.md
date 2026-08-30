## ADDED Requirements

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
