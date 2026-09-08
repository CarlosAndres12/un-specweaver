## ADDED Requirements

### Requirement: Panel Lateral Inspector y Consola Terminal Reactiva
The system SHALL support panel Lateral Inspector y Consola Terminal Reactiva.

#### Scenario: El usuario hace clic en un nodo de Historia o Spec
- **GIVEN** el lienzo con múltiples nodos
- **WHEN** el usuario hace clic en un nodo de Historia o Spec
- **THEN** se abre un panel lateral contextual (drawer) mostrando el markdown fuente, requisitos funcionales vinculados, criterios Given/When/Then y estado git

#### Scenario: El usuario hace clic en el botón `[🔨 Construir Story]`
- **GIVEN** el panel lateral abierto para una historia lista para construcción
- **WHEN** el usuario hace clic en el botón `[🔨 Construir Story]`
- **THEN** se despliega el terminal drawer con xterm.js, se ejecuta el comando `build` asociado mediante streaming en tiempo real y el nodo en el canvas entra en estado visual animado `building`

#### Scenario: El proceso concluye con código de salida 0
- **GIVEN** la finalización exitosa del comando de construcción en la terminal
- **WHEN** el proceso concluye con código de salida 0
- **THEN** el nodo transiciona automáticamente a estado verde `completed` en el lienzo con un micro-feedback visual
