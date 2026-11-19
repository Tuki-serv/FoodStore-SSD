# Tasks — C-17b `fe-admin-productos-stock`

> **Governance MEDIO**: implementar con checkpoints y reportar decisiones no obvias. Gate: los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) antes de escribir código. OQ-1..OQ-3 no bloquean: sin respuesta se aplica el valor por defecto.
> **Criterios de aceptación visual**: `mockups/productos.html`, `producto-form.html`, `producto-eliminar.html`, `ingredientes-unidad.html` y sus capturas en `mockups/previews/` (ver `mockups/README.md`).
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, ejecutando la suite después de cada paso. **Backend**: pytest contra PostgreSQL real (`backend/tests/.env.test`, base `foodstore_test`), sin mocks de la base; comandos desde `backend/`. **Frontend**: red simulada **solo** con MSW (`server.use` por test, `onUnhandledRequest: 'error'`), nunca `vi.mock` de módulos propios; `getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()`; QueryClient nuevo por test sin reintentos; valores esperados literales, sin snapshots ni aserciones tautológicas; comandos desde `frontend/`.
> **Hard rules**: capas backend `models ← repository ← unit of work ← services ← routers` (nada de Session ni lógica en routers; sin CRUD duplicado); esquema sin cambios → **sin migración** (si apareciera un cambio de esquema: Alembic obligatorio y frenar a consultar); FSD con imports hacia abajo (`fsd-boundaries` en cero); TS `strict` sin `any`; datos del servidor en TanStack Query; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build`, `uvicorn` ni servidores (regla 13); no commitear.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` (productos: vista ADMIN, vista STOCK, carga, vacío filtrado, error, stock guardado/error en fila, interruptor guardando; formulario: alta con errores, edición con categorías e ingredientes, nombre repetido; baja; ingredientes con unidad y edición con unidad preelegida) reutilizando `mockup.css`/`mockup.js`/`admin.js` de C-17a, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los HTML abren desde `file://`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/` (más resúmenes en `previews/resumen/`), inspeccionar y registrar `Preview: rendered` en `design.md`. Verificación: PNG presentes.
- [x] 0.3 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`, junto con las respuestas (o «por defecto») a OQ-1..OQ-3.

## 1. Red de seguridad

- [x] 1.1 Safety net backend: `pytest tests/integration/test_ingrediente.py tests/integration/test_producto.py tests/integration/test_producto_ingredientes.py tests/integration/test_producto_inventario.py tests/integration/test_catalogo_visibilidad.py`; anotar aquí la línea base. **Línea base (2026-11-18, checkout principal `dev`): 68 tests verdes en esos 5 archivos y 1683 verdes en el `pytest` completo (7m12s).** Si algo falla, frenar y reportar como falla previa.
- [x] 1.2 Safety net frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar aquí la línea base (archivos/tests verdes). **Línea base: 78 archivos / 685 tests verdes, typecheck y lint limpios.**

## 2. Backend — unidad del ingrediente (spec `ingredient-measure-unit`; design D9)

- [x] 2.1 RED: `backend/tests/integration/test_ingrediente_unidad.py`: crear un ingrediente con la unidad «g» y `GET /api/v1/ingredientes/` → el elemento trae `unidad_medida_id` igual al id de «g». Ejecutar → falla.
- [x] 2.2 GREEN + TRIANGULATE: `unidad_medida_id` en `IngredienteRead` y en `_to_read_full`; casos: `GET /ingredientes/{id}`, respuesta del `POST` y del `PATCH` lo incluyen. Ejecutar → verde.
- [x] 2.3 RED → GREEN + TRIANGULATE: `PATCH` con `{"unidad_medida_id": <g>}` sobre un ingrediente en «u» → 200 con la nueva unidad y `nombre`/`es_alergeno` sin cambios; `unidad_medida_id` 999999 en alta y en edición → 404 sin guardar (antes 500); `STOCK` → 403. Implementar `IngredienteUpdate.unidad_medida_id`, `_validar_unidad` en el service y el repo de unidades en `IngredienteUnitOfWork`. Ejecutar → verde; `test_ingrediente.py` sigue verde.

## 3. Backend — productos con ingredientes (spec `product-ingredients`; design D8; bug C-11)

- [x] 3.1 RED: `backend/tests/integration/test_producto_alta_con_ingredientes.py`: `POST /productos/` con dos ingredientes (`cantidad` 1 y 2, unidad «u», `es_removible` false/true) → 201 y `ingredientes` con esos valores. Ejecutar → falla con 500.
- [x] 3.2 GREEN: helper privado `_vincular_ingrediente` en `ProductoService` (valida ingrediente activo y unidad → 404; crea o actualiza el link con los cuatro valores), usado por `create`. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: `PUT` con `ingredientes` reemplaza la lista (`GET /{id}/ingredientes` solo trae la nueva); `PUT` sin `ingredientes` no los toca; unidad 999999 → 404 y el producto no se crea (contar productos antes/después); ingrediente eliminado → 404. Reutilizar el helper en `update` y en `asociar_ingrediente` (sin copias). Ejecutar → verde; `test_producto_ingredientes.py` y `test_producto.py` siguen verdes.
- [x] 3.4 RED → GREEN + TRIANGULATE repetidos: `ingredientes` con el mismo `ingrediente_id` dos veces → 422; `categoria_ids` `[1,1]` en `PUT` → 422 y las categorías no cambian; `cantidad` 0 → 422. Validadores en `ProductoCreate`/`ProductoUpdate`; extraer `_vincular_categorias` (alta y edición) y validar `unidad_venta_id` también en el alta. Ejecutar → verde.
- [x] 3.5 REFACTOR backend con la suite verde tras cada paso; `pytest` completo del backend verde. Actualizar `knowledge-base/09` (bug C-11 resuelto) y la nota de C-17b en `CHANGES.md`. Verificación: diff revisado.

