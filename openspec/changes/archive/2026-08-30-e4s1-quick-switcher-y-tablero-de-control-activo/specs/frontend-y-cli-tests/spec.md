## Purpose

**Objetivo:** SPA Vanilla ESM (Quick Switcher, tablero, terminal drawer) + comando CLI `dashboard`/`ui` + batería de tests. Cubre pasos 6–8 del plan. **Incluye:** `src/dashboard/public/`, `bin/un-specweaver.mjs`, `src/layer/commands/es/dashboard.md`, `test/dashboard.test.mjs`. **Depende de:** Epic 1, 2, 3.

## ADDED Requirements

### Requirement: Quick Switcher y tablero de control activo
The system SHALL support quick Switcher y tablero de control activo.

#### Scenario: Presiono `Cmd+P` (macOS) o `Ctrl+P` (resto)
- **GIVEN** la SPA cargada con 3 proyectos
- **WHEN** presiono `Cmd+P` (macOS) o `Ctrl+P` (resto)
- **THEN** abre overlay Quick Switcher con búsqueda difusa por `name`/`path`, flechas + `Enter` selecciona, y conmuta contexto en <100 ms sin recarga (datos/diagramas/terminal cambian)

#### Scenario: La SPA hace `GET /api/projects/proj-2/state` y `GET /api/projects/proj-2
- **GIVEN** conmuto de `proj-1` a `proj-2`
- **WHEN** la SPA hace `GET /api/projects/proj-2/state` y `GET /api/projects/proj-2/diagram`
- **THEN** el tablero muestra sprint activo, épicas por estado (Pendiente/En Progreso/Completada) y `doctor` del proyecto 2; `activeProjectId` persiste

#### Scenario: Miro el tablero
- **GIVEN** SSE conectado y sincronizado
- **WHEN** miro el tablero
- **THEN** veo indicador pulso verde; si SSE se cae, pulso gris/rojo y reconecta automáticamente

#### Scenario: Inspecciono labels y mensajes
- **GIVEN** toda la UI
- **WHEN** inspecciono labels y mensajes
- **THEN** 100% en español técnico (sin inglés en copy visible)
