## 1. Implementacion

- [x] 1.1 cada uno retorna las épicas de su propio `projectPath` sin usar `process.chdir` (grep `process.chdir` en `src/dashboard/` = 0)
- [x] 1.2 retorna `200 { epics, sprint, git, doctor }` agregado por adaptadores con `projectPath` explícito; si `bridge/parse-epics.mjs` o `plan-sprint.mjs` no encuentran artefactos, retornan estructura vacía sin `500`
- [x] 1.3 retorna `404 PROJECT_NOT_FOUND` con código tipado
- [x] 1.4 recibe `projectPath` como argumento explícito o `cwd` de subprocess, nunca cwd global

## 2. Verificacion

- [x] 2.1 Test del criterio 1: cada uno retorna las épicas de su propio `projectPath` sin usar `process.chdir` (grep `process.chdir` en `src/dashboard/` = 0)
- [x] 2.2 Test del criterio 2: retorna `200 { epics, sprint, git, doctor }` agregado por adaptadores con `projectPath` explícito; si `bridge/parse-epics.mjs` o `plan-sprint.mjs` no encuentran artefactos, retornan estructura vacía sin `500`
- [x] 2.3 Test del criterio 3: retorna `404 PROJECT_NOT_FOUND` con código tipado
- [x] 2.4 Test del criterio 4: recibe `projectPath` como argumento explícito o `cwd` de subprocess, nunca cwd global
