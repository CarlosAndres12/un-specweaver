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

---

## Epic 5: Asistente Interactivo Multi-Paso de Creación de Proyecto (Brief + PRD Numerado)

**Objetivo:** Guiar al usuario a través de un wizard interactivo para estructurar un nuevo proyecto desde cero (`/sw:new`), definiendo el Product Brief, el PRD con requisitos funcionales y no funcionales numerados (`FR-XXX`, `NFR-XXX`), la arquitectura base y la inicialización determinística en disco con conmutación inmediata.

**Incluye:** `src/dashboard/wizard-service.mjs`, endpoint `POST /api/projects/wizard`, vista SPA `#vista-nuevo-proyecto`, generador de artefactos Markdown, diagramas de flujo y Pi Shell streaming.

**Depende de:** Epic 1, Epic 2, Epic 4.

### Story 5.1: Formulario multi-paso interactivo en Frontend SPA

**Description:** Como desarrollador o agente, quiero una interfaz asistida de 5 pasos con barra de progreso, validación por paso y campos dinámicos para requisitos numerados, de modo que pueda formular proyectos completos sin fricción.

**FRs:** FR-070, FR-071, FR-072, FR-073

**Acceptance Criteria:**

- **Given** la SPA en el navegador
  **When** selecciono la vista "🌱 Nuevo Proyecto"
  **Then** se presenta el asistente de 5 pasos (1: Identidad, 2: Brief, 3: PRD & Requisitos, 4: Arquitectura, 5: Previsualización & Lanzamiento) con stepper visual.

- **Given** el Paso 3 (PRD & Requisitos)
  **When** presiono "Añadir Requisito Funcional" o "Añadir Requisito No Funcional"
  **Then** se inserta una nueva fila con ID autoincremental (`FR-00X`, `NFR-00X`), campo de título y criterios de aceptación, permitiendo eliminación individual.

- **Given** campos obligatorios incompletos en un paso
  **When** intento avanzar con "Siguiente"
  **Then** el paso bloquea la transición y resalta visualmente los campos requeridos en español técnico.

---

### Story 5.2: Generador determinístico de Product Brief y PRD con requisitos numerados

**Description:** Como sistema, quiero compilar los datos del formulario en artefactos normativos Markdown estructurados (`product-brief.md` y `prd.md`), respetando las convenciones y formatos de BMad.

**FRs:** FR-071, FR-072, FR-074

**Acceptance Criteria:**

- **Given** los datos completados del asistente
  **When** se alcanza el Paso 5 (Previsualización)
  **Then** la UI genera una vista previa renderizada en vivo de `_bmad-output/planning-artifacts/product-brief.md` y `prd.md` con tabla de requisitos normativos numerados (`FR-XXX`, `NFR-XXX`) y diagramas de arquitectura.

- **Given** el PRD generado
  **When** se inspeccionan los requisitos
  **Then** cada requisito contiene su código (`FR-001`, `FR-002`, `NFR-001`), descripción normativa con el verbo DEBE, y prioridad (Must/Should).

---

### Story 5.3: Endpoint `/api/projects/wizard` con inicialización y conmutación automática

**Description:** Como cliente SPA, quiero enviar el payload completo del wizard al backend para materializar la estructura de carpetas, persistir los artefactos, registrar el proyecto y ejecutar la inicialización en streaming hacia la Pi Shell.

**FRs:** FR-075

**Acceptance Criteria:**

- **Given** `POST /api/projects/wizard` con payload válido
  **When** el servidor procesa la solicitud
  **Then** crea el directorio destino si no existe, escribe `_bmad-output/planning-artifacts/product-brief.md`, `_bmad-output/planning-artifacts/prd.md`, `.un-specweaver/config.json`, registra el proyecto en `~/.un-specweaver/projects.json`, retorna `201 { project, executionId }` y conmuta automáticamente el proyecto activo en la UI en `<100ms`.

- **Given** `path` no absoluto o ruta inválida
  **When** hago `POST /api/projects/wizard`
  **Then** retorna `400 INVALID_PATH` sin escribir archivos y con mensaje descriptivo en español.

