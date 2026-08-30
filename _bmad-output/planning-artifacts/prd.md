---
title: "Dashboard Web Multi-Proyecto de un-specweaver — PRD"
status: draft
created: 2026-08-30
updated: 2026-08-30
project: un-specweaver
version: 0.1.0
document_output_language: Spanish
---

# PRD — Dashboard Web Multi-Proyecto de un-specweaver

> **Nota normativa:** este documento usa el verbo **DEBE** como equivalente en español de *shall* para requisitos normativos. La validación automática (`bridge --normative shall`) puede requerir la palabra clave inglesa `shall`; en ese caso, la traza normativa es `DEBE = shall`.

## 1. Resumen ejecutivo

un-specweaver carece de una superficie visual local para operar sobre múltiples repositorios con el método BMAD + OpenSpec. El **Dashboard Web Multi-Proyecto** será el centro de control local, reactivo y multi-proyecto donde desarrollador y agentes CLI (OpenCode, Pi, Cursor) colaboran simultáneamente sobre N repositorios locales, con **sincronización bidireccional en tiempo real** entre filesystem y UI, **diagramación viva vía Archify** y **terminal integrada con streaming**.

El sistema DEBE cumplir tres invariantes no negociables: (1) **aislamiento por proyecto** — jamás `process.chdir()` global, cada operación recibe `projectPath` explícito o `subprocess { cwd }`; (2) **observación reactiva con supresión de eco** — cambios CLI→Web por SSE, escrituras Web→disco atómicas sin loops; (3) **DX local en español** con baja latencia, atajos de teclado y ESM estricto Node >=20.11.

## 2. Contexto y problema

### 2.1 Contexto técnico existente

- **un-specweaver** (`src/`, `bridge/`, `bin/`): comandos `adopt`, `bug`, `build`, `change`, `doctor`, `new`, `sprint`, `sync`, `ticket`. Bridge: `bridge/cli.mjs`, `bridge/emit-openspec.mjs`, `bridge/parse-epics.mjs`, `bridge/plan-sprint.mjs`. Runtime Node.js **ESM estricto**, `type: module`, Node >=20.11 (engines).
- **Capas y skills**: `src/layer/commands/es/*.md`, `src/layer/skills/`, `src/steps.mjs`, `src/prefs.mjs`, `src/init.mjs`.
- **Archify** (`archify/` si existe): motor de diagramación visual (lifecycle, workflow, architecture, dataflow, sequence) con renderers `archify/renderers/*/render-*.mjs` que compilan specs JSON a HTML/SVG interactivo. Si no existe en disco, el Dashboard DEBE funcionar en modo degradado y declarar el contrato de integración.
- **Persistencia actual**: `.un-specweaver/config.json` con preferencias (`lang`, `engramScope`, `graphify`); no existe registro multi-proyecto global.

### 2.2 Problema

1. **Sin vista agregada**: el desarrollador alterna manualmente entre repos; no hay inventario de proyectos ni conmutación rápida.
2. **Filesystem como fuente de verdad sin reflejo en UI**: ediciones en `epics.md` / `.spec/**` desde CLI o agentes quedan invisibles hasta recarga manual; falta reactividad.
3. **Escrituras desde UI sin garantías**: si la Web escribe archivos sin atomicidad ni cancelación de eco, el watcher dispara SSE redundante y produce loops de re-render.
4. **Diagramas estáticos**: Archify no está conectado al estado vivo del proyecto (sprints, épicas, cambios).
5. **Terminal fragmentada**: cada repo requiere su propia terminal; no hay drawer unificado con streaming por proyecto.

### 2.3 Oportunidad

Un servidor HTTP/SSE local + watcher filtrado + adaptadores de estado aislados + compilador Archify en memoria + SPA Vanilla ESM resuelve el problema sin introducir dependencias pesadas ni backend remoto. Todo opera sobre rutas absolutas locales y filesystem como fuente de verdad.

## 3. Objetivos

### 3.1 Objetivo general

