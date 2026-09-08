## Why

Entrega la Story 6.2 del Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones.

## What Changes

- Ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`).
- Xterm.js renderiza los estilos con fidelidad completa sin romper texto plano ni códigos crudos.
- Los bytes se transmiten a través del endpoint `POST /api/projects/:id/commands/:execId/input` hacia el flujo `stdin` del subproceso `child_process`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`: agrega el requisito "Ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`)".

## Impact

- Origen: BMAD Story 6.2 — Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones
- Requisitos de esta story: FR-052, FR-060, FR-061
- Capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
