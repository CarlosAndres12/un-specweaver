## 1. Implementacion

- [ ] 1.1 retorna `202 { executionId }` inmediato y hace `spawn` con `{ cwd: "/abs/repo-a" }` (verificable vía `ps` o log)
- [ ] 1.2 recibo chunks `event: COMMAND_OUTPUT` con `{ executionId, chunk, stream: "stdout"|"stderr" }` en orden y `event: COMMAND_CLOSE` con `exitCode` al terminar; múltiples suscriptores reciben lo mismo
- [ ] 1.3 cada stream emite solo la salida de su propio `cwd`, sin cruzar
- [ ] 1.4 mata procesos hijos y cierra streams con `COMMAND_CLOSE`

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: retorna `202 { executionId }` inmediato y hace `spawn` con `{ cwd: "/abs/repo-a" }` (verificable vía `ps` o log)
- [ ] 2.2 Test del criterio 2: recibo chunks `event: COMMAND_OUTPUT` con `{ executionId, chunk, stream: "stdout"|"stderr" }` en orden y `event: COMMAND_CLOSE` con `exitCode` al terminar; múltiples suscriptores reciben lo mismo
- [ ] 2.3 Test del criterio 3: cada stream emite solo la salida de su propio `cwd`, sin cruzar
- [ ] 2.4 Test del criterio 4: mata procesos hijos y cierra streams con `COMMAND_CLOSE`