Construir e integrar un Dashboard Web multi-proyecto, **local y reactivo**, con sincronización bidireccional CLI↔Web en tiempo real, diagramas Archify vivos y terminal integrada.

### 3.2 Objetivos específicos

| ID | Objetivo | Métrica asociada |
|----|----------|------------------|
| OBJ-01 | Registro, descubrimiento, importación e inicialización de N proyectos locales aislados | Registro <2 s, validación de ruta 100% |
| OBJ-02 | Sincronización CLI→Web inmediata vía SSE con latencia <300 ms | p95 FS_CHANGE→render <300 ms |
| OBJ-03 | Escritura Web→disco atómica sin loops de eco (ventana 500 ms) | 0 emisiones SSE espurias por escritura propia |
| OBJ-04 | Diagramas Archify reactivos sin parpadeos, encapsulados | Actualización <300 ms, CSS encapsulado |
| OBJ-05 | Conmutación de proyecto <100 ms sin recarga | Quick Switcher p95 <100 ms |
| OBJ-06 | Terminal integrada por proyecto con streaming en tiempo real | TTFT <500 ms, auto-scroll sin pérdida |
| OBJ-07 | Comando `dashboard`/`ui` con `--open`, ESM estricto, `npm test` verde | `npm test` 100% pass |

### 3.3 No-objetivos (resumen)

Distribución remota, autenticación multi-usuario, persistencia en base de datos, edición colaborativa remota, reemplazo del CLI.

## 4. Usuarios y stakeholders

| Actor | Rol | Necesidad principal | Frecuencia |
|-------|-----|---------------------|------------|
| **Desarrollador local** | Usuario primario | Ver y operar N repos desde una sola UI sin cambiar de terminal | Diaria |
| **Agente CLI (OpenCode/Pi/Cursor)** | Actor sistema | Escribir `epics.md`/`.spec/**` y que la UI lo refleje sin intervención | Continua |
| **Mantenedor un-specweaver** | Stakeholder | Extender `src/dashboard/` sin romper invariantes (no chdir, atómico, filtrado) | Por change |
| **Revisor / QA** | Stakeholder | Verificar estado consolidado (épicas, sprint, doctor, git) por proyecto | Por sprint |

**Protagonista para validación UX**: *Carlos, mantenedor de un-specweaver que mantiene 4 repos con BMAD*. Abre el dashboard, registra dos repos existentes, inicializa uno nuevo, conmuta con `Cmd+P` entre ellos, ve el workflow Archify actualizarse mientras un agente CLI escribe `epics.md`, y ejecuta `doctor` desde el drawer sin salir de la UI.

## 5. Requisitos funcionales

> Convención: cada FR usa **DEBE** (Must) o **DEBERÍA** (Should). La columna *Traza* indica paso del plan, endpoint o módulo. Validación `DEBE = shall`.

### Capacidad 1 — Gestión multi-proyecto y persistencia global

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-001** | El sistema DEBE registrar un proyecto existente mediante `POST /api/projects` con `{ path, name? }`, validando que `path` sea absoluto, exista y sea directorio, generando `id` UUID/slug estable y rechazando duplicados por `path` canónico. | Must | Paso 1, `project-manager.mjs`, `POST /api/projects` |
| **FR-002** | El sistema DEBE inicializar un proyecto nuevo mediante `POST /api/projects/init` ejecutando `init`/`adopt` en la ruta dada para materializar `.spec/` (o `.openspec/` según convención) y registrarlo en el inventario global. | Must | Paso 1, `POST /api/projects/init` |
| **FR-003** | El sistema DEBE listar todos los proyectos con `GET /api/projects`, retornando metadata por proyecto: `{ id, name, path, specDir, lastActive, createdAt }` más salud (existe ruta, existe `specDir`, git limpio/sucio). | Must | `GET /api/projects`, `project-manager.mjs` |
| **FR-004** | El sistema DEBE persistir el registro global en `~/.un-specweaver/projects.json` con forma `{ activeProjectId, projects: [...] }` mediante **escritura atómica** (archivo temporal + `rename`) sin pérdida ante caída o escritura concurrente. | Must | Paso 1, `projects.json` |
| **FR-005** | El sistema DEBE validar y normalizar todas las rutas como **absolutas canónicas** (`path.resolve` + `realpath` si aplica), generar `id` UUID v4 y `name` derivado del directorio si no se provee, y almacenar `createdAt`/`lastActive` en ISO-8601. | Must | `project-manager.mjs` |
| **FR-006** | El sistema DEBE detectar artefactos existentes por proyecto: presencia de `.spec/`, `.openspec/`, `specs/`, `epics.md` / `epics.*.md` y exponerlos en metadata para la UI. | Must | `project-manager.mjs`, `state-adapter` |
| **FR-007** | El sistema DEBE mantener `activeProjectId` como proyecto activo para el Quick Switcher y actualizar `lastActive` en cada conmutación o acción por proyecto. | Should | `projects.json`, SPA state |

