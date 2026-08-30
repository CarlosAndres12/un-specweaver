---
title: "Dashboard Web Multi-Proyecto — Epics y Stories"
status: draft
created: 2026-08-30
updated: 2026-08-30
project: un-specweaver
prd: prd.md
architecture: architecture.md
---

# Epics y Stories — Dashboard Web Multi-Proyecto

> Trazabilidad: cada story cita **FR-XXX** del PRD y respeta invariantes **AD-N** de `architecture.md`. Criterios en **Given/When/Then**. Prioridad Must/Should heredada del FR principal.

---

## Epic 1: Gestión multi-proyecto y aislamiento de estado

**Objetivo:** inventario global de proyectos y adaptadores de estado aislados por `projectPath` sin `process.chdir`. Cubre pasos 1–2 del plan.

**Incluye:** `src/dashboard/project-manager.mjs`, `src/dashboard/state-adapter.mjs`, `projects.json` atómico, validación de rutas, detección `.spec`.

**Depende de:** nada (fundación). **Bloquea a:** Epic 2, 3, 4.

### Story 1.1: Registro y listado de proyectos con persistencia atómica

**Description:** Como desarrollador, quiero registrar una ruta local existente como proyecto y listar todos los proyectos con su salud, para tener un inventario multi-repo confiable.

**FRs:** FR-001, FR-003, FR-004, FR-005, FR-006

**Acceptance Criteria:**

- **Given** `~/.un-specweaver/projects.json` no existe o está vacío
  **When** hago `POST /api/projects { path: "/abs/repo-a" }`
  **Then** el servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto.

- **Given** un proyecto ya registrado con `path` canónico `/abs/repo-a`
  **When** hago `POST /api/projects { path: "/abs/repo-a" }` (o con trailing slash / symlink equivalente)
  **Then** retorna `409 DUPLICATE` con código tipado y no duplica entrada.

- **Given** hago `POST /api/projects { path: "relativo/repo" }` o ruta inexistente
  **When** el servidor valida
  **Then** retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack.

- **Given** hay 2 proyectos registrados con `.spec` en uno y `.openspec` en otro
  **When** hago `GET /api/projects`
  **Then** retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`).

- **Given** concurrencia de 5 `POST /api/projects` simultáneos con paths distintos
  **When** todos persisten
  **Then** `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria).

**Notas técnicas:** `project-manager.mjs` exporta `registerProject(path, name?)`, `listProjects()`, `getProject(id)`, `detectSpecDir(projectPath)`, `writeAtomic()`. Usa `os.homedir()`, `path.resolve`, `fs.realpath` si disponible. Tests con `tmpdir` y `homedir` mockeado.

---

### Story 1.2: Inicialización de proyecto nuevo (init/adopt)

**Description:** Como desarrollador, quiero inicializar un repo vacío o adoptar uno existente para que materialice `.spec/` y quede registrado, sin salir del dashboard.

**FRs:** FR-002, FR-005

**Acceptance Criteria:**

- **Given** una ruta absoluta existente vacía `/abs/nuevo`
  **When** hago `POST /api/projects/init { path: "/abs/nuevo" }`
  **Then** el servidor ejecuta `init` (o `adopt` si ya hay artefactos) con `{ cwd: projectPath }`, crea `.spec/` (o `specDir` correspondiente), registra el proyecto y retorna `201 { project }`.

- **Given** `POST /api/projects/init` con `path` no absoluto o inexistente
  **When** se valida
  **Then** retorna `400 INVALID_PATH` y no invoca `init`.

- **Given** inicialización exitosa
  **When** consulto `GET /api/projects`
  **Then** el nuevo proyecto aparece con `specDir` correcto y `createdAt`/`lastActive` ISO-8601.

**Notas técnicas:** delega en `src/init.mjs` o `bridge/cli.mjs` vía `spawn` con `cwd`; no `chdir`.

---

### Story 1.3: Adaptador de estado aislado (parse-epics / plan-sprint / emit-openspec / doctor)

