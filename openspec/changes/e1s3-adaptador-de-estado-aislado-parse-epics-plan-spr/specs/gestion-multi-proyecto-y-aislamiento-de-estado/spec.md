## ADDED Requirements

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