---

## Epic 6: Consola Interactiva Xterm.js para Pi Coding Agent y Barra de Sesiones

**Objetivo:** Proporcionar una experiencia de terminal de grado profesional interactiva basada en Xterm.js para ejecutar el agente de codificación local Pi (`/usr/bin/pi`) y herramientas de SpecWeaver, eliminando la necesidad de hacer scroll al pie de página mediante auto-apertura y botón flotante persistente.

**Incluye:** Integración de `@xterm/xterm` y `@xterm/addon-fit`, botón flotante (FAB) de acceso rápido, captura bidireccional de stdin, barra superior de gestión de sesiones (`pi -c`, `pi -r`) y apertura reactiva sin scroll.

**Depende de:** Epic 4. **Bloquea a:** nada.

### Story 6.1: Terminal Drawer interactivo con Xterm.js y Botón Flotante (Zero-Scroll)

**Description:** Como desarrollador, quiero ver el resultado de cualquier comando inmediatamente en un terminal interactivo Xterm.js sin tener que desplazarme al final de la página, pudiendo abrirlo desde cualquier parte con un botón flotante persistente.

**FRs:** FR-050, FR-052, FR-056

**Acceptance Criteria:**

- **Given** el usuario se encuentra en cualquier sección o posición de scroll del panel
  **When** hace clic en cualquier botón de acción (`doctor`, `build`, `pi`, etc.) o en el botón flotante `[💻 Terminal]`
  **Then** el cajón de terminal se abre de forma inmediata y automática con animación suave, enfocando la consola Xterm.js sin requerir scroll manual al pie de página.

- **Given** el terminal se encuentra abierto
  **When** se redimensiona la ventana o el drawer
  **Then** el `FitAddon` recalcula las filas y columnas adaptando el lienzo de Xterm.js fluidamente.

- **Given** el usuario presiona `Esc` o hace clic en el botón cerrar
  **When** el terminal se cierra
  **Then** el botón flotante permanece visible con indicador de estado si hay un proceso ejecutándose en segundo plano.

---

### Story 6.2: Ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`)

**Description:** Como desarrollador, quiero interactuar bidireccionalmente con el agente de codificación Pi en tiempo real a través de Xterm.js con soporte completo para secuencias ANSI, cursor y teclas de control.

**FRs:** FR-052, FR-060, FR-061

**Acceptance Criteria:**

- **Given** una sesión iniciada con el comando `pi`
  **When** el agente local emite secuencias de escape ANSI (colores, formateo de texto, prompts)
  **Then** Xterm.js renderiza los estilos con fidelidad completa sin romper texto plano ni códigos crudos.

- **Given** el usuario escribe en el terminal (letras, Enter, flechas, Ctrl+C)
  **When** se dispara el evento `term.onData`
  **Then** los bytes se transmiten a través del endpoint `POST /api/projects/:id/commands/:execId/input` hacia el flujo `stdin` del subproceso `child_process`.

---

### Story 6.3: Barra de Herramientas y Selector de Sesiones Previas

**Description:** Como desarrollador, quiero una barra de herramientas en la cabecera del terminal para alternar entre ejecuciones activas, continuar la última sesión (`pi -c`) o reanudar sesiones históricas (`pi -r`).

**FRs:** FR-052, FR-053

**Acceptance Criteria:**

- **Given** el terminal drawer desplegado
  **When** se inspecciona la barra superior de herramientas
  **Then** presenta un selector de sesión activa/histórica y botones de acceso directo: `[+ Nueva Sesión (pi)]`, `[🔄 Continuar (pi -c)]`, `[📜 Reanudar (pi -r)]`.

- **Given** el usuario hace clic en `[🔄 Continuar (pi -c)]`
  **When** se lanza el comando
  **Then** se invoca `pi` con el argumento `-c` en el directorio de trabajo del proyecto activo y se asocia la sesión en el selector.

