## ADDED Requirements

### Requirement: Supresión de eco 500 ms (Web→FS sin loop)
The system SHALL support supresión de eco 500 ms (Web→FS sin loop).

#### Scenario: El servidor escribe atómicamente y registra `recentWrites.set(absPath, {
- **GIVEN** hago `PUT /api/projects/proj-1/epics { content: "# nuevo" }` (origen Web)
- **WHEN** el servidor escribe atómicamente y registra `recentWrites.set(absPath, { hash, ts: now() })` y el watcher detecta el fs event dentro de 500 ms
- **THEN** el watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor)

#### Scenario: El watcher detecta el cambio
- **GIVEN** el mismo archivo `epics.md` es escrito por CLI/agente (sin `recentWrites`)
- **WHEN** el watcher detecta el cambio
- **THEN** emite `FS_CHANGE` normalmente sin supresión

#### Scenario: Hay un cambio posterior (CLI) sobre el mismo archivo
- **GIVEN** escribo desde Web y pasan >500 ms
- **WHEN** hay un cambio posterior (CLI) sobre el mismo archivo
- **THEN** sí emite `FS_CHANGE` (ventana expirada, hash distinto)

#### Scenario: Ambas escrituras son atómicas
- **GIVEN** `PUT /api/projects/:id/epics` concurrente
- **WHEN** ambas escrituras son atómicas
- **THEN** `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente
