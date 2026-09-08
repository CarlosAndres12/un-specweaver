# Plan de sprint — Epics y Stories — Dashboard Web Multi-Proyecto

Derivado de 8 epic(s) y 28 story/ies.

Stories del mismo epic van en secuencia (comparten capability). Epics distintos van en paralelo.

## Ola 1 — 8 change(s) en paralelo

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
- **Story 5.1** — Formulario multi-paso interactivo en Frontend SPA
  - change: `openspec/changes/e5s1-formulario-multi-paso-interactivo-en-frontend-sp/`
  - capability: `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`
- **Story 6.1** — Terminal Drawer interactivo con Xterm.js y Botón Flotante (Zero-Scroll)
  - change: `openspec/changes/e6s1-terminal-drawer-interactivo-con-xterm-js-y-boton/`
  - capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
- **Story 7.1** — Comando CLI `un-specweaver update`
  - change: `openspec/changes/e7s1-comando-cli-un-specweaver-update/`
  - capability: `comando-y-flujo-de-actualizacion-un-specweaver-update`
- **Story 8.1** — Infraestructura Frontend Moderna (React + Vite) y Arquitectura de Componentes
  - change: `openspec/changes/e8s1-infraestructura-frontend-moderna-react-vite-y-ar/`
  - capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`

## Ola 2 — 8 change(s) en paralelo

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
- **Story 5.2** — Generador determinístico de Product Brief y PRD con requisitos numerados
  - change: `openspec/changes/e5s2-generador-deterministico-de-product-brief-y-prd/`
  - capability: `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`
  - depende de: 5.1 (secuencia dentro del epic (misma capability))
- **Story 6.2** — Ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`)
  - change: `openspec/changes/e6s2-ejecucion-e-interaccion-bidireccional-con-pi-age/`
  - capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
  - depende de: 6.1 (secuencia dentro del epic (misma capability))
- **Story 7.2** — Acción de actualización en Dashboard y Streaming
  - change: `openspec/changes/e7s2-accion-de-actualizacion-en-dashboard-y-streaming/`
  - capability: `comando-y-flujo-de-actualizacion-un-specweaver-update`
  - depende de: 7.1 (secuencia dentro del epic (misma capability))
- **Story 8.2** — Lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio
  - change: `openspec/changes/e8s2-lienzo-interactivo-con-react-flow-xyflow-react-y/`
  - capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
  - depende de: 8.1 (secuencia dentro del epic (misma capability))

## Ola 3 — 7 change(s) en paralelo

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
- **Story 5.3** — Endpoint `/api/projects/wizard` con inicialización y conmutación automática
  - change: `openspec/changes/e5s3-endpoint-api-projects-wizard-con-inicializacion/`
  - capability: `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`
  - depende de: 5.2 (secuencia dentro del epic (misma capability))
- **Story 6.3** — Barra de Herramientas y Selector de Sesiones Previas
  - change: `openspec/changes/e6s3-barra-de-herramientas-y-selector-de-sesiones-pre/`
  - capability: `consola-interactiva-xterm-js-para-pi-coding-agent-y-barra-de`
  - depende de: 6.2 (secuencia dentro del epic (misma capability))
- **Story 7.3** — Skill y flujo guiado `sw-update`
  - change: `openspec/changes/e7s3-skill-y-flujo-guiado-sw-update/`
  - capability: `comando-y-flujo-de-actualizacion-un-specweaver-update`
  - depende de: 7.2 (secuencia dentro del epic (misma capability))
- **Story 8.3** — Motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync)
  - change: `openspec/changes/e8s3-motor-de-mutacion-bidireccional-visual-codigo-vi/`
  - capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
  - depende de: 8.2 (secuencia dentro del epic (misma capability))

## Ola 4 — 4 change(s) en paralelo

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
- **Story 8.4** — Sincronización en Tiempo Real Código ↔ Visual mediante SSE
  - change: `openspec/changes/e8s4-sincronizacion-en-tiempo-real-codigo-visual-medi/`
  - capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
  - depende de: 8.3 (secuencia dentro del epic (misma capability))

## Ola 5 — 1 change(s) en paralelo

- **Story 8.5** — Panel Lateral Inspector y Consola Terminal Reactiva
  - change: `openspec/changes/e8s5-panel-lateral-inspector-y-consola-terminal-react/`
  - capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
  - depende de: 8.4 (secuencia dentro del epic (misma capability))

## Limite conocido

Una dependencia entre epics que no este escrita en el texto de la story NO se detecta aqui.
Este plan asume que los epics son independientes salvo que la story diga lo contrario.