- **Given** hay múltiples comandos o sesiones ejecutadas
  **When** el usuario selecciona una sesión previa en el desplegable
  **Then** el visor conmuta al buffer/historial correspondiente sin perder el estado del proceso en ejecución.

---

## Epic 7: Comando y flujo de actualización (`un-specweaver update`)

**Objetivo:** proveer un comando unificado y predecible `un-specweaver update` para sincronizar las skills, comandos y dependencias en proyectos ya existentes, sin requerir combinaciones manuales de flags.

**Incluye:** CLI dispatch `update` en `bin/un-specweaver.mjs`, lógica de actualización de capa y agentes en `src/init.mjs`, integración con el runner en `src/dashboard/` y comando/skill `sw-update`.

**Depende de:** Epic 1 y Epic 4. **Bloquea a:** nada (mejora de ciclo de vida).

### Story 7.1: Comando CLI `un-specweaver update`

**Description:** Como desarrollador, quiero ejecutar `npx un-specweaver update [dir]` en un proyecto previamente inicializado para actualizar la capa de skills y comandos de forma segura sin tener que recordar banderas manuales.

**FRs:** FR-080, FR-081

**Acceptance Criteria:**

- **Given** un proyecto previamente inicializado con `.un-specweaver/config.json`
  **When** ejecuto `npx un-specweaver update` (o `npx un-specweaver update /ruta/al/proyecto`)
  **Then** el comando lee la configuración guardada, regenera la capa `layer` para los agentes registrados (escribiendo `.agents/skills/`, `.claude/`, etc.) sin sobreescribir `docs/architecture-base.md` ni `openspec/` y finaliza con código 0.

- **Given** un proyecto con agentes desactualizados o nuevos agentes
  **When** ejecuto `npx un-specweaver update --agents antigravity`
  **Then** actualiza el arreglo de agentes en `.un-specweaver/config.json` y genera los artefactos del nuevo agente (ej. `.agents/skills/sw-*/SKILL.md`).

- **Given** la bandera `--vendors` o `--force`
  **When** ejecuto `npx un-specweaver update --vendors`
  **Then** ejecuta la comprobación de drift y reconciliación de versiones de vendors pineados.

- **Given** la bandera `--dry-run`
  **When** se invoca con `update`
  **Then** muestra las acciones previstas sin modificar ningún archivo en disco.

---

### Story 7.2: Acción de actualización en Dashboard y Streaming

**Description:** Como desarrollador en el dashboard web, quiero poder disparar la actualización de skills y entorno del proyecto activo con visualización en tiempo real en la terminal integrada.

**FRs:** FR-082

**Acceptance Criteria:**

- **Given** el dashboard web abierto en un proyecto
  **When** se hace clic en `[🔄 Actualizar entorno]` o se envía `POST /api/projects/:id/commands { command: "update" }`
  **Then** el runner ejecuta `un-specweaver update` con streaming SSE en la terminal Drawer y actualiza el estado consolidado al concluir.

---

### Story 7.3: Skill y flujo guiado `sw-update`

**Description:** Como agente IA (Claude, OpenCode, Antigravity), quiero disponer de la skill `sw-update` para guiar al desarrollador en la actualización segura del repositorio asegurando precondiciones (git limpio, doctor).

**FRs:** FR-083

**Acceptance Criteria:**

- **Given** la ejecución de la capa `layer`
  **When** se generan los comandos y skills para los agentes
  **Then** se compilan `src/layer/commands/*/update.md` en los destinos correspondientes (`.claude/commands/sw/update.md`, `.opencode/commands/sw-update.md`, `.agents/skills/sw-update/SKILL.md`) con el paso a paso de verificación y actualización.

---

## Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software

**Objetivo:** Sustituir la interfaz web estática y monolítica por una arquitectura React moderna basada en un lienzo interactivo con React Flow (`@xyflow/react`). Proporcionar sincronización bidireccional "software-to-software" en tiempo real: los cambios y conexiones realizados en el lienzo actualizan directamente las especificaciones y código en disco (`epics.md`, `sprint.json`, `.spec/`), mientras que las modificaciones hechas por desarrolladores o agentes IA en el filesystem se reflejan instantáneamente en el canvas mediante SSE sin pérdida de viewport.

