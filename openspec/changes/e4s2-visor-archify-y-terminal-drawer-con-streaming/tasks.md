## 1. Implementacion

- [ ] 1.1 el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping)
- [ ] 1.2 se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos
- [ ] 1.3 hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver
- [ ] 1.4 el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: el visor actualiza en <300 ms sin parpadeo, con sandbox (`iframe srcdoc` o CSS scoping)
- [ ] 2.2 Test del criterio 2: se abre terminal drawer colapsable; `Esc` lo cierra; `?` muestra ayuda de atajos
- [ ] 2.3 Test del criterio 3: hace `POST /api/projects/proj-1/commands { command: "doctor" }`, suscribe `GET /commands/:execId/stream` y muestra streaming con formato terminal y auto-scroll; el historial se preserva al conmutar y volver
- [ ] 2.4 Test del criterio 4: el drawer de `proj-1` conserva su historial sin cruzar con `proj-2`