### Capacidad 2 — Aislamiento de estado y adaptadores

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-010** | Ningún módulo bajo `src/dashboard/` DEBE invocar `process.chdir()`; toda interacción con bridge/CLI/filesystem DEBE recibir `projectPath` explícito o ejecutar subprocess con `{ cwd: projectPath }`. | Must | Invariante AD-01, todos los módulos |
| **FR-011** | El adaptador de estado DEBE exponer lectura de épicas delegando en `bridge/parse-epics.mjs` recibiendo `projectPath` explícito, sin depender de cwd global, y retornar estructura normalizada de épicas (pendiente/en progreso/completada). | Must | Paso 2, `state-adapter.mjs` |
| **FR-012** | El adaptador DEBE exponer lectura de sprint actual delegando en `bridge/plan-sprint.mjs` con `projectPath` explícito y retornar sprint activo, capacidad y asignaciones. | Must | Paso 2, `state-adapter.mjs` |
| **FR-013** | El adaptador DEBE exponer validación/emisión de specs delegando en `bridge/emit-openspec.mjs` con `projectPath` explícito. | Must | Paso 2, `state-adapter.mjs` |
| **FR-014** | El sistema DEBE consolidar estado por proyecto vía `GET /api/projects/:id/state` retornando `{ epics, sprint, git, doctor }` agregado por los adaptadores aislados. | Must | `GET /api/projects/:id/state`, `state-adapter.mjs` |
| **FR-015** | El sistema DEBE retornar error tipado `404 PROJECT_NOT_FOUND` si `:id` no existe y `400 INVALID_PATH` si `path` no es absoluto o no existe, sin exponer stack interno. | Must | `server.mjs` validación |

### Capacidad 3 — Servidor HTTP/SSE y runner de comandos

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-020** | El servidor DEBE exponer exactamente los endpoints REST/SSE especificados: `GET /api/projects`, `POST /api/projects`, `POST /api/projects/init`, `GET /api/projects/:id/state`, `GET /api/projects/:id/diagram`, `PUT /api/projects/:id/epics`, `POST /api/projects/:id/changes`, `POST /api/projects/:id/commands`, `GET /api/projects/:id/commands/:execId/stream` (SSE), `GET /api/events` (SSE global). | Must | Paso 3, `server.mjs` |
| **FR-021** | El servidor DEBE iniciar en puerto libre con default `3100`, reintentando puerto siguiente si está ocupado, sirviendo la SPA en `/` y registrando la URL efectiva en stdout. | Must | `server.mjs`, bin |
| **FR-022** | El canal `GET /api/events` DEBE ser SSE global con eventos tipados `{ type: FS_CHANGE \| PROJECT_SYNC, projectId, file, timestamp }`, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, keepalive y reconexión. | Must | `server.mjs`, `watcher.mjs` |
| **FR-023** | El runner DEBE ejecutar comandos (`sync`, `doctor`, `build`, y extensibles) en `subprocess` con `{ cwd: projectPath }` aislado, exponer `POST /api/projects/:id/commands` que retorna `{ executionId }` inmediato y streaming posterior. | Must | Paso 3, `command-runner.mjs` |
| **FR-024** | El endpoint `GET /api/projects/:id/commands/:execId/stream` DEBE transmitir `stdout`/`stderr` en tiempo real vía SSE por chunks, preservar orden, señalar cierre con evento `close` y soportar múltiples suscriptores por ejecución. | Must | `command-runner.mjs` |
| **FR-025** | El sistema DEBE escribir `PUT /api/projects/:id/epics` de forma **atómica** (tmp+rename) y registrar el hash/timestamp en `recentWrites` para supresión de eco. | Must | `server.mjs`, watcher eco |
| **FR-026** | El sistema DEBE registrar nuevas specs vía `POST /api/projects/:id/changes` validando invariantes antes de escribir en `.spec/**` o `specs/**`. | Must | `POST /api/projects/:id/changes` |