**Incluye:** Configuración de Vite/React en `src/dashboard/frontend/` compilado hacia `src/dashboard/public/`, canvas React Flow con nodos de dominio (Épicas, Historias, Specs, Contratos), motor de auto-layout DAG, endpoints de mutación granular en `src/dashboard/server.mjs` y `state-adapter.mjs`, y panel inspector contextual.

**Depende de:** Epic 1, 2 y 4. **Bloquea a:** nada (evolución mayor de la interfaz).

### Story 8.1: Infraestructura Frontend Moderna (React + Vite) y Arquitectura de Componentes

**Description:** Como desarrollador, quiero que el frontend del dashboard esté construido con React y Vite bajo una arquitectura modular y desacoplada (Container-Presentational / Atomic Design), servido limpiamente por `server.mjs`, para superar las limitaciones del monolito de scripts vanilla y permitir interfaces reactivas complejas.

**FRs:** FR-090

**Acceptance Criteria:**

- **Given** la estructura de código en `src/dashboard/frontend/`
  **When** ejecuto `npm run build` o `npm run dev`
  **Then** Vite compila la aplicación React hacia `src/dashboard/public/` generando bundles optimizados con hashing de assets y ESM nativo.

- **Given** el servidor `src/dashboard/server.mjs` iniciado en puerto 3100
  **When** accedo a `http://localhost:3100`
  **Then** `server.mjs` sirve la SPA React con fallback adecuado a `index.html` para rutas del cliente, manteniendo tiempos de carga inicial (LCP) inferiores a 500 ms.

- **Given** el cambio de preferencia de tema (claro / oscuro) en la UI o en el sistema
  **When** el usuario conmuta el tema
  **Then** la aplicación adapta todos los tokens CSS y componentes de forma inmediata utilizando variables de diseño centralizadas sin parpadeos (FOUC).

- **Given** la navegación entre pestañas y vistas (Tablero, Sprint, Specs, Arquitectura)
  **When** el usuario cambia de sección
  **Then** las transiciones utilizan la View Transitions API (`same-document-transitions`) de forma fluida con degradación elegante en navegadores no compatibles.

**Notas técnicas:** Mantener cero dependencias pesadas innecesarias. Configurar Vite con `@vitejs/plugin-react`. Definir tokens semánticos en CSS Vanilla o Tailwind estructurado respetando la paleta existente.

---

### Story 8.2: Lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio

**Description:** Como arquitecto y desarrollador, quiero visualizar el flujo E2E, la arquitectura de software, el DAG de olas de sprint y las dependencias de especificaciones en un lienzo interactivo React Flow con soporte de pan/zoom, minimapa y layout automático, para reemplazar los SVGs estáticos por una representación viva.

**FRs:** FR-091

**Acceptance Criteria:**

- **Given** un proyecto activo con épicas, historias y especificaciones
  **When** abro la vista de arquitectura o tablero
  **Then** se renderiza un canvas interactivo React Flow con nodos customizados tipados: `EpicNode`, `StoryNode`, `SpecNode`, `ContractNode` y `WaveNode`.

- **Given** un grafo con N nodos y dependencias declaradas
  **When** se carga la vista o se pulsa el botón `[✨ Auto-Layout]`
  **Then** el motor calcula la distribución jerárquica libre de colisiones (algoritmo DAG por niveles) respetando el flujo de izquierda a derecha (o arriba a abajo).

- **Given** el usuario interactuando con el canvas
  **When** realiza paneo, zoom con rueda/gesto o navega mediante el minimapa
  **Then** el rendimiento se mantiene a 60 fps estables sin retrasos ni degradación visual.

- **Given** un nodo en el canvas
  **When** cambia el estado de la entidad asociada (ej. historia pasa a `in-progress` o spec a `implemented`)
  **Then** el nodo actualiza su estilo visual, borde de color e indicador de estado de forma reactiva.

