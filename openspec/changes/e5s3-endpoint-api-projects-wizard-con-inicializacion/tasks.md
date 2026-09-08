## 1. Implementacion

- [ ] 1.1 crea el directorio destino si no existe, escribe `_bmad-output/planning-artifacts/product-brief.md`, `_bmad-output/planning-artifacts/prd.md`, `.un-specweaver/config.json`, registra el proyecto en `~/.un-specweaver/projects.json`, retorna `201 { project, executionId }` y conmuta automáticamente el proyecto activo en la UI en `<100ms`
- [ ] 1.2 retorna `400 INVALID_PATH` sin escribir archivos y con mensaje descriptivo en español

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: crea el directorio destino si no existe, escribe `_bmad-output/planning-artifacts/product-brief.md`, `_bmad-output/planning-artifacts/prd.md`, `.un-specweaver/config.json`, registra el proyecto en `~/.un-specweaver/projects.json`, retorna `201 { project, executionId }` y conmuta automáticamente el proyecto activo en la UI en `<100ms`
- [ ] 2.2 Test del criterio 2: retorna `400 INVALID_PATH` sin escribir archivos y con mensaje descriptivo en español