## 4. Frontend — seguimiento de ingredientes (spec «Listado de ingredientes», «Alta y edición de ingrediente»; design D10; mockup `ingredientes-unidad.html`)

- [x] 4.1 RED: en `src/pages/admin-ingredientes/__tests__/`: editar «Maní» (MSW con `unidad_medida_id` de «g») → el selector muestra «Gramo (g)» elegido y no existe la opción «Sin cambios». Ejecutar → falla.
- [x] 4.2 GREEN + TRIANGULATE: `Ingrediente.unidad_medida_id: number` obligatorio, sin rama `''` en `valoresInicialesIngrediente` ni opción «Sin cambios»; casos: cambiar a «Kilogramo (kg)» envía `PATCH` solo con `unidad_medida_id`; la fila muestra «Unidad (u)» en «Pan Brioche». Ejecutar → verde; los tests de C-17a siguen verdes.

## 5. Frontend — API de gestión de productos (specs «Listado…», «Stock…», «Disponibilidad…», «Alta y edición…», «Baja…»; design D1, D2)

- [x] 5.1 `src/test/msw/admin-productos.ts` (design D11): 6 productos del seed, filtros `q`/`categoria_ids`/`disponible`/`page`, POST/PUT/DELETE/PATCH stock/disponibilidad con estado en memoria y registro de cuerpos; variantes 409/404/422/red/demora. Cubierto por los tests de 5.2–10.
- [x] 5.2 RED: `src/entities/producto/__tests__/producto-gestion.test.tsx`: `productoGestionQueries.lista({page:1,size:20,disponible:false})` pide `page=1&size=20&disponible=false` (sin forzar `true`) y su clave empieza por `productos-gestion`. Ejecutar → falla.
- [x] 5.3 GREEN + TRIANGULATE: `listarProductosGestion`, `obtenerProductoGestion`, `productoGestionQueries`; casos: `disponible` ausente omite el parámetro; `categoriaId` → `categoria_ids`; la consulta se descarta al cerrar sesión (`esConsultaPrivada`). Ejecutar → verde.
- [x] 5.4 RED → GREEN + TRIANGULATE mutaciones (`producto-mutations.ts`): `useFijarStock` envía `{"stock_cantidad":12}` y escribe la respuesta en la lista cacheada; `useFijarDisponibilidad` envía `{"disponible":false}`; `useCrearProducto`/`useEditarProducto`/`useEliminarProducto` envían el cuerpo exacto; todas invalidan `['productos-gestion']` y `['productos']`. Ejecutar → verde.

## 6. Frontend — modelo de la página (spec «Acceso…», «Alta y edición…», «Categorías…», «Ingredientes…»; design D3, D6, D7)

- [x] 6.1 RED: `src/pages/admin-productos/__tests__/permisos.test.ts`: `accionesProductos(['STOCK'])` → `{gestionar:false, inventario:true}`. Ejecutar → falla.
- [x] 6.2 GREEN + TRIANGULATE: casos `['ADMIN','STOCK']`, `['ADMIN']`, `['CLIENT']`. Ejecutar → verde.
- [x] 6.3 RED → GREEN + TRIANGULATE `model/validacion.ts`: `validarStock('-1')` → «Ingresá un número entero desde 0.», `'2.5'` y `''` también, `'0'` válido; `validarProducto`: nombre vacío/151 caracteres, precio `-5`/`12,345` → «Ingresá un precio desde 0 con hasta 2 decimales.», `1.500,5` no / `1500,5` → `"1500.50"`, sin categorías → «Elegí al menos una categoría.», ingrediente repetido → error en la segunda fila, cantidad 0 → error. Ejecutar → verde.
- [x] 6.4 RED → GREEN + TRIANGULATE `aCuerpoProducto` / `cambiosProducto`: principal primero en `categoria_ids`; edición solo con `precio_base` si solo cambió el precio; `ingredientes` completo si cambió una cantidad o `es_removible`; `{}` sin cambios; filtros de URL (`?q=&categoria=&disponible=si|no&page=`) ida y vuelta. Ejecutar → verde.

## 7. Página Productos y stock — listado y permisos (spec «Acceso…», «Listado…»; mockup `productos.html`)

