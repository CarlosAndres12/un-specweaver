## Why

Entrega la Story 2.4 del Epic 2: Servidor reactivo y supresión de eco.

## What Changes

- Supresión de eco 500 ms (Web→FS sin loop).
- El watcher suprime la emisión `FS_CHANGE` (0 eventos hacia el emisor).
- Emite `FS_CHANGE` normalmente sin supresión.
- Sí emite `FS_CHANGE` (ventana expirada, hash distinto).
- `recentWrites` registra el último hash y la supresión aplica solo al hash coincidente.

## Capabilities

### New Capabilities

### Modified Capabilities

- `servidor-reactivo-y-supresion-de-eco`: agrega el requisito "Supresión de eco 500 ms (Web→FS sin loop)".

## Impact

- Origen: BMAD Story 2.4 — Epic 2: Servidor reactivo y supresión de eco
- Requisitos de esta story: FR-033, FR-025
- Capability: `servidor-reactivo-y-supresion-de-eco`
