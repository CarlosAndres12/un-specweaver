## ADDED Requirements

### Requirement: Bridge Archify — mapper y render en memoria
The system SHALL support bridge Archify — mapper y render en memoria.

#### Scenario: Llamo `compileDiagram(projectPath)` vía `archify-bridge`
- **GIVEN** un estado consolidado con 3 épicas (1 completada, 1 en progreso, 1 pendiente) y sprint activo
- **WHEN** llamo `compileDiagram(projectPath)` vía `archify-bridge`
- **THEN** retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify

#### Scenario: Compilo
- **GIVEN** `archify/renderers/workflow/render-workflow.mjs` existe
- **WHEN** compilo
- **THEN** hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`

#### Scenario: Compilo (3)
- **GIVEN** `archify/` no existe o el renderer lanza
- **WHEN** compilo
- **THEN** retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`
