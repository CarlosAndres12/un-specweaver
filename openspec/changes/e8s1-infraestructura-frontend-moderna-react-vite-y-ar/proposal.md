## Why

Entrega la Story 8.1 del Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software.

## What Changes

- Infraestructura Frontend Moderna (React + Vite) y Arquitectura de Componentes.
- Vite compila la aplicación React hacia `src/dashboard/public/` generando bundles optimizados con hashing de assets y ESM nativo.
- `server.mjs` sirve la SPA React con fallback adecuado a `index.html` para rutas del cliente, manteniendo tiempos de carga inicial (LCP) inferiores a 500 ms.
- La aplicación adapta todos los tokens CSS y componentes de forma inmediata utilizando variables de diseño centralizadas sin parpadeos (FOUC).
- Las transiciones utilizan la View Transitions API (`same-document-transitions`) de forma fluida con degradación elegante en navegadores no compatibles.

## Capabilities

### New Capabilities

- `reconstruccion-frontend-react-react-flow-e-interactividad-bi`: **Objetivo:** Sustituir la interfaz web estática y monolítica por una arquitectura React moderna basada en un lienzo interactivo con React Flow (`@xyflow/react`). Proporcionar sincronización bidireccional "software-to-software" en tiempo real: los cambios y conexiones realizados en el lienzo actualizan directamente las especificaciones y código en disco (`epics.md`, `sprint.json`, `.spec/`), mientras que las modificaciones hechas por desarrolladores o agentes IA en el filesystem se reflejan instantáneamente en el canvas mediante SSE sin pérdida de viewport. **Incluye:** Configuración de Vite/React en `src/dashboard/frontend/` compilado hacia `src/dashboard/public/`, canvas React Flow con nodos de dominio (Épicas, Historias, Specs, Contratos), motor de auto-layout DAG, endpoints de mutación granular en `src/dashboard/server.mjs` y `state-adapter.mjs`, y panel inspector contextual. **Depende de:** Epic 1, 2 y 4. **Bloquea a:** nada (evolución mayor de la interfaz).

### Modified Capabilities

## Impact

- Origen: BMAD Story 8.1 — Epic 8: Reconstrucción Frontend React + React Flow e Interactividad Bidireccional Software-to-Software
- Requisitos de esta story: FR-090
- Capability: `reconstruccion-frontend-react-react-flow-e-interactividad-bi`
