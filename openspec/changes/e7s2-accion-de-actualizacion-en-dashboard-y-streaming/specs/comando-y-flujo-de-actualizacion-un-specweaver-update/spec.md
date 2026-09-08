## ADDED Requirements

### Requirement: Acción de actualización en Dashboard y Streaming
The system SHALL support acción de actualización en Dashboard y Streaming.

#### Scenario: Se hace clic en `[🔄 Actualizar entorno]` o se envía `POST /api/projects
- **GIVEN** el dashboard web abierto en un proyecto
- **WHEN** se hace clic en `[🔄 Actualizar entorno]` o se envía `POST /api/projects/:id/commands { command: "update" }`
- **THEN** el runner ejecuta `un-specweaver update` con streaming SSE en la terminal Drawer y actualiza el estado consolidado al concluir
