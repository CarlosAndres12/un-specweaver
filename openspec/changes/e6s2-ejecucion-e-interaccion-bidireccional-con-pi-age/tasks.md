## 1. Implementacion

- [ ] 1.1 Xterm.js renderiza los estilos con fidelidad completa sin romper texto plano ni códigos crudos
- [ ] 1.2 los bytes se transmiten a través del endpoint `POST /api/projects/:id/commands/:execId/input` hacia el flujo `stdin` del subproceso `child_process`

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: Xterm.js renderiza los estilos con fidelidad completa sin romper texto plano ni códigos crudos
- [ ] 2.2 Test del criterio 2: los bytes se transmiten a través del endpoint `POST /api/projects/:id/commands/:execId/input` hacia el flujo `stdin` del subproceso `child_process`
