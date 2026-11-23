# Verify visual — revision-visual (2026-11-23)

App real (`vite` :5173 + `uvicorn` :8000, base `foodstore` de desarrollo) en Edge headless con movimiento reducido, a 1440x900 y 390x844. Capturas en esta carpeta (`<pantalla>-desktop|mobile.png`, `*-scrolled-*` con la lista desplazada bajo el encabezado fijo). Comparadas contra `../previews/` (mockups aprobados) y design-system Revision 4.

## Chequeos automáticos (42 capturas)

- Consola: 0 errores, salvo los 401 esperados de `/auth/refresh` sin sesión.
- Red: 0 pedidos a hosts externos y 0 respuestas fallidas.
- Desborde horizontal a 390 px: 0 (después de los arreglos de abajo).
- Encabezado fijo: `data-stuck="true"` al desplazar en catálogo y gestión de pedidos (desktop y mobile).

## Corregido durante el verify (con test RED → GREEN)

| Prioridad | Pantalla | Problema | Arreglo |
|---|---|---|---|
| blocker | catálogo, admin categorías y productos | `GET /categorias/arbol` daba 500: el seed nuevo (4.4) dejaba `imagen_url = NULL` y `CategoriaRead` lo exige `str` | seed con `imagen_url = ""` (contrato de la API); `test_seed.py` nuevo; base de desarrollo alineada |
| major | catálogo 390 | desborde de 225 px: la grilla de `.band-inner` tomaba el ancho mínimo de la barra | `grid-template-columns: minmax(0, 1fr)`; test en `encabezado-pagina-css.test.ts` |
| major | catálogo 1440 | buscador de 420 px y píldoras de 40 px en negrita: «Postres» bajaba a otra línea | buscador `flex: 0 1 280px` y píldoras de 36 px, borde fino y peso medio como el chip del mockup; `catalogo-banda-css.test.ts` |

## Segunda ronda (cerradas antes de archivar, con test RED → GREEN)

| Prioridad | Pantalla | Viewport | Arreglo |
|---|---|---|---|
| major | producto-detalle | ambos | ruta «Catálogo / categoría / producto»; categoría como texto; compra sin caja; alérgenos entre divisores; ingredientes en dos columnas con divisores; `$` chico (`producto-detalle-visual.test.tsx`, `producto-detalle-css.test.ts`) |
| major | gestion-pedidos | ambos | control segmentado de estado + rango en una fila; línea de conteo con el rango; columnas Pedido/Estado/Cliente/…; filas compactas; acción con botón neutro (`gestion-pedidos-filtros`, `-visual`, `gestion-pedidos-css`) |
| major | gestion-pedidos | 390 | «Actualizar» solo con ícono y sin la hora (`MarcaActualizacion`, compartido); los filtros ya no se ocultan al desplazar; chip «Fechas» con contador que abre una hoja con el rango (`gestion-pedidos-encabezado`, `marca-actualizacion-css`) — capturas `gestion-pedidos-scrolled-mobile.png` y `gestion-pedidos-fechas-mobile.png` |

## Diferencias minor abiertas (no bloquean el archivo)

| Pantalla | Diferencia |
|---|---|
| catálogo (tarjeta) | `$ 1.500` sin `$` chico; botón «Agregar» con «+» |
| shell | rol como código crudo («CLIENT», «ADMIN») en el pie del panel |
| gestion-pedidos (tarjeta mobile) | sin las filas rotuladas Cliente / Forma de pago / Total; botón de acción a todo el ancho |
| producto-detalle | «Alérgeno» de la personalización con texto además del ícono; categorías secundarias como texto, no enlaces |

## No revisadas

Carrito con productos y finalizar compra, pago y pedido creado con datos reales (el contexto nuevo tiene el carrito vacío), diálogos (cancelar pedido, confirmar pago, eliminar categoría, desactivar usuario), formularios admin, estados de carga, vacío y error, y panel colapsado. Las capturas de mis pedidos, mi pedido, direcciones, mi cuenta, categorías, ingredientes, productos, usuarios y dashboard se tomaron (sin desborde ni errores), pero no se compararon una por una con su mockup.
