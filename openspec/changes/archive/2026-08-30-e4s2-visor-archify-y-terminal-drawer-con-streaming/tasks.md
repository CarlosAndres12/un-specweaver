## 1. Implementacion

- [x] 1.1 el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping)
- [x] 1.2 se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos
- [x] 1.3 hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver
- [x] 1.4 el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`

## 2. Verificacion

- [x] 2.1 Test del criterio 1: el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping)
- [x] 2.2 Test del criterio 2: se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos
- [x] 2.3 Test del criterio 3: hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver
- [x] 2.4 Test del criterio 4: el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`
