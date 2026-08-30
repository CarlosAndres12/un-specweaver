# Plan de sprint — Epics y Stories — Dashboard Web Multi-Proyecto

Derivado de 4 epic(s) y 14 story/ies.

Stories del mismo epic van en secuencia (comparten capability). Epics distintos van en paralelo.

## Ola 1 — 4 change(s) en paralelo

- **Story 1.1** — Registro y listado de proyectos con persistencia atómica
  - change: `openspec/changes/e1s1-registro-y-listado-de-proyectos-con-persistencia/`
  - capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
- **Story 2.1** — Servidor HTTP y endpoints REST/SSE
  - change: `openspec/changes/e2s1-servidor-http-y-endpoints-rest-sse/`
  - capability: `servidor-reactivo-y-supresion-de-eco`
- **Story 3.1** — Bridge Archify — mapper y render en memoria
  - change: `openspec/changes/e3s1-bridge-archify-mapper-y-render-en-memoria/`
  - capability: `compilador-archify-e-integracion-visual`
- **Story 4.1** — Quick Switcher y tablero de control activo
  - change: `openspec/changes/e4s1-quick-switcher-y-tablero-de-control-activo/`
  - capability: `frontend-y-cli-tests`

## Ola 2 — 4 change(s) en paralelo

- **Story 1.2** — Inicialización de proyecto nuevo (init/adopt)
  - change: `openspec/changes/e1s2-inicializacion-de-proyecto-nuevo-init-adopt/`
  - capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
  - depende de: 1.1 (secuencia dentro del epic (misma capability))
- **Story 2.2** — Runner de comandos con cwd aislado y streaming SSE
  - change: `openspec/changes/e2s2-runner-de-comandos-con-cwd-aislado-y-streaming-s/`
  - capability: `servidor-reactivo-y-supresion-de-eco`
  - depende de: 2.1 (secuencia dentro del epic (misma capability))
- **Story 3.2** — Endpoint de diagrama y visor reactivo sin parpadeos
  - change: `openspec/changes/e3s2-endpoint-de-diagrama-y-visor-reactivo-sin-parpad/`
  - capability: `compilador-archify-e-integracion-visual`
  - depende de: 3.1 (secuencia dentro del epic (misma capability))
- **Story 4.2** — Visor Archify y terminal drawer con streaming
  - change: `openspec/changes/e4s2-visor-archify-y-terminal-drawer-con-streaming/`
  - capability: `frontend-y-cli-tests`
  - depende de: 4.1 (secuencia dentro del epic (misma capability))

## Ola 3 — 3 change(s) en paralelo

- **Story 1.3** — Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor)
  - change: `openspec/changes/e1s3-adaptador-de-estado-aislado-parse-epics-plan-spr/`
  - capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
  - depende de: 1.2 (secuencia dentro del epic (misma capability))
- **Story 2.3** — Watcher filtrado con debounce 150 ms
  - change: `openspec/changes/e2s3-watcher-filtrado-con-debounce-150-ms/`
  - capability: `servidor-reactivo-y-supresion-de-eco`
  - depende de: 2.2 (secuencia dentro del epic (misma capability))
- **Story 4.3** — Comando CLI `dashboard` (alias `ui`) con `--open`
  - change: `openspec/changes/e4s3-comando-cli-dashboard-alias-ui-con-open/`
  - capability: `frontend-y-cli-tests`
  - depende de: 4.2 (secuencia dentro del epic (misma capability))

## Ola 4 — 3 change(s) en paralelo

- **Story 1.4** — Gestión de proyecto activo y metadatos
  - change: `openspec/changes/e1s4-gestion-de-proyecto-activo-y-metadatos/`
  - capability: `gestion-multi-proyecto-y-aislamiento-de-estado`
  - depende de: 1.3 (secuencia dentro del epic (misma capability))
- **Story 2.4** — Supresión de eco 500 ms (Web→FS sin loop)
  - change: `openspec/changes/e2s4-supresion-de-eco-500-ms-web-fs-sin-loop/`
  - capability: `servidor-reactivo-y-supresion-de-eco`
  - depende de: 2.3 (secuencia dentro del epic (misma capability))
- **Story 4.4** — Batería de tests automatizados
  - change: `openspec/changes/e4s4-bateria-de-tests-automatizados/`
  - capability: `frontend-y-cli-tests`
  - depende de: 4.3 (secuencia dentro del epic (misma capability))

## Limite conocido

Una dependencia entre epics que no este escrita en el texto de la story NO se detecta aqui.
Este plan asume que los epics son independientes salvo que la story diga lo contrario.

