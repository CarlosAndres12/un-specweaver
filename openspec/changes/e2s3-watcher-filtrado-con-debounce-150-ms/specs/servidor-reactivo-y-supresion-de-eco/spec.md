## ADDED Requirements

### Requirement: Watcher filtrado con debounce 150 ms
The system SHALL support watcher filtrado con debounce 150 ms.

#### Scenario: Escribo en `/abs/repo-a/.git/index` o `/abs/repo-a/node_modules/foo/inde
- **GIVEN** un watcher activo para `proj-1`
- **WHEN** escribo en `/abs/repo-a/.git/index` o `/abs/repo-a/node_modules/foo/index.js` o `/abs/repo-a/dist/bundle.js`
- **THEN** 0 eventos `FS_CHANGE` emitidos

#### Scenario: El watcher observa
- **GIVEN** escribo en `/abs/repo-a/epics.md` y `/abs/repo-a/.spec/changes/foo/spec.md`
- **WHEN** el watcher observa
- **THEN** emite `FS_CHANGE` con `{ projectId, file: "epics.md"|".spec/...", timestamp }`

#### Scenario: Pasa debounce 150 ms
- **GIVEN** ráfaga de 10 writes a `epics.md` en 50 ms
- **WHEN** pasa debounce 150 ms
- **THEN** se emite exactamente 1 evento `FS_CHANGE` coalescado

#### Scenario: Escribo `epics.md` en A
- **GIVEN** dos proyectos A y B con watchers independientes
- **WHEN** escribo `epics.md` en A
- **THEN** solo A emite `FS_CHANGE` con `projectId: A`; B no emite
