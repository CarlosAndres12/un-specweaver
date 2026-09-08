## ADDED Requirements

### Requirement: Sincronización en Tiempo Real Código ↔ Visual mediante SSE
The system SHALL support sincronización en Tiempo Real Código ↔ Visual mediante SSE.

#### Scenario: Un agente IA en CLI crea una nueva historia o modifica un spec en disco
- **GIVEN** el canvas React Flow abierto enfocado en un subconjunto de nodos
- **WHEN** un agente IA en CLI crea una nueva historia o modifica un spec en disco
- **THEN** el watcher de `server.mjs` detecta la modificación, emite el evento SSE correspondiente (`epics_updated`, `sprint_updated`, `specs_updated`) y el store de React Flow actualiza los nodos sin reiniciar el viewport (`zoom`/`pan`)

#### Scenario: El evento SSE llega al cliente
- **GIVEN** una historia que es eliminada o renombrada desde el editor de código
- **WHEN** el evento SSE llega al cliente
- **THEN** el nodo y sus aristas conectadas se remueven o actualizan mediante transiciones suaves animadas

#### Scenario: El watcher detecta el cambio en disco dentro de la ventana de eco (<500
- **GIVEN** una escritura originada desde la propia interfaz web (Story 8.3)
- **WHEN** el watcher detecta el cambio en disco dentro de la ventana de eco (<500 ms con token coincidente)
- **THEN** el evento SSE se suprime o se marca como redundante, evitando re-renders duplicados o parpadeos en el lienzo
