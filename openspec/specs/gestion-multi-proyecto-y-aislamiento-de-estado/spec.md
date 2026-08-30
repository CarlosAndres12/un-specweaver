# gestion-multi-proyecto-y-aislamiento-de-estado Specification

## Purpose
TBD - created by archiving change e1s1-registro-y-listado-de-proyectos-con-persistencia. Update Purpose after archive.
## Requirements
### Requirement: Registro y listado de proyectos con persistencia atómica
The system SHALL support registro y listado de proyectos con persistencia atómica.

#### Scenario: Hago `POST /api/projects { path: "/abs/repo-a" }`
- **GIVEN** `~/.un-specweaver/projects.json` no existe o está vacío
- **WHEN** hago `POST /api/projects { path: "/abs/repo-a" }`
- **THEN** el servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto

#### Scenario: Hago `POST /api/projects { path: "/abs/repo-a" }` (o con trailing slash
- **GIVEN** un proyecto ya registrado con `path` canónico `/abs/repo-a`
- **WHEN** hago `POST /api/projects { path: "/abs/repo-a" }` (o con trailing slash / symlink equivalente)
- **THEN** retorna `409 DUPLICATE` con código tipado y no duplica entrada

#### Scenario: El servidor valida
- **GIVEN** hago `POST /api/projects { path: "relativo/repo" }` o ruta inexistente
- **WHEN** el servidor valida
- **THEN** retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack

#### Scenario: Hago `GET /api/projects`
- **GIVEN** hay 2 proyectos registrados con `.spec` en uno y `.openspec` en otro
- **WHEN** hago `GET /api/projects`
- **THEN** retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`)

#### Scenario: Todos persisten
- **GIVEN** concurrencia de 5 `POST /api/projects` simultáneos con paths distintos
- **WHEN** todos persisten
- **THEN** `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria)

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

### Requirement: Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor)
The system SHALL support adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor).

#### Scenario: Llamo `getEpics(projectPathA)` y `getEpics(projectPathB)` vía `state-ada
- **GIVEN** dos proyectos A y B con `epics.md` distintos
- **WHEN** llamo `getEpics(projectPathA)` y `getEpics(projectPathB)` vía `state-adapter`
- **THEN** cada uno retorna las épicas de su propio `projectPath` sin usar `process.chdir` (grep `process.chdir` en `src/dashboard/` = 0)

#### Scenario: Hago `GET /api/projects/:id/state`
- **GIVEN** un `projectId` válido
- **WHEN** hago `GET /api/projects/:id/state`
- **THEN** retorna `200 { epics, sprint, git, doctor }` agregado por adaptadores con `projectPath` explícito; si `bridge/parse-epics.mjs` o `plan-sprint.mjs` no encuentran artefactos, retornan estructura vacía sin `500`

#### Scenario: Hago `GET /api/projects/:id/state` (3)
- **GIVEN** un `projectId` inexistente
- **WHEN** hago `GET /api/projects/:id/state`
- **THEN** retorna `404 PROJECT_NOT_FOUND` con código tipado

#### Scenario: Inspecciono la invocación
- **GIVEN** el adaptador invoca `emit-openspec` o `plan-sprint`
- **WHEN** inspecciono la invocación
- **THEN** recibe `projectPath` como argumento explícito o `cwd` de subprocess, nunca cwd global

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