- [x] 7.1 RED: `src/pages/admin-productos/__tests__/admin-productos-page.test.tsx`: con sesión ADMIN, `/admin/productos` muestra «Productos y stock», «Hamburguesa Clásica» con «Hamburguesas» y «$ 1.500», y «Nuevo producto». Ejecutar → falla.
- [x] 7.2 GREEN: `pages/admin-productos` (`ui/`, `index.ts`), entrada en el mapa de páginas de `app/router/routes.tsx`, CSS importado antes de cualquier regla. Ejecutar → verde.
- [x] 7.3 TRIANGULATE: STOCK ve stock e interruptor pero no «Nuevo producto», «Editar» ni «Eliminar»; ADMIN+STOCK ve todo; CLIENT → 403 sin pedidos de escritura; «Limonada Natural» no disponible con «Agotado»; filtro «No disponibles» → `disponible=false&page=1` y URL; abrir con `?q=burger&page=2` respeta ambos; búsqueda sin resultados → «No encontramos productos con esos filtros» + «Limpiar filtros»; carga (`aria-busy`), error + «Reintentar»; axe. Ejecutar → verde. Comparar con `mockups/productos.html` (`?rol=stock`, `?estado=carga|vacio|error`).

## 8. Stock y disponibilidad en la fila (spec «Stock…», «Disponibilidad…»; mockup `productos.html?estado=stock`)

- [x] 8.1 RED: STOCK escribe 12 en «Stock de Burger Vegana» y pulsa «Guardar stock de Burger Vegana» → cuerpo `{"stock_cantidad":12}`, la fila muestra 12, «Stock actualizado», el interruptor sin cambios. Ejecutar → falla.
- [x] 8.2 GREEN + TRIANGULATE: `-1` → error en la fila sin pedido; botón deshabilitado si no cambió; Enter guarda; 404 → error en la fila con el valor conservado; interruptor de «Coca-Cola 500ml» → `{"disponible":false}`, deshabilitado mientras espera («Guardando…»), apagado y aviso; red caída → vuelve al valor anterior y aviso de error; axe. Ejecutar → verde.

## 9. Formulario de producto (spec «Alta y edición…», «Categorías…», «Ingredientes…»; mockup `producto-form.html`)

- [x] 9.1 RED: ADMIN pulsa «Nuevo producto», completa «Burger Doble», precio «2500», stock 10, marca «Hamburguesas», agrega «Tomate» (cantidad 2, «Se puede quitar») y guarda → un solo `POST /productos/` con el cuerpo exacto (decimales como string), «Producto creado» y la fila nueva. Ejecutar → falla.
- [x] 9.2 GREEN: `FormularioProducto` (TanStack Form), sección de categorías (casillas en orden de árbol + principal), sección de ingredientes (agregar/quitar filas, unidad propuesta del ingrediente, marca de alérgeno), foco en el título. Ejecutar → verde.
- [x] 9.3 TRIANGULATE: errores de validación sin pedido (nombre, precio, sin categorías, ingrediente repetido); principal «Veganas» va primero; edición de «Burger Vegana» carga sus datos e ingredientes y al cambiar solo el precio envía `PUT` solo con `precio_base`; editar sin cambios vuelve sin pedir; la edición no muestra stock ni «Disponible»; 409 → error en «Nombre» con lo escrito; 404/422 → alerta general; red caída → alerta general; «Cancelar» sin pedido; STOCK no puede abrir el formulario; axe. Ejecutar → verde. Comparar con `producto-form.html` (`?modo=editar|duplicado`).

## 10. Baja de producto (spec «Baja de producto»; mockup `producto-eliminar.html`)

- [x] 10.1 RED → GREEN + TRIANGULATE: «Eliminar Limonada Natural» → diálogo «¿Eliminar «Limonada Natural»?»; confirmar → 204, «Producto eliminado», la fila desaparece; red caída → error dentro del diálogo y la fila sigue; «Eliminando…» deshabilitado durante el pedido; foco vuelve al botón al cerrar; axe. Reusar `shared/ui/dialogo-baja`. Ejecutar → verde.

## 11. Cierre

- [x] 11.1 REFACTOR general (SOLID/DRY: sin lógica duplicada con `pages/admin-ingredientes`/`admin-categorias`; si la fila con acciones o el selector de categorías se repiten tal cual, extraer a `shared/ui` o `entities/categoria`) con la suite verde tras cada paso; `npm test`, `npm run typecheck`, `npm run lint` limpios; `fsd-boundaries` en cero; `pytest` completo verde.
- [x] 11.2 Docs: `knowledge-base/06` (US-010, US-012 y la parte de US-011 sobre la asociación), `knowledge-base/08` (árbol FSD), `frontend/README.md`, `CHANGES.md` («Punto de partida (C-17b)» en C-18: `es_removible` editable, claves `productos-gestion`). Verificación: diffs revisados.
- [x] 11.3 Verify visual contra los mockups aprobados (1440x900 y 390x844; capturas en `mockups/verify/`) y registrar `Visual verify` en `design.md`.

## Workflow follow-up

- `/opsx:archive c-17b-fe-admin-productos-stock` y marcar `[x]` en `CHANGES.md`.
