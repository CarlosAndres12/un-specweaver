## Purpose

**Objetivo:** Sustituir la interfaz web estática y monolítica por una arquitectura React moderna basada en un lienzo interactivo con React Flow (`@xyflow/react`). Proporcionar sincronización bidireccional "software-to-software" en tiempo real: los cambios y conexiones realizados en el lienzo actualizan directamente las especificaciones y código en disco (`epics.md`, `sprint.json`, `.spec/`), mientras que las modificaciones hechas por desarrolladores o agentes IA en el filesystem se reflejan instantáneamente en el canvas mediante SSE sin pérdida de viewport. **Incluye:** Configuración de Vite/React en `src/dashboard/frontend/` compilado hacia `src/dashboard/public/`, canvas React Flow con nodos de dominio (Épicas, Historias, Specs, Contratos), motor de auto-layout DAG, endpoints de mutación granular en `src/dashboard/server.mjs` y `state-adapter.mjs`, y panel inspector contextual. **Depende de:** Epic 1, 2 y 4. **Bloquea a:** nada (evolución mayor de la interfaz).

## ADDED Requirements

### Requirement: Infraestructura Frontend Moderna (React + Vite) y Arquitectura de Componentes
The system SHALL support infraestructura Frontend Moderna (React + Vite) y Arquitectura de Componentes.

#### Scenario: Ejecuto `npm run build` o `npm run dev`
- **GIVEN** la estructura de código en `src/dashboard/frontend/`
- **WHEN** ejecuto `npm run build` o `npm run dev`
- **THEN** Vite compila la aplicación React hacia `src/dashboard/public/` generando bundles optimizados con hashing de assets y ESM nativo

#### Scenario: Accedo a `http://localhost:3100`
- **GIVEN** el servidor `src/dashboard/server.mjs` iniciado en puerto 3100
- **WHEN** accedo a `http://localhost:3100`
- **THEN** `server.mjs` sirve la SPA React con fallback adecuado a `index.html` para rutas del cliente, manteniendo tiempos de carga inicial (LCP) inferiores a 500 ms

#### Scenario: El usuario conmuta el tema
- **GIVEN** el cambio de preferencia de tema (claro / oscuro) en la UI o en el sistema
- **WHEN** el usuario conmuta el tema
- **THEN** la aplicación adapta todos los tokens CSS y componentes de forma inmediata utilizando variables de diseño centralizadas sin parpadeos (FOUC)

#### Scenario: El usuario cambia de sección
- **GIVEN** la navegación entre pestañas y vistas (Tablero, Sprint, Specs, Arquitectura)
- **WHEN** el usuario cambia de sección
- **THEN** las transiciones utilizan la View Transitions API (`same-document-transitions`) de forma fluida con degradación elegante en navegadores no compatibles
