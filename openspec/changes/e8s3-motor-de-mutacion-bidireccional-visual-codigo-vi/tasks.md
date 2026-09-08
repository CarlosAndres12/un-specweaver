## 1. Implementacion

- [ ] 1.1 el cliente envía `POST /api/projects/:id/graph/edges` con `{ source: "A", target: "B", type: "dependsOn" }`
- [ ] 1.2 localiza la sección de dependencias en `epics.md` / `sprint.json`, actualiza la regla de precedencia, persiste atómicamente el archivo en disco e incluye el token de supresión de eco para evitar rebote de eventos hacia el cliente emisor
- [ ] 1.3 se despacha `PATCH /api/projects/:id/stories/:storyId`, actualizando el bloque correspondiente en `epics.md` preservando comentarios, formato e indentación intactos
- [ ] 1.4 el canvas valida el ciclo localmente, rechaza la conexión, resalta temporalmente en rojo y muestra un mensaje de advertencia accesible sin alterar los archivos

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el cliente envía `POST /api/projects/:id/graph/edges` con `{ source: "A", target: "B", type: "dependsOn" }`
- [ ] 2.2 Test del criterio 2: localiza la sección de dependencias en `epics.md` / `sprint.json`, actualiza la regla de precedencia, persiste atómicamente el archivo en disco e incluye el token de supresión de eco para evitar rebote de eventos hacia el cliente emisor
- [ ] 2.3 Test del criterio 3: se despacha `PATCH /api/projects/:id/stories/:storyId`, actualizando el bloque correspondiente en `epics.md` preservando comentarios, formato e indentación intactos
- [ ] 2.4 Test del criterio 4: el canvas valida el ciclo localmente, rechaza la conexión, resalta temporalmente en rojo y muestra un mensaje de advertencia accesible sin alterar los archivos
