## Why

Entrega la Story 2.2 del Epic 2: Servidor reactivo y supresión de eco.

## What Changes

- Runner de comandos con cwd aislado y streaming SSE.
- Retorna `202 { executionId }` inmediato y hace `spawn` con `{ cwd: "/abs/repo-a" }` (verificable vía `ps` o log).
- Recibo chunks `event: COMMAND_OUTPUT` con `{ executionId, chunk, stream: "stdout"|"stderr" }` en orden y `event: COMMAND_CLOSE` con `exitCode` al terminar; múltiples suscriptores reciben lo mismo.
- Cada stream emite solo la salida de su propio `cwd`, sin cruzar.
- Mata procesos hijos y cierra streams con `COMMAND_CLOSE`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `servidor-reactivo-y-supresion-de-eco`: agrega el requisito "Runner de comandos con cwd aislado y streaming SSE".

## Impact

- Origen: BMAD Story 2.2 — Epic 2: Servidor reactivo y supresión de eco
- Requisitos de esta story: FR-023, FR-024
- Capability: `servidor-reactivo-y-supresion-de-eco`
