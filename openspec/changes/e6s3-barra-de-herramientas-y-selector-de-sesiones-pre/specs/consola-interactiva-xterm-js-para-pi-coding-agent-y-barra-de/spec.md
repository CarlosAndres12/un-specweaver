## ADDED Requirements

### Requirement: Barra de Herramientas y Selector de Sesiones Previas
The system SHALL support barra de Herramientas y Selector de Sesiones Previas.

#### Scenario: Se inspecciona la barra superior de herramientas
- **GIVEN** el terminal drawer desplegado
- **WHEN** se inspecciona la barra superior de herramientas
- **THEN** presenta un selector de sesión activa/histórica y botones de acceso directo: `[+ Nueva Sesión (pi)]`, `[🔄 Continuar (pi -c)]`, `[📜 Reanudar (pi -r)]`

#### Scenario: Se lanza el comando
- **GIVEN** el usuario hace clic en `[🔄 Continuar (pi -c)]`
- **WHEN** se lanza el comando
- **THEN** se invoca `pi` con el argumento `-c` en el directorio de trabajo del proyecto activo y se asocia la sesión en el selector

#### Scenario: El usuario selecciona una sesión previa en el desplegable
- **GIVEN** hay múltiples comandos o sesiones ejecutadas
- **WHEN** el usuario selecciona una sesión previa en el desplegable
- **THEN** el visor conmuta al buffer/historial correspondiente sin perder el estado del proceso en ejecución
