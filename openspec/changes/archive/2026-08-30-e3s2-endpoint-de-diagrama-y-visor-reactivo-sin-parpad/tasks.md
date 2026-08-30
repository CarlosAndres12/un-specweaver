## 1. Implementacion

- [x] 1.1 retorna `200` con `Content-Type: text/html` (o `image/svg+xml` si es SVG puro) y markup encapsulado (`iframe srcdoc` o `div.archify-container` con CSS prefijado `.archify-*`)
- [x] 1.2 el visor Archify re-fetchea `GET /diagram` y actualiza sin parpadeo (transición o diff), preservando scroll
- [x] 1.3 retorna `200` con placeholder textual y header `X-Archify-Degraded: true`

## 2. Verificacion

- [x] 2.1 Test del criterio 1: retorna `200` con `Content-Type: text/html` (o `image/svg+xml` si es SVG puro) y markup encapsulado (`iframe srcdoc` o `div.archify-container` con CSS prefijado `.archify-*`)
- [x] 2.2 Test del criterio 2: el visor Archify re-fetchea `GET /diagram` y actualiza sin parpadeo (transición o diff), preservando scroll
- [x] 2.3 Test del criterio 3: retorna `200` con placeholder textual y header `X-Archify-Degraded: true`
