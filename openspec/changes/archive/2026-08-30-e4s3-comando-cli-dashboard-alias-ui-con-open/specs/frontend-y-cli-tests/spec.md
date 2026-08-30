## ADDED Requirements

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
