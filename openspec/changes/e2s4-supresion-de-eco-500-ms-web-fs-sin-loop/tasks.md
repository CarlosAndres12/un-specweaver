## 1. Implementacion

- [ ] 1.1 el watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor)
- [ ] 1.2 emite `FS_CHANGE` normalmente sin supresión
- [ ] 1.3 sí emite `FS_CHANGE` (ventana expirada, hash distinto)
- [ ] 1.4 `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor)
- [ ] 2.2 Test del criterio 2: emite `FS_CHANGE` normalmente sin supresión
- [ ] 2.3 Test del criterio 3: sí emite `FS_CHANGE` (ventana expirada, hash distinto)
- [ ] 2.4 Test del criterio 4: `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente
