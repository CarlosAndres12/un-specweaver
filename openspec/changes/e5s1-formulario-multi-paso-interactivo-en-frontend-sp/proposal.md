## Why

Entrega la Story 5.1 del Epic 5: Asistente Interactivo Multi-Paso de Creación de Proyecto (Brief + PRD Numerado).

## What Changes

- Formulario multi-paso interactivo en Frontend SPA.
- Se presenta el asistente de 5 pasos (1: Identidad, 2: Brief, 3: PRD & Requisitos, 4: Arquitectura, 5: Previsualización & Lanzamiento) con stepper visual.
- Se inserta una nueva fila con ID autoincremental (`FR-00X`, `NFR-00X`), campo de título y criterios de aceptación, permitiendo eliminación individual.
- El paso bloquea la transición y resalta visualmente los campos requeridos en español técnico.

## Capabilities

### New Capabilities

- `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`: **Objetivo:** Guiar al usuario a través de un wizard interactivo para estructurar un nuevo proyecto desde cero (`/sw:new`), definiendo el Product Brief, el PRD con requisitos funcionales y no funcionales numerados (`FR-XXX`, `NFR-XXX`), la arquitectura base y la inicialización determinística en disco con conmutación inmediata. **Incluye:** `src/dashboard/wizard-service.mjs`, endpoint `POST /api/projects/wizard`, vista SPA `#vista-nuevo-proyecto`, generador de artefactos Markdown, diagramas de flujo y Pi Shell streaming. **Depende de:** Epic 1, Epic 2, Epic 4.

### Modified Capabilities

## Impact

- Origen: BMAD Story 5.1 — Epic 5: Asistente Interactivo Multi-Paso de Creación de Proyecto (Brief + PRD Numerado)
- Requisitos de esta story: FR-070, FR-071, FR-072, FR-073
- Capability: `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`
