## Why

Entrega la Story 3.2 del Epic 3: Compilador Archify e integración visual.

## What Changes

- Endpoint de diagrama y visor reactivo sin parpadeos.
- Retorna `200` con `Content-Type: text/html` (o `image/svg+xml` si es SVG puro) y markup encapsulado (`iframe srcdoc` o `div.archify-container` con CSS prefijado `.archify-*`).
- El visor Archify re-fetchea `GET /diagram` y actualiza sin parpadeo (transición o diff), preservando scroll.
- Retorna `200` con placeholder textual y header `X-Archify-Degraded: true`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `compilador-archify-e-integracion-visual`: agrega el requisito "Endpoint de diagrama y visor reactivo sin parpadeos".

## Impact

- Origen: BMAD Story 3.2 — Epic 3: Compilador Archify e integración visual
- Requisitos de esta story: FR-042, FR-043
- Capability: `compilador-archify-e-integracion-visual`
