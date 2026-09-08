## Why

Entrega la Story 5.3 del Epic 5: Asistente Interactivo Multi-Paso de Creación de Proyecto (Brief + PRD Numerado).

## What Changes

- Endpoint `/api/projects/wizard` con inicialización y conmutación automática.
- Crea el directorio destino si no existe, escribe `_bmad-output/planning-artifacts/product-brief.md`, `_bmad-output/planning-artifacts/prd.md`, `.un-specweaver/config.json`, registra el proyecto en `~/.un-specweaver/projects.json`, retorna `201 { project, executionId }` y conmuta automáticamente el proyecto activo en la UI en `<100ms`.
- Retorna `400 INVALID_PATH` sin escribir archivos y con mensaje descriptivo en español.

## Capabilities

### New Capabilities

### Modified Capabilities

- `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`: agrega el requisito "Endpoint `/api/projects/wizard` con inicialización y conmutación automática".

## Impact

- Origen: BMAD Story 5.3 — Epic 5: Asistente Interactivo Multi-Paso de Creación de Proyecto (Brief + PRD Numerado)
- Requisitos de esta story: FR-075
- Capability: `asistente-interactivo-multi-paso-de-creacion-de-proyecto-bri`
