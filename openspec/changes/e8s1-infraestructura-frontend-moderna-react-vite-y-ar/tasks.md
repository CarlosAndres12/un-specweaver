## 1. Implementacion

- [ ] 1.1 Vite compila la aplicación React hacia `src/dashboard/public/` generando bundles optimizados con hashing de assets y ESM nativo
- [ ] 1.2 `server.mjs` sirve la SPA React con fallback adecuado a `index.html` para rutas del cliente, manteniendo tiempos de carga inicial (LCP) inferiores a 500 ms
- [ ] 1.3 la aplicación adapta todos los tokens CSS y componentes de forma inmediata utilizando variables de diseño centralizadas sin parpadeos (FOUC)
- [ ] 1.4 las transiciones utilizan la View Transitions API (`same-document-transitions`) de forma fluida con degradación elegante en navegadores no compatibles

## 2. Verificacion

- [ ] 2.1 Test del criterio 1: Vite compila la aplicación React hacia `src/dashboard/public/` generando bundles optimizados con hashing de assets y ESM nativo
- [ ] 2.2 Test del criterio 2: `server.mjs` sirve la SPA React con fallback adecuado a `index.html` para rutas del cliente, manteniendo tiempos de carga inicial (LCP) inferiores a 500 ms
- [ ] 2.3 Test del criterio 3: la aplicación adapta todos los tokens CSS y componentes de forma inmediata utilizando variables de diseño centralizadas sin parpadeos (FOUC)
- [ ] 2.4 Test del criterio 4: las transiciones utilizan la View Transitions API (`same-document-transitions`) de forma fluida con degradación elegante en navegadores no compatibles
