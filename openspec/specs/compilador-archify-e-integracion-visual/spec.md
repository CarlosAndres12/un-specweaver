# compilador-archify-e-integracion-visual Specification

## Purpose
TBD - created by archiving change e3s1-bridge-archify-mapper-y-render-en-memoria. Update Purpose after archive.
## Requirements
### Requirement: Bridge Archify — mapper y render en memoria
The system SHALL support bridge Archify — mapper y render en memoria.

#### Scenario: Llamo `compileDiagram(projectPath)` vía `archify-bridge`
- **GIVEN** un estado consolidado con 3 épicas (1 completada, 1 en progreso, 1 pendiente) y sprint activo
- **WHEN** llamo `compileDiagram(projectPath)` vía `archify-bridge`
- **THEN** retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify

#### Scenario: Compilo
- **GIVEN** `archify/renderers/workflow/render-workflow.mjs` existe
- **WHEN** compilo
- **THEN** hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`

#### Scenario: Compilo (3)
- **GIVEN** `archify/` no existe o el renderer lanza
- **WHEN** compilo
- **THEN** retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`

### Requirement: Endpoint de diagrama y visor reactivo sin parpadeos
The system SHALL support endpoint de diagrama y visor reactivo sin parpadeos.

#### Scenario: El estado existe
- **GIVEN** hago `GET /api/projects/proj-1/diagram`
- **WHEN** el estado existe
- **THEN** retorna `200` con `Content-Type: text/html` (o `image/svg+xml` si es SVG puro) y markup encapsulado (`iframe srcdoc` o `div.archify-container` con CSS prefijado `.archify-*`)

#### Scenario: Pasan <300 ms
- **GIVEN** la SPA está suscrita a `GET /api/events` y recibe `FS_CHANGE` para el proyecto activo
- **WHEN** pasan <300 ms
- **THEN** el visor Archify re-fetchea `GET /diagram` y actualiza sin parpadeo (transición o diff), preservando scroll

#### Scenario: Hago `GET /api/projects/:id/diagram`
- **GIVEN** Archify degradado
- **WHEN** hago `GET /api/projects/:id/diagram`
- **THEN** retorna `200` con placeholder textual y header `X-Archify-Degraded: true`

