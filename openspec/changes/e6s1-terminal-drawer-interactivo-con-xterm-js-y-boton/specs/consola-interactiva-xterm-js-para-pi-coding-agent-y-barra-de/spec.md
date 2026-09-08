## Purpose

**Objetivo:** Proporcionar una experiencia de terminal de grado profesional interactiva basada en Xterm.js para ejecutar el agente de codificación local Pi (`/usr/bin/pi`) y herramientas de SpecWeaver, eliminando la necesidad de hacer scroll al pie de página mediante auto-apertura y botón flotante persistente. **Incluye:** Integración de `@xterm/xterm` y `@xterm/addon-fit`, botón flotante (FAB) de acceso rápido, captura bidireccional de stdin, barra superior de gestión de sesiones (`pi -c`, `pi -r`) y apertura reactiva sin scroll. **Depende de:** Epic 4. **Bloquea a:** nada.

## ADDED Requirements

### Requirement: Terminal Drawer interactivo con Xterm.js y Botón Flotante (Zero-Scroll)
The system SHALL support terminal Drawer interactivo con Xterm.js y Botón Flotante (Zero-Scroll).

#### Scenario: Hace clic en cualquier botón de acción (`doctor`, `build`, `pi`, etc.) o
- **GIVEN** el usuario se encuentra en cualquier sección o posición de scroll del panel
- **WHEN** hace clic en cualquier botón de acción (`doctor`, `build`, `pi`, etc.) o en el botón flotante `[💻 Terminal]`
- **THEN** el cajón de terminal se abre de forma inmediata y automática con animación suave, enfocando la consola Xterm.js sin requerir scroll manual al pie de página

#### Scenario: Se redimensiona la ventana o el drawer
- **GIVEN** el terminal se encuentra abierto
- **WHEN** se redimensiona la ventana o el drawer
- **THEN** el `FitAddon` recalcula las filas y columnas adaptando el lienzo de Xterm.js fluidamente

#### Scenario: El terminal se cierra
- **GIVEN** el usuario presiona `Esc` o hace clic en el botón cerrar
- **WHEN** el terminal se cierra
- **THEN** el botón flotante permanece visible con indicador de estado si hay un proceso ejecutándose en segundo plano
