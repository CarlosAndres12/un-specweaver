## ADDED Requirements

### Requirement: Lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio
The system SHALL support lienzo Interactivo con React Flow (`@xyflow/react`) y Nodos de Dominio.

#### Scenario: Abro la vista de arquitectura o tablero
- **GIVEN** un proyecto activo con épicas, historias y especificaciones
- **WHEN** abro la vista de arquitectura o tablero
- **THEN** se renderiza un canvas interactivo React Flow con nodos customizados tipados: `EpicNode`, `StoryNode`, `SpecNode`, `ContractNode` y `WaveNode`

#### Scenario: Se carga la vista o se pulsa el botón `[✨ Auto-Layout]`
- **GIVEN** un grafo con N nodos y dependencias declaradas
- **WHEN** se carga la vista o se pulsa el botón `[✨ Auto-Layout]`
- **THEN** el motor calcula la distribución jerárquica libre de colisiones (algoritmo DAG por niveles) respetando el flujo de izquierda a derecha (o arriba a abajo)

#### Scenario: Realiza paneo, zoom con rueda/gesto o navega mediante el minimapa
- **GIVEN** el usuario interactuando con el canvas
- **WHEN** realiza paneo, zoom con rueda/gesto o navega mediante el minimapa
- **THEN** el rendimiento se mantiene a 60 fps estables sin retrasos ni degradación visual

#### Scenario: Cambia el estado de la entidad asociada (ej. historia pasa a `in-progres
- **GIVEN** un nodo en el canvas
- **WHEN** cambia el estado de la entidad asociada (ej. historia pasa a `in-progress` o spec a `implemented`)
- **THEN** el nodo actualiza su estilo visual, borde de color e indicador de estado de forma reactiva
