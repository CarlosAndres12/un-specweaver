## ADDED Requirements

### Requirement: Gestión de proyecto activo y metadatos
The system SHALL support gestión de proyecto activo y metadatos.

#### Scenario: Conmuto a `proj-2` (vía API o UI)
- **GIVEN** hay 3 proyectos y `activeProjectId = proj-1`
- **WHEN** conmuto a `proj-2` (vía API o UI)
- **THEN** `projects.json` actualiza `activeProjectId = proj-2` y `lastActive` de `proj-2` a `now()` ISO-8601 con escritura atómica

#### Scenario: Hace `GET /api/projects`
- **GIVEN** reinicio el servidor
- **WHEN** hace `GET /api/projects`
- **THEN** `activeProjectId` persiste el último valor guardado
