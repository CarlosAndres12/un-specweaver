## Why

Entrega la Story 4.3 del Epic 4: Frontend y CLI/Tests.

## What Changes

- Comando CLI `dashboard` (alias `ui`) con `--open`.
- Inicia el servidor en puerto libre (default 3100), sirve la SPA en `/` y loguea `Dashboard en http://127.0.0.1:<port>`.
- Abre el navegador del sistema a la URL efectiva (`open`/`xdg-open`/`start` según OS) sin bloquear el proceso.
- Documenta uso, flags (`--open`, `--port`, `--host`), ejemplos y que es ESM estricto, en español.

## Capabilities

### New Capabilities

### Modified Capabilities

- `frontend-y-cli-tests`: agrega el requisito "Comando CLI `dashboard` (alias `ui`) con `--open`".

## Impact

- Origen: BMAD Story 4.3 — Epic 4: Frontend y CLI/Tests
- Requisitos de esta story: FR-060, FR-061, FR-063, NFR-005
- Capability: `frontend-y-cli-tests`