### Capacidad 4 — Observación reactiva y supresión de eco

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-030** | El watcher DEBE monitorear **únicamente** los patrones `epics.md`, `epics.*.md`, `.spec/**`, `.openspec/**`, `specs/**` por proyecto. | Must | Paso 4, `watcher.mjs` |
| **FR-031** | El watcher DEBE ignorar estrictamente `.git/**`, `node_modules/**`, `dist/**`, `build/**`, `.turbo/**`, `.cache/**` en todos los proyectos. | Must | `watcher.mjs` filtrado |
| **FR-032** | El watcher DEBE aplicar **debounce 150 ms** por archivo/proyecto antes de emitir, coalesciendo ráfagas de escritura. | Must | `watcher.mjs` |
| **FR-033** | El sistema DEBE implementar **cancelación de eco**: cuando el servidor escribe un archivo originado en Web UI, DEBE registrar `timestamp`/`hash` en memoria (`recentWrites`); si el watcher detecta cambio del mismo archivo dentro de **500 ms**, DEBE omitir la emisión SSE hacia el cliente emisor (o marcarla como eco suprimido). | Must | `watcher.mjs`, `server.mjs` |
| **FR-034** | El sistema DEBE mantener **multi-watcher** con instancia/debounce aislado por proyecto, permitiendo agregar/remover proyectos sin reiniciar el servidor. | Must | `watcher.mjs` |
| **FR-035** | El evento `FS_CHANGE` DEBE incluir `projectId`, `file` relativo al proyecto y `timestamp` ISO-8601. | Must | SSE contrato |

### Capacidad 5 — Compilador Archify en memoria

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-040** | El bridge Archify DEBE mapear el estado consolidado (sprints activos, épicas por estado, cambios/tickets) a esquemas JSON válidos de Archify (`workflow` o `lifecycle`) según el renderer disponible. | Must | Paso 5, `archify-bridge.mjs` |
| **FR-041** | El bridge DEBE invocar renderers nativos **en memoria** (`archify/renderers/workflow/render-workflow.mjs` o `render-lifecycle.mjs`) sin subprocess ni escritura temporal, retornando markup HTML/SVG. | Must | `archify-bridge.mjs` |
| **FR-042** | El endpoint `GET /api/projects/:id/diagram` DEBE compilar y retornar HTML/SVG Archify del estado actual, con `Content-Type` adecuado, encapsulado vía `iframe srcdoc` o `div.archify-container` con CSS encapsulado (sin fugas al shell). | Must | `GET /api/projects/:id/diagram`, `archify-bridge.mjs` |
| **FR-043** | La UI DEBE actualizar el visor Archify en vivo en **<300 ms** tras `FS_CHANGE` sin parpadeos (diff/patch o reemplazo con transición), degradando a placeholder si Archify no está disponible. | Must | SPA + SSE |
| **FR-044** | Si `archify/` no existe o el renderer falla, el sistema DEBERÍA retornar diagrama degradado (placeholder con estado textual) y `200` con header `X-Archify-Degraded: true` en lugar de `500`. | Should | `archify-bridge.mjs` |

