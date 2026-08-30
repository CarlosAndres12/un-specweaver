## 1. Implementacion

- [x] 1.1 0 eventos `FS_CHANGE` emitidos
- [x] 1.2 emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`
- [x] 1.3 se emite exactamente 1 evento `FS_CHANGE` coalescado
- [x] 1.4 solo A emite `FS_CHANGE` con `projectId: A`; B no emite

## 2. Verificacion

- [x] 2.1 Test del criterio 1: 0 eventos `FS_CHANGE` emitidos
- [x] 2.2 Test del criterio 2: emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`
- [x] 2.3 Test del criterio 3: se emite exactamente 1 evento `FS_CHANGE` coalescado
- [x] 2.4 Test del criterio 4: solo A emite `FS_CHANGE` con `projectId: A`; B no emite
