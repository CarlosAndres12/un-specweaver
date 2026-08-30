## Why

Entrega la Story 3.1 del Epic 3: Compilador Archify e integración visual.

## What Changes

- Bridge Archify — mapper y render en memoria.
- Retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify.
- Hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`.
- Retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`.

## Capabilities

### New Capabilities

- `compilador-archify-e-integracion-visual`: **Objetivo:** mapear estado vivo a JSON Archify y renderizar HTML/SVG en memoria con sandbox y degradado. Cubre paso 5 del plan. **Incluye:** `src/dashboard/archify-bridge.mjs`, `GET /api/projects/:id/diagram`, visor Archify reactivo. **Depende de:** Epic 1, 2. **Bloquea a:** Epic 4 (visor).

### Modified Capabilities

## Impact

- Origen: BMAD Story 3.1 — Epic 3: Compilador Archify e integración visual
- Requisitos de esta story: FR-040, FR-041, FR-044
- Capability: `compilador-archify-e-integracion-visual`
