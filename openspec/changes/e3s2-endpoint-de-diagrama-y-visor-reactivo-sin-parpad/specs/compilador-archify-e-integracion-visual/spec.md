## ADDED Requirements

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