**Description:** Como mantenedor, quiero que la lectura de épicas, sprint, specs y diagnósticos esté aislada por `projectPath` explícito, para que N proyectos no interfieran entre sí.

**FRs:** FR-010, FR-011, FR-012, FR-013, FR-014, FR-015

**Acceptance Criteria:**

- **Given** dos proyectos A y B con `epics.md` distintos
  **When** llamo `getEpics(projectPathA)` y `getEpics(projectPathB)` vía `state-adapter`
  **Then** cada uno retorna las épicas de su propio `projectPath` sin usar `process.chdir` (grep `process.chdir` en `src/dashboard/` = 0).

- **Given** un `projectId` válido
  **When** hago `GET /api/projects/:id/state`
  **Then** retorna `200 { epics, sprint, git, doctor }` agregado por adaptadores con `projectPath` explícito; si `bridge/parse-epics.mjs` o `plan-sprint.mjs` no encuentran artefactos, retornan estructura vacía sin `500`.

- **Given** un `projectId` inexistente
  **When** hago `GET /api/projects/:id/state`
  **Then** retorna `404 PROJECT_NOT_FOUND` con código tipado.

- **Given** el adaptador invoca `emit-openspec` o `plan-sprint`
  **When** inspecciono la invocación
  **Then** recibe `projectPath` como argumento explícito o `cwd` de subprocess, nunca cwd global.

**Notas técnicas:** `state-adapter.mjs` exporta `getEpicsState(projectPath)`, `getSprintState(projectPath)`, `getDoctorState(projectPath)`, `getGitState(projectPath)`, `getConsolidatedState(projectId)`. Inyecta `projectPath` a `bridge/parse-epics.mjs` y `plan-sprint.mjs` (si el bridge no acepta param, envolver con `spawn { cwd }`).

---

### Story 1.4: Gestión de proyecto activo y metadatos

**Description:** Como usuario del Quick Switcher, quiero que el proyecto activo se persista y su `lastActive` se actualice, para retomar donde dejé.

**FRs:** FR-007, FR-004

**Acceptance Criteria:**

- **Given** hay 3 proyectos y `activeProjectId = proj-1`
  **When** conmuto a `proj-2` (vía API o UI)
  **Then** `projects.json` actualiza `activeProjectId = proj-2` y `lastActive` de `proj-2` a `now()` ISO-8601 con escritura atómica.

- **Given** reinicio el servidor
  **When** hace `GET /api/projects`
  **Then** `activeProjectId` persiste el último valor guardado.

**Notas técnicas:** `project-manager.mjs` exporta `setActiveProject(id)`, `touchLastActive(id)`.

---

## Epic 2: Servidor reactivo y supresión de eco

**Objetivo:** servidor HTTP/SSE, runner de comandos con `cwd` aislado y multi-watcher con debounce y cancelación de eco. Cubre pasos 3–4 del plan.

**Incluye:** `src/dashboard/server.mjs`, `src/dashboard/command-runner.mjs`, `src/dashboard/watcher.mjs`.

**Depende de:** Epic 1. **Bloquea a:** Epic 3, 4 (parcial).

### Story 2.1: Servidor HTTP y endpoints REST/SSE

**Description:** Como cliente de la SPA, quiero endpoints REST y SSE tipados para operar proyectos, de modo que la UI sea proyección reactiva del filesystem.

**FRs:** FR-020, FR-021, FR-022, FR-015

**Acceptance Criteria:**

- **Given** el servidor inicia con `port 3100` ocupado
  **When** hace boot
  **Then** reintenta `3101`, `3102`… hasta puerto libre, sirve `GET /` con la SPA y loguea `Dashboard en http://127.0.0.1:<port>`.

- **Given** el servidor en puerto libre
  **When** hago `GET /api/events` (SSE)
  **Then** responde `200` con `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` y envía ping `: keepalive` cada ~25 s.

