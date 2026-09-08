## 1. Implementacion

- [ ] 1.1 0 eventos `FS_CHANGE` emitidos
- [ ] 1.2 emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`
- [ ] 1.3 se emite exactamente 1 evento `FS_CHANGE` coalescado
- [ ] 1.4 solo A emite `FS_CHANGE` con `projectId: A`; B no emite

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: 0 eventos `FS_CHANGE` emitidos
- [ ] 2.2 Test del criterio 2: emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`
- [ ] 2.3 Test del criterio 3: se emite exactamente 1 evento `FS_CHANGE` coalescado
- [ ] 2.4 Test del criterio 4: solo A emite `FS_CHANGE` con `projectId: A`; B no emite
