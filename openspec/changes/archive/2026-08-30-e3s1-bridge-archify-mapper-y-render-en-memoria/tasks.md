## 1. Implementacion

- [x] 1.1 retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify
- [x] 1.2 hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`
- [x] 1.3 retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`

## 2. Verificacion

- [x] 2.1 Test del criterio 1: retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify
- [x] 2.2 Test del criterio 2: hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`
- [x] 2.3 Test del criterio 3: retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`