- **Given** cualquier endpoint con `:id` inexistente
  **When** hago `GET /api/projects/:id/state` o `PUT /api/projects/:id/epics`
  **Then** retorna `404 PROJECT_NOT_FOUND`.

- **Given** todos los endpoints listados en FR-020
  **When** los invoco según contrato
  **Then** cada uno responde con el status y forma documentada en `architecture.md#4.5` (incluyendo `GET /api/projects/:id/diagram`, `PUT /epics`, `POST /changes`, `POST /commands`, `GET /commands/:execId/stream`).

**Notas técnicas:** `server.mjs` usa `node:http` nativo, router mínimo, sirve estáticos de `src/dashboard/public/`. Tests de integración con `fetch` y cliente SSE.

---

### Story 2.2: Runner de comandos con cwd aislado y streaming SSE

**Description:** Como desarrollador, quiero ejecutar `sync`/`doctor`/`build`/`sprint` desde la UI y ver su salida en tiempo real por proyecto.

**FRs:** FR-023, FR-024

**Acceptance Criteria:**

- **Given** un proyecto `proj-1` con `path /abs/repo-a`
  **When** hago `POST /api/projects/proj-1/commands { command: "doctor" }`
  **Then** retorna `202 { executionId }` inmediato y hace `spawn` con `{ cwd: "/abs/repo-a" }` (verificable vía `ps` o log).

- **Given** una ejecución activa `exec-123`
  **When** hago `GET /api/projects/proj-1/commands/exec-123/stream` (SSE)
  **Then** recibo chunks `event: COMMAND_OUTPUT` con `{ executionId, chunk, stream: "stdout"|"stderr" }` en orden y `event: COMMAND_CLOSE` con `exitCode` al terminar; múltiples suscriptores reciben lo mismo.

- **Given** dos proyectos A y B ejecutando `doctor` simultáneamente
  **When** ambos hacen streaming
  **Then** cada stream emite solo la salida de su propio `cwd`, sin cruzar.

- **Given** cierro el servidor con ejecuciones activas
  **When** recibe `SIGTERM`
  **Then** mata procesos hijos y cierra streams con `COMMAND_CLOSE`.

**Notas técnicas:** `command-runner.mjs` exporta `runCommand(projectPath, command, args)`, `getStream(executionId)`. Límite 2 concurrentes por proyecto, buffer 1 MB con truncado.

---

### Story 2.3: Watcher filtrado con debounce 150 ms

**Description:** Como sistema reactivo, quiero que solo cambios relevantes disparen SSE y que ráfagas se coalescan, para no saturar la UI.

**FRs:** FR-030, FR-031, FR-032, FR-034, FR-035

**Acceptance Criteria:**

- **Given** un watcher activo para `proj-1`
  **When** escribo en `/abs/repo-a/.git/index` o `/abs/repo-a/node_modules/foo/index.js` o `/abs/repo-a/dist/bundle.js`
  **Then** 0 eventos `FS_CHANGE` emitidos.

- **Given** escribo en `/abs/repo-a/epics.md` y `/abs/repo-a/.spec/changes/foo/spec.md`
  **When** el watcher observa
  **Then** emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`.

- **Given** ráfaga de 10 writes a `epics.md` en 50 ms
  **When** pasa debounce 150 ms
  **Then** se emite exactamente 1 evento `FS_CHANGE` coalescado.

- **Given** dos proyectos A y B con watchers independientes
  **When** escribo `epics.md` en A
  **Then** solo A emite `FS_CHANGE` con `projectId: A`; B no emite.

**Notas técnicas:** `watcher.mjs` exporta `createWatcher(projectId, projectPath, onEvent)`, `closeWatcher(projectId)`. Allowlist/denylist configurables, `Map<key, timeout>` para debounce.

---

### Story 2.4: Supresión de eco 500 ms (Web→FS sin loop)

**Description:** Como usuario que guarda desde la Web, quiero que mi escritura no provoque un SSE espurio que re-renderice lo que acabo de guardar.

**FRs:** FR-033, FR-025

**Acceptance Criteria:**

- **Given** hago `PUT /api/projects/proj-1/epics { content: "# nuevo" }` (origen Web)
  **When** el servidor escribe atómicamente y registra `recentWrites.set(absPath, { hash, ts: now() })` y el watcher detecta el fs event dentro de 500 ms
  **Then** el watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor).

- **Given** el mismo archivo `epics.md` es escrito por CLI/agente (sin `recentWrites`)
  **When** el watcher detecta el cambio
  **Then** emite `FS_CHANGE` normalmente sin supresión.

- **Given** escribo desde Web y pasan >500 ms
  **When** hay un cambio posterior (CLI) sobre el mismo archivo
  **Then** sí emite `FS_CHANGE` (ventana expirada, hash distinto).

- **Given** `PUT /api/projects/:id/epics` concurrente
  **When** ambas escrituras son atómicas
  **Then** `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente.

