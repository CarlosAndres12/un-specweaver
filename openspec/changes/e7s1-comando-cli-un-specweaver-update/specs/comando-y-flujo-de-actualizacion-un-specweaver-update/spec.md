## Purpose

**Objetivo:** proveer un comando unificado y predecible `un-specweaver update` para sincronizar las skills, comandos y dependencias en proyectos ya existentes, sin requerir combinaciones manuales de flags. **Incluye:** CLI dispatch `update` en `bin/un-specweaver.mjs`, lógica de actualización de capa y agentes en `src/init.mjs`, integración con el runner en `src/dashboard/` y comando/skill `sw-update`. **Depende de:** Epic 1 y Epic 4. **Bloquea a:** nada (mejora de ciclo de vida).

## ADDED Requirements

### Requirement: Comando CLI `un-specweaver update`
The system SHALL support comando CLI `un-specweaver update`.

#### Scenario: Ejecuto `npx un-specweaver update` (o `npx un-specweaver update /ruta/al
- **GIVEN** un proyecto previamente inicializado con `.un-specweaver/config.json`
- **WHEN** ejecuto `npx un-specweaver update` (o `npx un-specweaver update /ruta/al/proyecto`)
- **THEN** el comando lee la configuración guardada, regenera la capa `layer` para los agentes registrados (escribiendo `.agents/skills/`, `.claude/`, etc.) sin sobreescribir `docs/architecture-base.md` ni `openspec/` y finaliza con código 0

#### Scenario: Ejecuto `npx un-specweaver update --agents antigravity`
- **GIVEN** un proyecto con agentes desactualizados o nuevos agentes
- **WHEN** ejecuto `npx un-specweaver update --agents antigravity`
- **THEN** actualiza el arreglo de agentes en `.un-specweaver/config.json` y genera los artefactos del nuevo agente (ej. `.agents/skills/sw-*/SKILL.md`)

#### Scenario: Ejecuto `npx un-specweaver update --vendors`
- **GIVEN** la bandera `--vendors` o `--force`
- **WHEN** ejecuto `npx un-specweaver update --vendors`
- **THEN** ejecuta la comprobación de drift y reconciliación de versiones de vendors pineados

#### Scenario: Se invoca con `update`
- **GIVEN** la bandera `--dry-run`
- **WHEN** se invoca con `update`
- **THEN** muestra las acciones previstas sin modificar ningún archivo en disco
