## ADDED Requirements

### Requirement: Batería de tests automatizados
The system SHALL support batería de tests automatizados.

#### Scenario: Ejecuto `npm test` (`node --test "test/*.mjs"`)
- **GIVEN** `test/dashboard.test.mjs` existe
- **WHEN** ejecuto `npm test` (`node --test "test/*.mjs"`)
- **THEN** todos los tests pasan (incluyendo los existentes) y cubren: concurrencia: 5 `POST /api/projects` simultáneos sin corrupción SSE: `GET /api/events` emite `FS_CHANGE` tipado tras write en `epics.md` supresión eco: `PUT /epics` (Web) dentro de 500 ms → 0 eventos; write CLI → 1 evento filtrado: writes en `.git/`/`node_modules/` → 0 eventos debounce: ráfaga 10 writes → 1 evento cwd aislado: `POST /commands` hace `spawn { cwd: projectPath }` (spy o `pwd` check) `process.chdir` grep = 0

#### Scenario: Hay regresión en cualquiera de los invariantes
- **GIVEN** `npm test` en CI
- **WHEN** hay regresión en cualquiera de los invariantes
- **THEN** el test falla con mensaje tipado indicando AD violado
