## Purpose

**Objetivo:** inventario global de proyectos y adaptadores de estado aislados por `projectPath` sin `process.chdir`. Cubre pasos 1–2 del plan. **Incluye:** `src/dashboard/project-manager.mjs`, `src/dashboard/state-adapter.mjs`, `projects.json` atómico, validación de rutas, detección `.spec`. **Depende de:** nada (fundación). **Bloquea a:** Epic 2, 3, 4.

## ADDED Requirements

### Requirement: Registro y listado de proyectos con persistencia atómica
The system SHALL support registro y listado de proyectos con persistencia atómica.

#### Scenario: Hago `POST /api/projects { path: "/abs/repo-a" }`
- **GIVEN** `~/.un-specweaver/projects.json` no existe o está vacío
- **WHEN** hago `POST /api/projects { path: "/abs/repo-a" }`
- **THEN** el servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto

#### Scenario: Hago `POST /api/projects { path: "/abs/repo-a" }` (o con trailing slash
- **GIVEN** un proyecto ya registrado con `path` canónico `/abs/repo-a`
- **WHEN** hago `POST /api/projects { path: "/abs/repo-a" }` (o con trailing slash / symlink equivalente)
- **THEN** retorna `409 DUPLICATE` con código tipado y no duplica entrada

#### Scenario: El servidor valida
- **GIVEN** hago `POST /api/projects { path: "relativo/repo" }` o ruta inexistente
- **WHEN** el servidor valida
- **THEN** retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack

#### Scenario: Hago `GET /api/projects`
- **GIVEN** hay 2 proyectos registrados con `.spec` en uno y `.openspec` en otro
- **WHEN** hago `GET /api/projects`
- **THEN** retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`)

#### Scenario: Todos persisten
- **GIVEN** concurrencia de 5 `POST /api/projects` simultáneos con paths distintos
- **WHEN** todos persisten
- **THEN** `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria)
