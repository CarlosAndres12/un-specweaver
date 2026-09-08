## ADDED Requirements

### Requirement: Motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync)
The system SHALL support motor de Mutación Bidireccional Visual ↔ Código (Visual-to-Code Sync).

#### Scenario: El usuario arrastra un conector desde el puerto de salida de A al puerto
- **GIVEN** dos historias A y B en el lienzo sin dependencia previa
- **WHEN** el usuario arrastra un conector desde el puerto de salida de A al puerto de entrada de B (`onConnect`)
- **THEN** el cliente envía `POST /api/projects/:id/graph/edges` con `{ source: "A", target: "B", type: "dependsOn" }`

#### Scenario: `state-adapter.mjs` procesa la solicitud
- **GIVEN** la recepción del endpoint de mutación de dependencias en el backend
- **WHEN** `state-adapter.mjs` procesa la solicitud
- **THEN** localiza la sección de dependencias en `epics.md` / `sprint.json`, actualiza la regla de precedencia, persiste atómicamente el archivo en disco e incluye el token de supresión de eco para evitar rebote de eventos hacia el cliente emisor

#### Scenario: Confirma la edición (`onNodeChange`)
- **GIVEN** un usuario que edita el título, criterios o estado de una historia en el modal/panel del nodo
- **WHEN** confirma la edición (`onNodeChange`)
- **THEN** se despacha `PATCH /api/projects/:id/stories/:storyId`, actualizando el bloque correspondiente en `epics.md` preservando comentarios, formato e indentación intactos

#### Scenario: El usuario intenta conectar los nodos
- **GIVEN** un intento de conexión que generaría un ciclo de dependencia circular (A → B → A)
- **WHEN** el usuario intenta conectar los nodos
- **THEN** el canvas valida el ciclo localmente, rechaza la conexión, resalta temporalmente en rojo y muestra un mensaje de advertencia accesible sin alterar los archivos