**Notas técnicas:** `recentWrites: Map<string, {hash, ts}>` en `server.mjs` compartido con `watcher.mjs` vía inyección o evento; hash con `crypto.createHash('sha1')` del contenido.

---

## Epic 3: Compilador Archify e integración visual

**Objetivo:** mapear estado vivo a JSON Archify y renderizar HTML/SVG en memoria con sandbox y degradado. Cubre paso 5 del plan.

**Incluye:** `src/dashboard/archify-bridge.mjs`, `GET /api/projects/:id/diagram`, visor Archify reactivo.

**Depende de:** Epic 1, 2. **Bloquea a:** Epic 4 (visor).

### Story 3.1: Bridge Archify — mapper y render en memoria

**Description:** Como sistema, quiero compilar el estado consolidado (épicas, sprints, cambios) a un diagrama Archify válido sin tocar disco ni hacer spawn.

**FRs:** FR-040, FR-041, FR-044

**Acceptance Criteria:**

- **Given** un estado consolidado con 3 épicas (1 completada, 1 en progreso, 1 pendiente) y sprint activo
  **When** llamo `compileDiagram(projectPath)` vía `archify-bridge`
  **Then** retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify.

- **Given** `archify/renderers/workflow/render-workflow.mjs` existe
  **When** compilo
  **Then** hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`.

- **Given** `archify/` no existe o el renderer lanza
  **When** compilo
  **Then** retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`.

**Notas técnicas:** `archify-bridge.mjs` exporta `compileDiagram(projectPath, state?)`, `mapStateToWorkflow(state)`, `mapStateToLifecycle(state)`. Detecta renderer disponible (`workflow` preferido, fallback `lifecycle`).

---

### Story 3.2: Endpoint de diagrama y visor reactivo sin parpadeos

**Description:** Como usuario, quiero ver el diagrama Archify del proyecto activo y que se actualice en vivo sin parpadeos.

**FRs:** FR-042, FR-043

**Acceptance Criteria:**

- **Given** hago `GET /api/projects/proj-1/diagram`
  **When** el estado existe
  **Then** retorna `200` con `Content-Type: text/html` (o `image/svg+xml` si es SVG puro) y markup encapsulado (`iframe srcdoc` o `div.archify-container` con CSS prefijado `.archify-*`).

- **Given** la SPA está suscrita a `GET /api/events` y recibe `FS_CHANGE` para el proyecto activo
  **When** pasan <300 ms
  **Then** el visor Archify re-fetchea `GET /diagram` y actualiza sin parpadeo (transición o diff), preservando scroll.

- **Given** Archify degradado
  **When** hago `GET /api/projects/:id/diagram`
  **Then** retorna `200` con placeholder textual y header `X-Archify-Degraded: true`.

**Notas técnicas:** `server.mjs` → `archify-bridge` → markup; SPA `visor-archify.mjs` con `fetch` + `iframe srcdoc`. Test de encapsulado: estilos del diagrama no afectan `body` del shell.

---

## Epic 4: Frontend y CLI/Tests

