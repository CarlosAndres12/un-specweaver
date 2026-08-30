# frontend-y-cli-tests Specification

## Purpose
TBD - created by archiving change e4s1-quick-switcher-y-tablero-de-control-activo. Update Purpose after archive.
## Requirements
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

### Requirement: Comando CLI `dashboard` (alias `ui`) con `--open`
The system SHALL support comando CLI `dashboard` (alias `ui`) con `--open`.

#### Scenario: Ejecuto `npx un-specweaver dashboard` o `npx un-specweaver ui`
- **GIVEN** Node >=20.11 y `bin/un-specweaver.mjs`
- **WHEN** ejecuto `npx un-specweaver dashboard` o `npx un-specweaver ui`
- **THEN** inicia el servidor en puerto libre (default 3100), sirve la SPA en `/` y loguea `Dashboard en http://127.0.0.1:<port>`

#### Scenario: El servidor inicia en 3200 (o siguiente libre)
- **GIVEN** ejecuto `npx un-specweaver dashboard --open --port 3200`
- **WHEN** el servidor inicia en 3200 (o siguiente libre)
- **THEN** abre el navegador del sistema a la URL efectiva (`open`/`xdg-open`/`start` según OS) sin bloquear el proceso

#### Scenario: Lo leo
- **GIVEN** `src/layer/commands/es/dashboard.md`
- **WHEN** lo leo
- **THEN** documenta uso, flags (`--open`, `--port`, `--host`), ejemplos y que es ESM estricto, en español

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

