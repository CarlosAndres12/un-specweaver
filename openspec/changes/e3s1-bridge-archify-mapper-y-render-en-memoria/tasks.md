## 1. Implementacion

- [ ] 1.1 retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify
- [ ] 1.2 hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`
- [ ] 1.3 retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: retorna `{ markup: "<svg|html>", type: "workflow"|"lifecycle" }` mapeando épicas a nodos/fases y sprint a `currentPhase` o `edges`, usando esquema JSON válido Archify
- [ ] 2.2 Test del criterio 2: hace `import()` dinámico en memoria y retorna markup sin escribir temporales ni hacer `spawn`
- [ ] 2.3 Test del criterio 3: retorna placeholder textual con estado (ej. "3 épicas, 1 sprint activo") y el caller marca `X-Archify-Degraded: true` sin `500`
