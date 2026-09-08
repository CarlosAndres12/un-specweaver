## Why

Entrega la Story 6.3 del Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones.

## What Changes

- Barra de Herramientas y Selector de Sesiones Previas.
- Presenta un selector de sesión activa/histórica y botones de acceso directo: `[+ Nueva Sesión (pi)]`, `[🔄 Continuar (pi -c)]`, `[📜 Reanudar (pi -r)]`.
- Se invoca `pi` con el argumento `-c` en el directorio de trabajo del proyecto activo y se asocia la sesión en el selector.
- El visor conmuta al buffer/historial correspondiente sin perder el estado del proceso en ejecución.

## Capabilities

### New Capabilities

### Modified Capabilities

- `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`: agrega el requisito "Barra de Herramientas y Selector de Sesiones Previas".

## Impact

- Origen: BMAD Story 6.3 — Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones
- Requisitos de esta story: FR-052, FR-053
- Capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