**Objetivo:** SPA Vanilla ESM (Quick Switcher, tablero, terminal drawer) + comando CLI `dashboard`/`ui` + batería de tests. Cubre pasos 6–8 del plan.

**Incluye:** `src/dashboard/public/`, `bin/un-specweaver.mjs`, `src/layer/commands/es/dashboard.md`, `test/dashboard.test.mjs`.

**Depende de:** Epic 1, 2, 3.

### Story 4.1: Quick Switcher y tablero de control activo

**Description:** Como desarrollador con N repos, quiero conmutar de proyecto al instante y ver el estado del sprint/épicas/doctor con pulso de sincronización.

**FRs:** FR-050, FR-051, FR-054, FR-055

**Acceptance Criteria:**

- **Given** la SPA cargada con 3 proyectos
  **When** presiono `Cmd+P` (macOS) o `Ctrl+P` (resto)
  **Then** abre overlay Quick Switcher con búsqueda difusa por `name`/`path`, flechas + `Enter` selecciona, y conmuta contexto en <100 ms sin recarga (datos/diagramas/terminal cambian).

- **Given** conmuto de `proj-1` a `proj-2`
  **When** la SPA hace `GET /api/projects/proj-2/state` y `GET /api/projects/proj-2/diagram`
  **Then** el tablero muestra sprint activo, épicas por estado (Pendiente/En Progreso/Completada) y `doctor` del proyecto 2; `activeProjectId` persiste.

- **Given** SSE conectado y sincronizado
  **When** miro el tablero
  **Then** veo indicador pulso verde; si SSE se cae, pulso gris/rojo y reconecta automáticamente.

- **Given** toda la UI
  **When** inspecciono labels y mensajes
  **Then** 100% en español técnico (sin inglés en copy visible).

**Notas técnicas:** `public/app.mjs`, `components/quick-switcher.mjs`, `components/tablero-control.mjs`. SPA Vanilla ESM, sin bundler, estado en memoria + `GET /state` al switch. Atajo `Esc` cierra overlay.

---

### Story 4.2: Visor Archify y terminal drawer con streaming

**Description:** Como desarrollador, quiero ver el diagrama vivo y ejecutar comandos sin salir del dashboard.

**FRs:** FR-052, FR-053, FR-056

**Acceptance Criteria:**

- **Given** el visor Archify con diagrama del proyecto activo
  **When** llega `FS_CHANGE` para ese proyecto
  **Then** el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping).

- **Given** presiono `Ctrl+~` o `Cmd+J`
  **When** el drawer está cerrado
  **Then** se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos.

- **Given** el drawer abierto en `proj-1`
  **When** clic en botón `doctor` (o `sync`/`sprint`/`build`)
  **Then** hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver.

- **Given** ejecuto `doctor` en `proj-1` y luego conmuto a `proj-2`
  **When** vuelvo a `proj-1`
  **Then** el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`.

**Notas técnicas:** `components/visor-archify.mjs`, `components/terminal-drawer.mjs`. SSE client con `EventSource` o `fetch` streaming.

---

### Story 4.3: Comando CLI `dashboard` (alias `ui`) con `--open`

**Description:** Como usuario de terminal, quiero lanzar el dashboard con un comando y abrir el navegador automáticamente.

**FRs:** FR-060, FR-061, FR-063, NFR-005

**Acceptance Criteria:**

- **Given** Node >=20.11 y `bin/un-specweaver.mjs`
  **When** ejecuto `npx un-specweaver dashboard` o `npx un-specweaver ui`
  **Then** inicia el servidor en puerto libre (default 3100), sirve la SPA en `/` y loguea `Dashboard en http://127.0.0.1:<port>`.

- **Given** ejecuto `npx un-specweaver dashboard --open --port 3200`
  **When** el servidor inicia en 3200 (o siguiente libre)
  **Then** abre el navegador del sistema a la URL efectiva (`open`/`xdg-open`/`start` según OS) sin bloquear el proceso.

