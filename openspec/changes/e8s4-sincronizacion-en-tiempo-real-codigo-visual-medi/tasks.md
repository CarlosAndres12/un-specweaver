## 1. Implementacion

- [ ] 1.1 el watcher de `server.mjs` detecta la modificación, emite el evento SSE correspondiente (`epics_updated`, `sprint_updated`, `specs_updated`) y el store de React Flow actualiza los nodos sin reiniciar el viewport (`zoom`/`pan`)
- [ ] 1.2 el nodo y sus aristas conectadas se remueven o actualizan mediante transiciones suaves animadas
- [ ] 1.3 el evento SSE se suprime o se marca como redundante, evitando re-renders duplicados o parpadeos en el lienzo

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el watcher de `server.mjs` detecta la modificación, emite el evento SSE correspondiente (`epics_updated`, `sprint_updated`, `specs_updated`) y el store de React Flow actualiza los nodos sin reiniciar el viewport (`zoom`/`pan`)
- [ ] 2.2 Test del criterio 2: el nodo y sus aristas conectadas se remueven o actualizan mediante transiciones suaves animadas
- [ ] 2.3 Test del criterio 3: el evento SSE se suprime o se marca como redundante, evitando re-renders duplicados o parpadeos en el lienzo
