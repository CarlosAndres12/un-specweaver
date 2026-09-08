## ADDED Requirements

### Requirement: Skill y flujo guiado `sw-update`
The system SHALL support skill y flujo guiado `sw-update`.

#### Scenario: Se generan los comandos y skills para los agentes
- **GIVEN** la ejecución de la capa `layer`
- **WHEN** se generan los comandos y skills para los agentes
- **THEN** se compilan `src/layer/commands/*/update.md` en los destinos correspondientes (`.claude/commands/sw/update.md`, `.opencode/commands/sw-update.md`, `.agents/skills/sw-update/SKILL.md`) con el paso a paso de verificación y actualización