- **Given** `src/layer/commands/es/dashboard.md`
  **When** lo leo
  **Then** documenta uso, flags (`--open`, `--port`, `--host`), ejemplos y que es ESM estricto, en español.

**Notas técnicas:** `bin/un-specweaver.mjs` añade subcomando `dashboard` (alias `ui`) con `commander` existente o parser propio; flags `--port`, `--host`, `--open`. No `chdir`.

---

### Story 4.4: Batería de tests automatizados

**Description:** Como mantenedor, quiero que `npm test` verifique concurrencia multi-proyecto, SSE, supresión de eco y cwd aislado.

**FRs:** FR-062, FR-064, NFR-015

**Acceptance Criteria:**

- **Given** `test/dashboard.test.mjs` existe
  **When** ejecuto `npm test` (`node --test "test/*.mjs"`)
  **Then** todos los tests pasan (incluyendo los existentes) y cubren:
    - concurrencia: 5 `POST /api/projects` simultáneos sin corrupción
    - SSE: `GET /api/events` emite `FS_CHANGE` tipado tras write en `epics.md`
    - supresión eco: `PUT /epics` (Web) dentro de 500 ms → 0 eventos; write CLI → 1 evento
    - filtrado: writes en `.git/`/`node_modules/` → 0 eventos
    - debounce: ráfaga 10 writes → 1 evento
    - cwd aislado: `POST /commands` hace `spawn { cwd: projectPath }` (spy o `pwd` check)
    - `process.chdir` grep = 0

- **Given** `npm test` en CI
  **When** hay regresión en cualquiera de los invariantes
  **Then** el test falla con mensaje tipado indicando AD violado.

**Notas técnicas:** `node --test` nativo, `node:fs` `tmpdir`, `fetch` para HTTP, `EventSource` o parser SSE manual, `fake timers` o `setTimeout` real con tolerancia. Sin dependencias extra.

---

## Dependencias entre stories

```
1.1 ─┬─→ 1.2 ─→ 1.3 ─→ 1.4
     │              │
     └──────────────┴─→ 2.1 ─→ 2.2
                          │
                     2.3 ─┴─→ 2.4 ─→ 3.1 ─→ 3.2
                                          │
                                     4.1 ─┴─→ 4.2 ─→ 4.3 ─→ 4.4
```

- **Epic 1** es fundación sin dependencias externas.
- **Epic 2** depende de Epic 1 (necesita `project-manager` y `state-adapter` para resolver `projectId`→`projectPath`).
- **Epic 3** depende de Epic 1+2 (necesita `state` y `server`).
- **Epic 4** depende de 1+2+3 (SPA consume `state`, `diagram`, `SSE`, `commands`).

Paralelizable dentro de cada epic: 1.1 y 1.3 pueden iniciarse en paralelo tras esqueleto; 2.3 y 2.2 en paralelo tras 2.1.

## Traza FR → Story

| FR | Story |
|----|-------|
| FR-001,003,004,005,006 | 1.1 |
| FR-002 | 1.2 |
| FR-010,011,012,013,014,015 | 1.3 |
| FR-007 | 1.4 |
| FR-020,021,022 | 2.1 |
| FR-023,024 | 2.2 |
| FR-030,031,032,034,035 | 2.3 |
| FR-033,025 | 2.4 |
| FR-040,041,044 | 3.1 |
| FR-042,043 | 3.2 |
| FR-050,051,054,055 | 4.1 |
| FR-052,053,056 | 4.2 |
| FR-060,061,063 | 4.3 |
| FR-062,064 | 4.4 |

## Criterios de listo (DoD) por story

- Código ESM estricto, sin `process.chdir`, rutas absolutas validadas.
- Tests `node --test` que cubren Given/When/Then de la story (o justificación si es manual).
- Endpoint/contrato documentado en `architecture.md` si aplica.
- `npm test` verde sin regresiones.
- Copy en español técnico si toca UI.

---

*Epics derivados del PRD `prd.md` y spine `architecture.md` — 4 epics, 12 stories, 8 pasos del plan cubiertos.*
