## 1. Implementacion

- [x] 1.1 todos los tests pasan (incluyendo los existentes) y cubren: concurrencia: 5 `POST /api/projects` simultáneos sin corrupción SSE: `GET /api/events` emite `FS_CHANGE` tipado tras write en `epics.md` supresión eco: `PUT /epics` (Web) dentro de 500 ms → 0 eventos; write CLI → 1 evento filtrado: writes en `.git/`/`node_modules/` → 0 eventos debounce: ráfaga 10 writes → 1 evento cwd aislado: `POST /commands` hace `spawn { cwd: projectPath }` (spy o `pwd` check) `process.chdir` grep = 0
- [x] 1.2 el test falla con mensaje tipado indicando AD violado

## 2. Verificacion

- [x] 2.1 Test del criterio 1: todos los tests pasan (incluyendo los existentes) y cubren: concurrencia: 5 `POST /api/projects` simultáneos sin corrupción SSE: `GET /api/events` emite `FS_CHANGE` tipado tras write en `epics.md` supresión eco: `PUT /epics` (Web) dentro de 500 ms → 0 eventos; write CLI → 1 evento filtrado: writes en `.git/`/`node_modules/` → 0 eventos debounce: ráfaga 10 writes → 1 evento cwd aislado: `POST /commands` hace `spawn { cwd: projectPath }` (spy o `pwd` check) `process.chdir` grep = 0
- [x] 2.2 Test del criterio 2: el test falla con mensaje tipado indicando AD violado
