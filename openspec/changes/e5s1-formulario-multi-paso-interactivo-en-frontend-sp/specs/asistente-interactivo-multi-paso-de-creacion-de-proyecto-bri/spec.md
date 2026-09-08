## Purpose

**Objetivo:** Guiar al usuario a través de un wizard interactivo para estructurar un nuevo proyecto desde cero (`/sw:new`), definiendo el Product Brief, el PRD con requisitos funcionales y no funcionales numerados (`FR-XXX`, `NFR-XXX`), la arquitectura base y la inicialización determinística en disco con conmutación inmediata. **Incluye:** `src/dashboard/wizard-service.mjs`, endpoint `POST /api/projects/wizard`, vista SPA `#vista-nuevo-proyecto`, generador de artefactos Markdown, diagramas de flujo y Pi Shell streaming. **Depende de:** Epic 1, Epic 2, Epic 4.

## ADDED Requirements

### Requirement: Formulario multi-paso interactivo en Frontend SPA
The system SHALL support formulario multi-paso interactivo en Frontend SPA.

#### Scenario: Selecciono la vista "🌱 Nuevo Proyecto"
- **GIVEN** la SPA en el navegador
- **WHEN** selecciono la vista "🌱 Nuevo Proyecto"
- **THEN** se presenta el asistente de 5 pasos (1: Identidad, 2: Brief, 3: PRD & Requisitos, 4: Arquitectura, 5: Previsualización & Lanzamiento) con stepper visual

#### Scenario: Presiono "Añadir Requisito Funcional" o "Añadir Requisito No Funcional"
- **GIVEN** el Paso 3 (PRD & Requisitos)
- **WHEN** presiono "Añadir Requisito Funcional" o "Añadir Requisito No Funcional"
- **THEN** se inserta una nueva fila con ID autoincremental (`FR-00X`, `NFR-00X`), campo de título y criterios de aceptación, permitiendo eliminación individual

#### Scenario: Intento avanzar con "Siguiente"
- **GIVEN** campos obligatorios incompletos en un paso
- **WHEN** intento avanzar con "Siguiente"
- **THEN** el paso bloquea la transición y resalta visualmente los campos requeridos en español técnico
