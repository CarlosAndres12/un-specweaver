## Why

Entrega la Story 7.1 del Epic 7: Comando y flujo de actualización (`un-specweaver update`).

## What Changes

- Comando CLI `un-specweaver update`.
- El comando lee la configuración guardada, regenera la capa `layer` para los agentes registrados (escribiendo `.agents/skills/`, `.claude/`, etc.) sin sobreescribir `docs/architecture-base.md` ni `openspec/` y finaliza con código 0.
- Actualiza el arreglo de agentes en `.un-specweaver/config.json` y genera los artefactos del nuevo agente (ej. `.agents/skills/sw-*/SKILL.md`).
- Ejecuta la comprobación de drift y reconciliación de versiones de vendors pineados.
- Muestra las acciones previstas sin modificar ningún archivo en disco.

## Capabilities

### New Capabilities

- `comando-y-flujo-de-actualizacion-un-specweaver-update`: **Objetivo:** proveer un comando unificado y predecible `un-specweaver update` para sincronizar las skills, comandos y dependencias en proyectos ya existentes, sin requerir combinaciones manuales de flags. **Incluye:** CLI dispatch `update` en `bin/un-specweaver.mjs`, lógica de actualización de capa y agentes en `src/init.mjs`, integración con el runner en `src/dashboard/` y comando/skill `sw-update`. **Depende de:** Epic 1 y Epic 4. **Bloquea a:** nada (mejora de ciclo de vida).

### Modified Capabilities

## Impact

- Origen: BMAD Story 7.1 — Epic 7: Comando y flujo de actualización (`un-specweaver update`)
- Requisitos de esta story: FR-080, FR-081
- Capability: `comando-y-flujo-de-actualizacion-un-specweaver-update`