**Notas técnicas:** Usar `@xyflow/react`. Implementar custom nodes accesibles con puertos de entrada/salida tipados (`Handle`). Integrar cálculo de layout desacoplado para no bloquear el hilo principal.

---

### Story 8.3: Motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync)

**Description:** Como desarrollador, quiero que al modificar conexiones, dependencias o propiedades en el lienzo de React Flow, el sistema actualice automáticamente los archivos markdown y JSON correspondientes en el filesystem, cerrando el bucle software-to-software.

**FRs:** FR-092

**Acceptance Criteria:**

- **Given** dos historias A y B en el lienzo sin dependencia previa
  **When** el usuario arrastra un conector desde el puerto de salida de A al puerto de entrada de B (`onConnect`)
  **Then** el cliente envía `POST /api/projects/:id/graph/edges` con `{ source: "A", target: "B", type: "dependsOn" }`.

- **Given** la recepción del endpoint de mutación de dependencias en el backend
  **When** `state-adapter.mjs` procesa la solicitud
  **Then** localiza la sección de dependencias en `epics.md` / `sprint.json`, actualiza la regla de precedencia, persiste atómicamente el archivo en disco e incluye el token de supresión de eco para evitar rebote de eventos hacia el cliente emisor.

- **Given** un usuario que edita el título, criterios o estado de una historia en el modal/panel del nodo
  **When** confirma la edición (`onNodeChange`)
  **Then** se despacha `PATCH /api/projects/:id/stories/:storyId`, actualizando el bloque correspondiente en `epics.md` preservando comentarios, formato e indentación intactos.

- **Given** un intento de conexión que generaría un ciclo de dependencia circular (A → B → A)
  **When** el usuario intenta conectar los nodos
  **Then** el canvas valida el ciclo localmente, rechaza la conexión, resalta temporalmente en rojo y muestra un mensaje de advertencia accesible sin alterar los archivos.

**Notas técnicas:** El backend debe utilizar parseo AST estructurado para markdown o delimitadores unívocos en `state-adapter.mjs`. Escrituras con `writeAtomic()` y ventana de supresión de eco activa.

---

### Story 8.4: Sincronización en Tiempo Real Código ↔ Visual mediante SSE

**Description:** Como desarrollador que utiliza herramientas CLI o agentes autónomos (OpenCode, Claude, Antigravity) en terminal, quiero que cualquier cambio realizado directamente en los archivos de disco se proyecte de inmediato en el lienzo de React Flow sin recargar la página ni perder mi posición de trabajo.

**FRs:** FR-093

**Acceptance Criteria:**

- **Given** el canvas React Flow abierto enfocado en un subconjunto de nodos
  **When** un agente IA en CLI crea una nueva historia o modifica un spec en disco
  **Then** el watcher de `server.mjs` detecta la modificación, emite el evento SSE correspondiente (`epics_updated`, `sprint_updated`, `specs_updated`) y el store de React Flow actualiza los nodos sin reiniciar el viewport (`zoom`/`pan`).

- **Given** una historia que es eliminada o renombrada desde el editor de código
  **When** el evento SSE llega al cliente
  **Then** el nodo y sus aristas conectadas se remueven o actualizan mediante transiciones suaves animadas.

- **Given** una escritura originada desde la propia interfaz web (Story 8.3)
  **When** el watcher detecta el cambio en disco dentro de la ventana de eco (<500 ms con token coincidente)
  **Then** el evento SSE se suprime o se marca como redundante, evitando re-renders duplicados o parpadeos en el lienzo.

**Notas técnicas:** Conectar el stream SSE global con el store de React Flow. Aplicar reconciliación por ID de nodo para preservar posiciones de nodos si el usuario los ha reorganizado manualmente.

---

### Story 8.5: Panel Lateral Inspector y Consola Terminal Reactiva

**Description:** Como ingeniero de software, quiero hacer clic en cualquier nodo del lienzo interactivo para abrir un panel lateral con el contenido real de la especificación/código, y poder ejecutar acciones contextuales directas (`build`, `doctor`, `test`) con salida visual en la terminal drawer.

