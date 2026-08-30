## 1. Implementacion

- [x] 1.1 el servidor ejecuta `init` (o `adopt` si ya hay artefactos) con `{ cwd: projectPath }`, crea `.spec/` (o `specDir` correspondiente), registra el proyecto y retorna `201 { project }`
- [x] 1.2 retorna `400 INVALID_PATH` y no invoca `init`
- [x] 1.3 el nuevo proyecto aparece con `specDir` correcto y `createdAt`/`lastActive` ISO-8601

## 2. Verificacion

- [x] 2.1 Test del criterio 1: el servidor ejecuta `init` (o `adopt` si ya hay artefactos) con `{ cwd: projectPath }`, crea `.spec/` (o `specDir` correspondiente), registra el proyecto y retorna `201 { project }`
- [x] 2.2 Test del criterio 2: retorna `400 INVALID_PATH` y no invoca `init`
- [x] 2.3 Test del criterio 3: el nuevo proyecto aparece con `specDir` correcto y `createdAt`/`lastActive` ISO-8601
