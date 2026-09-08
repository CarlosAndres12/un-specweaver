## Why

Entrega la Story 8.3 del Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software.

## What Changes

- Motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync).
- El cliente envía `POST /api/projects/:id/graph/edges` con `{ source: "A", target: "B", type: "dependsOn" }`.
- Localiza la sección de dependencias en `epics.md` / `sprint.json`, actualiza la regla de precedencia, persiste atómicamente el archivo en disco e incluye el token de supresión de eco para evitar rebote de eventos hacia el cliente emisor.
- Se despacha `PATCH /api/projects/:id/stories/:storyId`, actualizando el bloque correspondiente en `epics.md` preservando comentarios, formato e indentación intactos.
- El canvas valida el ciclo localmente, rechaza la conexión, resalta temporalmente en rojo y muestra un mensaje de advertencia accesible sin alterar los archivos.

## Capabilities

### New Capabilities

### Modified Capabilities

- `reconstruccion-frontend-react-react-flow-e-interactividad-bi`: agrega el requisito "Motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync)".

## Impact

- Origen: BMAD Story 8.3 — Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software
- Requisitos de esta story: FR-092
- Capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