### Capacidad 6 — Frontend SPA reactiva

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-050** | La SPA DEBE proveer **Selector Rápido (Quick Switcher)** invocable con `Cmd+P` / `Ctrl+P`, con búsqueda difusa por nombre/path, cambio de contexto en **<100 ms sin recarga** y actualización de `activeProjectId`. | Must | Paso 6, `public/app.mjs` |
| **FR-051** | La SPA DEBE mostrar **Tablero de Control Activo**: resumen del sprint actual, estado de épicas (Pendiente / En Progreso / Completada), diagnóstico `doctor`, e indicador de pulso verde cuando SSE está conectado y sincronizado. | Must | `public/` tablero |
| **FR-052** | La SPA DEBE incluir **Visor de Procesos Archify** con render reactivo del ciclo de vida/workflow, actualización <300 ms y sandbox de estilos. | Must | Visor Archify |
| **FR-053** | La SPA DEBE incluir **Terminal Drawer** colapsable con `Ctrl+~` / `Cmd+J`, botones rápidos `sync` / `doctor` / `sprint` / `build`, streaming con formato terminal, auto-scroll y preservación de historial por proyecto. | Must | Terminal drawer |
| **FR-054** | Toda la interfaz DEBE estar en **español técnico** (labels, mensajes, errores, atajos) sin mezclar inglés en copy visible. | Must | SPA + API mensajes |
| **FR-055** | La SPA DEBE ser **Vanilla ESM sin dependencias pesadas** (HTML5/CSS3/ESM nativo, sin bundler obligatorio), servida como estáticos desde `src/dashboard/public/`. | Must | `public/` |
| **FR-056** | La SPA DEBERÍA soportar atajos adicionales: `Esc` cierra switcher/drawer, `?` muestra ayuda de atajos. | Should | SPA |

### Capacidad 7 — CLI, DX y calidad

| ID | Requisito | Prioridad | Traza |
|----|-----------|-----------|-------|
| **FR-060** | El binario DEBE exponer `un-specweaver dashboard` con alias `ui`, que inicia el servidor y sirve la UI. | Must | Paso 7, `bin/un-specweaver.mjs` |
| **FR-061** | El comando DEBE soportar flag `--open` (y `--port`, `--host`) abriendo el navegador del sistema a la URL efectiva. | Must | `bin/un-specweaver.mjs` |
| **FR-062** | El proyecto DEBE mantenerse **ESM estricto** (`type: module`, `import`/`export` nativo) y pasar `npm test` sin regresiones; los tests de dashboard viven en `test/dashboard.test.mjs`. | Must | Paso 8, `package.json` |
| **FR-063** | La documentación DEBE incluir `src/layer/commands/es/dashboard.md` describiendo uso, flags y ejemplos en español. | Must | Paso 7 |
| **FR-064** | El sistema DEBE validar concurrencia multi-proyecto, SSE, supresión de eco y ejecución con `cwd` aislado mediante batería automatizada (`test/dashboard.test.mjs`). | Must | Paso 8 |

## 6. Requisitos no funcionales

