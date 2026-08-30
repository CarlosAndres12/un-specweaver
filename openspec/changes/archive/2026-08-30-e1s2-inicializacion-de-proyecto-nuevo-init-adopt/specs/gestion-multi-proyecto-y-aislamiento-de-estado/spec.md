## ADDED Requirements

### Requirement: Inicialización de proyecto nuevo (init/adopt)
The system SHALL support inicialización de proyecto nuevo (init/adopt).

#### Scenario: Hago `POST /api/projects/init { path: "/abs/nuevo" }`
- **GIVEN** una ruta absoluta existente vacía `/abs/nuevo`
- **WHEN** hago `POST /api/projects/init { path: "/abs/nuevo" }`
- **THEN** el servidor ejecuta `init` (o `adopt` si ya hay artefactos) con `{ cwd: projectPath }`, crea `.spec/` (o `specDir` correspondiente), registra el proyecto y retorna `201 { project }`

#### Scenario: Se valida
- **GIVEN** `POST /api/projects/init` con `path` no absoluto o inexistente
- **WHEN** se valida
- **THEN** retorna `400 INVALID_PATH` y no invoca `init`

#### Scenario: Consulto `GET /api/projects`
- **GIVEN** inicialización exitosa
- **WHEN** consulto `GET /api/projects`
- **THEN** el nuevo proyecto aparece con `specDir` correcto y `createdAt`/`lastActive` ISO-8601
