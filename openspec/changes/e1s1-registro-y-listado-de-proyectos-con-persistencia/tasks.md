## 1. Implementacion

- [ ] 1.1 el servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto
- [ ] 1.2 retorna `409 DUPLICATE` con código tipado y no duplica entrada
- [ ] 1.3 retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack
- [ ] 1.4 retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`)
- [ ] 1.5 `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria)

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el servidor crea el directorio `~/.un-specweaver/` si falta, genera `id` UUID v4, deriva `name` de `basename(path)`, persiste atómicamente vía tmp+rename y retorna `201 { project }` con `path` canónico absoluto
- [ ] 2.2 Test del criterio 2: retorna `409 DUPLICATE` con código tipado y no duplica entrada
- [ ] 2.3 Test del criterio 3: retorna `400 INVALID_PATH` sin crear entrada y sin exponer stack
- [ ] 2.4 Test del criterio 4: retorna `200 { projects: [...], activeProjectId }` con cada proyecto incluyendo `specDir` detectado y salud (`exists: true`, `specExists: true/false`)
- [ ] 2.5 Test del criterio 5: `projects.json` final contiene los 5 sin corrupción (JSON válido, tmp+rename, lock en memoria)
