# Tasks — Filtros del catálogo arriba

> Aceptación visual: mockups aprobados en `mockups/` (`catalogo-escritorio.html`, `catalogo-mobile.html`) y sus capturas en `mockups/previews/`. No arrancar sin `Approval: approved` en `design.md`.
> Strict TDD: red → green → refactor por tarea; red de seguridad = `npm test -- src/pages/catalogo` antes de tocar nada.

## 1. Tests primero

- [x] 1.1 Correr la suite del catálogo y registrar la línea base.
- [x] 1.2 En `catalogo-filtros.test.tsx`: pasar los tests de categorías de la `navigation «Categorías»` a los chips de raíz y la segunda fila; agregar «sin `complementary` Filtros a 1440 px», «Veganas desde la segunda fila» y «Todas de la segunda fila vuelve a la raíz» (rojo).
- [x] 1.3 Tests de precio: abrir «Precio» antes de tipear; agregar cierre con Escape, foco de vuelta en «Precio», panel abierto ante rango inválido y resumen del rango en el botón (rojo).
- [x] 1.4 Árbol con 503 en escritorio: aviso «No pudimos cargar las categorías» + «Reintentar» en la barra.

## 2. Implementación

- [x] 2.1 `BarraMobile` → `BarraCategorias` (chips de raíz comunes; variante mobile con «Filtros»).
- [x] 2.2 Fila de subcategorías en escritorio.
- [x] 2.3 `PopoverPrecio` reutilizando `FormularioPrecio` (foco, Escape, clic afuera, resumen).
- [x] 2.4 `FiltroStock` en la barra (variante compacta).
- [x] 2.5 `CatalogoPage`: quitar el `aside` y `.cat-layout` de dos columnas; CSS de la barra en `catalogo.css` con tokens.

## 3. Cierre

- [x] 3.1 `npm test`, `npm run typecheck`, `npm run lint` desde `frontend/` en verde (incluye axe del catálogo).
- [x] 3.2 Verificación visual contra los mockups a 1440x900 y 390x844 (capturas en `mockups/verify/`).
