## ADDED Requirements

### Requirement: Ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`)
The system SHALL support ejecución e Interacción Bidireccional con Pi Agent (`/usr/bin/pi`).

#### Scenario: El agente local emite secuencias de escape ANSI (colores, formateo de te
- **GIVEN** una sesión iniciada con el comando `pi`
- **WHEN** el agente local emite secuencias de escape ANSI (colores, formateo de texto, prompts)
- **THEN** Xterm.js renderiza los estilos con fidelidad completa sin romper texto plano ni códigos crudos

#### Scenario: Se dispara el evento `term.onData`
- **GIVEN** el usuario escribe en el terminal (letras, Enter, flechas, Ctrl+C)
- **WHEN** se dispara el evento `term.onData`
- **THEN** los bytes se transmiten a través del endpoint `POST /api/projects/:id/commands/:execId/input` hacia el flujo `stdin` del subproceso `child_process`
