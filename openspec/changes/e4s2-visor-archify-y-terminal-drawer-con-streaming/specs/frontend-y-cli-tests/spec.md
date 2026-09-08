## ADDED Requirements

### Requirement: Visor Archify y terminal drawer con streaming
The system SHALL support visor Archify y terminal drawer con streaming.

#### Scenario: Llega `FS_CHANGE` para ese proyecto
- **GIVEN** el visor Archify con diagrama del proyecto activo
- **WHEN** llega `FS_CHANGE` para ese proyecto
- **THEN** el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping)

#### Scenario: El drawer está cerrado
- **GIVEN** presiono `Ctrl+~` o `Cmd+J`
- **WHEN** el drawer está cerrado
- **THEN** se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos

#### Scenario: Clic en botón `doctor` (o `sync`/`sprint`/`build`)
- **GIVEN** el drawer abierto en `proj-1`
- **WHEN** clic en botón `doctor` (o `sync`/`sprint`/`build`)
- **THEN** hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver

#### Scenario: Vuelvo a `proj-1`
- **GIVEN** ejecuto `doctor` en `proj-1` y luego conmuto a `proj-2`
- **WHEN** vuelvo a `proj-1`
- **THEN** el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`