| ID | Requisito | Criterio de aceptación | Prioridad |
|----|-----------|------------------------|-----------|
| **NFR-001** | Latencia CLI→Web | Cambio en `epics.md` desde CLI/agente se refleja en UI en **<300 ms** p95 (FS event → SSE → render). | Must |
| **NFR-002** | Latencia de conmutación | Quick Switcher cambia contexto datos/diagramas/terminal en **<100 ms** p95 sin recarga. | Must |
| **NFR-003** | Debounce watcher | Coalescencia **150 ms** por archivo/proyecto; ráfagas no generan N eventos. | Must |
| **NFR-004** | Ventana de eco | Supresión **500 ms**; 0 eventos SSE espurios por escritura propia de la Web. | Must |
| **NFR-005** | Runtime | Node **>=20.11**, ESM estricto, sin `require()` ni `process.chdir()`. | Must |
| **NFR-006** | Atomicidad | Escrituras de `projects.json` y `epics.md` atómicas (tmp+rename); sin corrupción ante caída. | Must |
| **NFR-007** | Aislamiento cwd | Cada operación de proyecto usa `projectPath` explícito o `subprocess { cwd }`; verificado por grep estático `process.chdir` = 0. | Must |
| **NFR-008** | Filtrado watcher | 0 eventos por cambios en `.git/**`, `node_modules/**`, `dist/**`, `build/**`, `.turbo/**`, `.cache/**`. | Must |
| **NFR-009** | SSE resiliencia | Reconexión automática, keepalive (ping cada ~25 s), `Last-Event-ID` si aplica, sin pérdida de eventos críticos. | Should |
| **NFR-010** | Seguridad de paths | Solo rutas absolutas; `path.resolve` + validación de existencia; sin traversal fuera de `projectPath`. | Must |
| **NFR-011** | Encapsulado Archify | CSS/JS del diagrama no fuga al shell; `iframe srcdoc` o shadow/CSS scoping. | Must |
| **NFR-012** | Sin dependencias pesadas frontend | SPA sin React/Vue/bundler obligatorio; ESM nativo, <100 KB JS inicial. | Should |
| **NFR-013** | Observabilidad | Logs de servidor con `projectId` y `file` en cada evento; errores con código tipado. | Should |
| **NFR-014** | Portabilidad | Funciona en Linux/macOS/Windows con Node >=20.11; `~/.un-specweaver/` resuelto vía `os.homedir()`. | Must |
| **NFR-015** | Testabilidad | `npm test` incluye `test/dashboard.test.mjs` con cobertura de concurrencia, SSE, eco y cwd. | Must |

## 7. Métricas de éxito

| Métrica | Objetivo | Instrumentación |
|---------|----------|-----------------|
| Tiempo registro proyecto | p50 <1 s, p95 <2 s | Log `project-manager` |
| Latencia FS→SSE→render | p95 <300 ms | Timestamp FS vs SSE `timestamp` vs `performance.now()` en SPA |
| Eventos espurios por escritura Web | 0 por ventana 500 ms | Contador `recentWrites` suprimidos |
| Conmutación proyecto | p95 <100 ms sin recarga | Medición SPA `switchProject()` |
| SSE uptime | >99.5% en sesión local | Pulso verde + reconexiones |
| `npm test` | 100% pass, 0 regresiones | CI |
| Adopción interna | 3+ repos registrados por mantenedor en primera semana | `projects.json` count |

## 8. Fuera de alcance

| Ítem | Razón |
|------|-------|
| Backend remoto / multi-usuario / auth | Sistema local single-user; sin superficie de red externa |
| Persistencia en BD (SQLite/Postgres) | Fuente de verdad es filesystem + `projects.json` |
| Edición colaborativa remota (OT/CRDT) | Solo sincronización local FS↔UI |
| Reemplazo del CLI | El CLI sigue siendo la interfaz primaria; el dashboard es espejo/control |
| Soporte Node <20.11 o CommonJS | Stack cerrado a ESM moderno |
| Bundler obligatorio para frontend | Vanilla ESM; bundler opcional solo para optimización futura |
| Generación de diagramas fuera de Archify | Solo renderers nativos Archify; no Mermaid/PlantUML directo |
| Watcher de archivos fuera de la lista blanca | Solo `epics.md`, `.spec/**`, `.openspec/**`, `specs/**` |

## 9. Dependencias y riesgos

### 9.1 Dependencias

