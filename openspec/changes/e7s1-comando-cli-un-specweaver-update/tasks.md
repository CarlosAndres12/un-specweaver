## 1. Implementacion

- [ ] 1.1 el comando lee la configuración guardada, regenera la capa `layer` para los agentes registrados (escribiendo `.agents/skills/`, `.claude/`, etc.) sin sobreescribir `docs/architecture-base.md` ni `openspec/` y finaliza con código 0
- [ ] 1.2 actualiza el arreglo de agentes en `.un-specweaver/config.json` y genera los artefactos del nuevo agente (ej. `.agents/skills/sw-*/SKILL.md`)
- [ ] 1.3 ejecuta la comprobación de drift y reconciliación de versiones de vendors pineados
- [ ] 1.4 muestra las acciones previstas sin modificar ningún archivo en disco

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el comando lee la configuración guardada, regenera la capa `layer` para los agentes registrados (escribiendo `.agents/skills/`, `.claude/`, etc.) sin sobreescribir `docs/architecture-base.md` ni `openspec/` y finaliza con código 0
- [ ] 2.2 Test del criterio 2: actualiza el arreglo de agentes en `.un-specweaver/config.json` y genera los artefactos del nuevo agente (ej. `.agents/skills/sw-*/SKILL.md`)
- [ ] 2.3 Test del criterio 3: ejecuta la comprobación de drift y reconciliación de versiones de vendors pineados
- [ ] 2.4 Test del criterio 4: muestra las acciones previstas sin modificar ningún archivo en disco