**FRs:** FR-094

**Acceptance Criteria:**

- **Given** el lienzo con múltiples nodos
  **When** el usuario hace clic en un nodo de Historia o Spec
  **Then** se abre un panel lateral contextual (drawer) mostrando el markdown fuente, requisitos funcionales vinculados, criterios Given/When/Then y estado git.

- **Given** el panel lateral abierto para una historia lista para construcción
  **When** el usuario hace clic en el botón `[🔨 Construir Story]`
  **Then** se despliega el terminal drawer con xterm.js, se ejecuta el comando `build` asociado mediante streaming en tiempo real y el nodo en el canvas entra en estado visual animado `building`.

- **Given** la finalización exitosa del comando de construcción en la terminal
  **When** el proceso concluye con código de salida 0
  **Then** el nodo transiciona automáticamente a estado verde `completed` en el lienzo con un micro-feedback visual.

**Notas técnicas:** Reutilizar la integración `@xterm/xterm` ya probada en Epic 6, integrándola en un layout reactivo con Split-Pane o Navigation Drawer.

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
                                                           │
                                                      5.1 ─┴─→ 5.2 ─→ 5.3
                                                                      │
                                                                 6.1 ─┴─→ 6.2 ─→ 6.3
                                                                                 │
                                                                            7.1 ─┴─→ 7.2 ─→ 7.3
                                                                                            │
                                                                                       8.1 ─┴─→ 8.2 ─→ 8.3 ─→ 8.4 ─→ 8.5
```

- **Epic 1** es fundación sin dependencias externas.
- **Epic 2** depende de Epic 1 (necesita `project-manager` y `state-adapter` para resolver `projectId`→`projectPath`).
- **Epic 3** depende de Epic 1+2 (necesita `state` y `server`).
- **Epic 4** depende de 1+2+3 (SPA consume `state`, `diagram`, `SSE`, `commands`).
- **Epic 5** depende de 1+2+4 (asistente de creación e integración con `projects.json`, `app.mjs` y streaming).
- **Epic 6** depende de Epic 4 (integración con `terminal-drawer` y `commands` API).
- **Epic 7** depende de Epic 1 y Epic 4 (actualización de layer, CLI y runner de dashboard).
- **Epic 8** depende de Epic 1, 2, 4 y 6 (reemplaza el frontend estático por React + React Flow con bi-direccionalidad hacia el backend y terminal drawer).

Paralelizable dentro de cada epic: 1.1 y 1.3 en paralelo tras esqueleto; 2.3 y 2.2 en paralelo tras 2.1; 5.1 y 5.2 en paralelo; 6.2 y 6.3 en paralelo; 7.1 y 7.3 en paralelo tras diseño; 8.1 y 8.2 en paralelo tras definir los contratos de datos del grafo.

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
| FR-070,071,072,073 | 5.1 |
| FR-071,072,074 | 5.2 |
| FR-075 | 5.3 |
| FR-050,052,056 | 6.1 |
| FR-052,060,061 | 6.2 |
| FR-052,053 | 6.3 |
| FR-080,081 | 7.1 |
| FR-082 | 7.2 |
| FR-083 | 7.3 |
| FR-090 | 8.1 |
| FR-091 | 8.2 |
| FR-092 | 8.3 |
| FR-093 | 8.4 |
| FR-094 | 8.5 |

## Criterios de listo (DoD) por story

- Código ESM estricto, sin `process.chdir`, rutas absolutas validadas.
- Tests `node --test` o pruebas de componentes que cubren Given/When/Then de la story.
- Endpoint/contrato documentado en `architecture.md` si aplica.
- `npm test` verde sin regresiones.
- Copy en español técnico si toca UI.
- Atomicidad en escrituras Web→disco con supresión de eco probada (<500 ms).

---

*Epics derivados del PRD `prd.md` y spine `architecture.md` — 8 epics, 26 stories.*