| Dependencia | Tipo | Mitigación |
|-------------|------|------------|
| `bridge/parse-epics.mjs`, `plan-sprint.mjs`, `emit-openspec.mjs` | Interna | Adaptadores con `projectPath` explícito; tests con fixtures |
| `archify/renderers/*/render-*.mjs` | Interna opcional | Modo degradado + `X-Archify-Degraded`; contrato JSON documentado |
| `os.homedir()` + `~/.un-specweaver/projects.json` | FS | Creación perezosa del directorio, escritura atómica, validación JSON con fallback |
| `fs.watch` / `chokidar` | Runtime | Abstraer watcher; preferir `chokidar` si está disponible, fallback a `fs.watch` con polling |
| `child_process.spawn` para runner | Runtime | `cwd` explícito, kill en cierre, límite de concurrencia |
| Navegador para `--open` (`open`/`xdg-open`/`start`) | OS | Detección por plataforma, fallo silencioso si no hay GUI |

### 9.2 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `archify/` no existe en disco | Media | Medio | Degradado + contrato; no bloquear boot del dashboard |
| `process.chdir` accidental rompe aislamiento | Baja | Alto | Grep en CI + invariante AD-01 + tests de cwd |
| Escritura concurrente corrompe `projects.json` | Media | Alto | Atómico tmp+rename + lock en memoria + validación JSON |
| Watcher emite ruido de `.git`/`node_modules` | Alta | Medio | Lista negra estricta + tests de filtrado |
| Loop de eco Web→FS→SSE→re-render | Alta | Alto | `recentWrites` 500 ms + hash, tests de supresión |
| Puerto 3100 ocupado | Media | Bajo | Búsqueda de puerto libre incremental |
| SPA sin bundler escala mal | Baja | Bajo | Deferido: bundler opcional si JS >100 KB |

## 10. Preguntas abiertas

| ID | Pregunta | Estado | Decisión provisional |
|----|----------|--------|----------------------|
| PA-01 | ¿`chokidar` como dependencia o `fs.watch` nativo? | Abierta | Usar `fs.watch` nativo si es suficiente; añadir `chokidar` solo si se demuestra inestabilidad en macOS/Windows. Registrar en `package.json` como `optionalDependencies` si se elige. |
| PA-02 | Formato exacto del JSON Archify `workflow` vs `lifecycle` | Abierta | Soportar ambos; `archify-bridge` detecta renderer disponible y normaliza. Documentar esquema mínimo en `architecture.md`. |
| PA-03 | ¿`specDir` configurable por proyecto o fijo `.spec/`? | Abierta | `specDir` por proyecto en `projects.json`, default `.spec`, autodetección de `.spec`/`.openspec`/`specs`. |
| PA-04 | Límite de proyectos simultáneos y watchers | Abierta | Sin límite duro; cada watcher es independiente; documentar recomendación ≤20 proyectos. |
| PA-05 | Autenticación local (token) para endpoints | Abierta | **Fuera de alcance v1**: solo localhost (`127.0.0.1`), sin auth. Si se expone, añadir token en v2. |
| PA-06 | Persistencia de historial de terminal por proyecto | Abierta | En memoria por ejecución + buffer circular 10k líneas; persistencia en disco deferida. |

## 11. Traza de validación

| Grupo FR | Criterio de aceptación verificable |
|----------|-------------------------------------|
| FR-001..007 | `POST /api/projects` con path absoluto registra, `GET /api/projects` lista, `projects.json` atómico, duplicado rechazado |
| FR-010..015 | Grep `process.chdir` = 0, `GET /api/projects/:id/state` retorna epics+sprint+git+doctor con `projectPath` explícito |
| FR-020..026 | Todos los endpoints responden según contrato; `PUT epics` atómico; `POST changes` valida invariantes |
| FR-030..035 | Watcher solo emite por lista blanca, ignora lista negra, debounce 150 ms, eco suprimido 500 ms |
| FR-040..044 | `GET /api/projects/:id/diagram` retorna SVG/HTML encapsulado <300 ms, degradado si Archify ausente |
| FR-050..056 | Quick Switcher <100 ms, tablero con pulso, Archify vivo, drawer con streaming, 100% español |
| FR-060..064 | `un-specweaver dashboard --open` inicia y abre navegador, `npm test` verde |

---

*Artefacto generado en fase de planeación BMAD — estado `draft` hasta validación de arquitectura y epics.*
