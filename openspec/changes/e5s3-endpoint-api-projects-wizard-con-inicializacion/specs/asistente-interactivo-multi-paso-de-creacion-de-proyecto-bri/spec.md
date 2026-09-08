## ADDED Requirements

### Requirement: Endpoint `/api/projects/wizard` con inicialización y conmutación automática
The system SHALL support endpoint `/api/projects/wizard` con inicialización y conmutación automática.

#### Scenario: El servidor procesa la solicitud
- **GIVEN** `POST /api/projects/wizard` con payload válido
- **WHEN** el servidor procesa la solicitud
- **THEN** crea el directorio destino si no existe, escribe `_bmad-output/planning-artifacts/product-brief.md`, `_bmad-output/planning-artifacts/prd.md`, `.un-specweaver/config.json`, registra el proyecto en `~/.un-specweaver/projects.json`, retorna `201 { project, executionId }` y conmuta automáticamente el proyecto activo en la UI en `<100ms`

#### Scenario: Hago `POST /api/projects/wizard`
- **GIVEN** `path` no absoluto o ruta inválida
- **WHEN** hago `POST /api/projects/wizard`
- **THEN** retorna `400 INVALID_PATH` sin escribir archivos y con mensaje descriptivo en español
