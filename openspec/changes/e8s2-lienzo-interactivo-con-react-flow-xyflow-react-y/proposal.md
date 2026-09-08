## Why

Entrega la Story 8.2 del Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software.

## What Changes

- Lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio.
- Se renderiza un canvas interactivo React Flow con nodos customizados tipados: `EpicNode`, `StoryNode`, `SpecNode`, `ContractNode` y `WaveNode`.
- El motor calcula la distribución jerárquica libre de colisiones (algoritmo DAG por niveles) respetando el flujo de izquierda a derecha (o arriba a abajo).
- El rendimiento se mantiene a 60 fps estables sin retrasos ni degradación visual.
- El nodo actualiza su estilo visual, borde de color e indicador de estado de forma reactiva.

## Capabilities

### New Capabilities

### Modified Capabilities

- `reconstruccion-frontend-react-react-flow-e-interactividad-bi`: agrega el requisito "Lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio".

## Impact

- Origen: BMAD Story 8.2 — Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software
- Requisitos de esta story: FR-091
- Capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
