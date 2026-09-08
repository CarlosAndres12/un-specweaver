## Why

Entrega la Story 6.1 del Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones.

## What Changes

- Terminal Drawer interactivo con Xterm.js y Botón Flotante (Zero-Scroll).
- El cajón de terminal se abre de forma inmediata y automática con animación suave, enfocando la consola Xterm.js sin requerir scroll manual al pie de página.
- El `FitAddon` recalcula las filas y columnas adaptando el lienzo de Xterm.js fluidamente.
- El botón flotante permanece visible con indicador de estado si hay un proceso ejecutándose en segundo plano.

## Capabilities

### New Capabilities

- `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`: **Objetivo:** Proporcionar una experiencia de terminal de grado profesional interactiva basada en Xterm.js para ejecutar el agente de codificación local Pi (`/usr/bin/pi`) y herramientas de SpecWeaver, eliminando la necesidad de hacer scroll al pie de página mediante auto-apertura y botón flotante persistente. **Incluye:** Integración de `@xterm/xterm` y `@xterm/addon-fit`, botón flotante (FAB) de acceso rápido, captura bidireccional de stdin, barra superior de gestión de sesiones (`pi -c`, `pi -r`) y apertura reactiva sin scroll. **Depende de:** Epic 4. **Bloquea a:** nada.

### Modified Capabilities

## Impact

- Origen: BMAD Story 6.1 — Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones
- Requisitos de esta story: FR-050, FR-052, FR-056
- Capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
