## Why

Entrega la Story 8.4 del Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software.

## What Changes

- Sincronización en Tiempo Real Código ↔ Visual mediante SSE.
- El watcher de `server.mjs` detecta la modificación, emite el evento SSE correspondiente (`epics_updated`, `sprint_updated`, `specs_updated`) y el store de React Flow actualiza los nodos sin reiniciar el viewport (`zoom`/`pan`).
- El nodo y sus aristas conectadas se remueven o actualizan mediante transiciones suaves animadas.
- El evento SSE se suprime o se marca como redundante, evitando re-renders duplicados o parpadeos en el lienzo.

## Capabilities

### New Capabilities

### Modified Capabilities

- `reconstruccion-frontend-react-react-flow-e-interactividad-bi`: agrega el requisito "Sincronización en Tiempo Real Código ↔ Visual mediante SSE".

## Impact

- Origen: BMAD Story 8.4 — Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software
- Requisitos de esta story: FR-093
- Capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
