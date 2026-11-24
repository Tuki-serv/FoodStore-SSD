# Informe de verify visual — C-25b (tarea 3.2)

- Fecha: 2026-11-23
- Design system: Revision 4 (`design-system/README.md`, aprobada 2026-11-23). La tarea 3.2 y la fila `Design system revision` de `design.md` decían Revision 3; `c-25b0 revision-visual` la subió a 4 antes de este verify, así que se usó la vigente y se deja anotada la diferencia.
- Mockups de referencia: `openspec/changes/archive/2026-11-23-revision-visual/mockups/` (re-render a Revision 4 de todas las pantallas; reemplaza a los mockups de los changes anteriores en las pantallas que cubre). Se renderizaron desde una copia con las rutas `../../../../design-system/` resueltas (al archivar el change quedaron un nivel más abajo y los `<link>` relativos ya no apuntan a `design-system/`).
- Aplicación: stack local (frontend `http://localhost:5173`, API `http://localhost:8000`), Edge headless + `playwright-core`. Capturas ya tomadas en `docs/entrega/capturas/NN-<pantalla>-<1440x900|390x844>.png` (no se duplican acá).
- Alcance: 17 pantallas x 2 viewports (34 pares mockup/captura) comparados a ojo, más barrido programático a 390x844 y 375x667 (desborde horizontal, elementos cortados, intercepción de clics con `elementFromPoint`) sobre 19 rutas.

## Resultado

| Prioridad | Cantidad |
|---|---|
| Blocker | 0 |
| Major | 1 |
| Minor | 12 |

`Visual verify: differences`. El major (V-01) impide subir la cantidad desde el carrito en mobile; conviene corregirlo antes de la entrega.

## Diferencias

| ID | Prio | Pantalla | Viewport | Esperado (mockup) | Observado | Reproducción | Causa probable |
|---|---|---|---|---|---|---|---|
| V-01 | major | `/carrito` | 390x844 y 375x667 | Selector de cantidad `- 2 +` operable (`carrito.html`) | El botón «Sumar una unidad de …» queda tapado por `span.price` (`elementFromPoint` en su centro devuelve `SPAN.price`); el cliente no puede aumentar la cantidad desde el carrito en mobile. «Restar» y «Quitar» funcionan | Ingresar como cliente, agregar 2 productos al carrito, abrir `/carrito` a 390 px, hacer clic en «+» | `frontend/src/pages/carrito/ui/carrito.css` línea 35 (`@media` mobile): la grilla es `64px minmax(0,1fr) auto` con áreas `"thumb meta meta" "qty sub remove"`; `.qty` cae en la columna de 64 px, el selector (~120 px) la desborda y se superpone a `.sub .price`. Evidencia: `verify/03-carrito/live-390x844-con-item.png`, `live-390x844-2-items.png` |
| V-02 | minor | `/admin/productos` | 390x844 y 375x667 | Campo de stock + «Guardar» dentro de la tarjeta (`productos.html`) | El botón «Guardar stock de …» se corta en el borde derecho de la tarjeta (rect x 292–406 con tarjeta hasta 374/359 px), recortado por `overflow:clip` | Ingresar como admin, abrir `/admin/productos` a 390 px | `frontend/src/pages/admin-productos/ui/admin-productos.css`: `.plist{overflow:clip}` y `.stock-edit .input-sm{flex:1;width:auto}` (el input no se achica por su ancho mínimo). Evidencia: `verify/12-admin-productos/live-scroll-375x667.png`, captura `12-admin-productos-390x844.png` |
| V-03 | minor | Gestión de pedido (detalle) `/gestion-pedidos/:id` | 390x844 | Ícono «Actualizar» alineado con el título (`gestion-pedido-detalle.html`) | El ícono de refrescar flota suelto a la derecha del título «Pedido #N», que se parte en dos líneas | Ingresar como pedidos, abrir un pedido a 390 px | `.od-head .refresh` en `frontend/src/pages/gestion-pedidos/ui/gestion-pedidos.css` (≈ línea 144) y `shared/ui/marca-actualizacion` |
| V-04 | minor | Todas con panel lateral | 1440x900 | Ítem activo con fondo suave, sin barra (`mockup.js`) | El ítem activo suma una barra de acento a la izquierda | Cualquier pantalla con sesión | Estilos de `app/layouts/app-shell` |
| V-05 | minor | `/ingresar` | 1440x900 | Dos columnas: isotipo + título a la izquierda, tarjeta de formulario a la derecha (`ingresar.html`) | Tarjeta única centrada, sin isotipo ni columna de encabezado | Abrir `/ingresar` anónimo | `pages/ingresar` |
| V-06 | minor | `/ruta-inexistente` (404) | 1440x900 | «404» grande alineado a la izquierda, sin tarjeta (`not-found.html`) | Tarjeta centrada con ícono de brújula y «404» chico en terracota | Abrir una ruta inexistente | `pages/not-found` |
| V-07 | minor | `/direcciones` | 1440x900 | Cuadrícula de tarjetas con chip «Principal» (`direcciones-lista.html`) | Lista en filas; la principal con borde verde a la izquierda; «Marcar como principal» como botón con borde | Ingresar como cliente, abrir `/direcciones` | `pages/direcciones` |
| V-08 | minor | `/mis-pedidos` | 1440x900 | Filtro de estado como segmentos; una sola marca de estado por fila (decisión D3 de Revision 4) (`mis-pedidos.html`) | Filtro «Estado» como `select`; los pedidos activos llevan un segundo chip «En curso» junto al chip de estado | Ingresar como cliente, abrir `/mis-pedidos` | `pages/mis-pedidos` (chip «En curso» y control de filtro) |
| V-09 | minor | `/admin/dashboard` | 1440x900 | «Ventas por período» en barras; período con segmentos (`dashboard.html`) | Gráfico de área/línea, más campos «Desde/Hasta» y controles apilados con etiquetas | Ingresar como admin, abrir `/admin/dashboard` | `pages/admin-dashboard` |
| V-10 | minor | `/carrito` | 1440x900 y 390x844 | Encabezado con «TU COMPRA»; resumen con Unidades, Subtotal, Costo de envío y Total (`carrito.html`) | Sin sobretítulo; el resumen muestra Unidades y Total y una nota sobre el envío de $ 50 | Abrir `/carrito` con ítems | `pages/carrito` |
| V-11 | minor | `/finalizar-compra` | 1440x900 y 390x844 | Secciones «¿Dónde lo recibís?» / «¿Cómo pagás?» con pasos numerados y formas de pago en lista (`finalizar-compra.html`) | Secciones tituladas «Entrega» / «Forma de pago»; las tres formas de pago en una fila de tarjetas a 1440 px | Abrir `/finalizar-compra` con ítems | `pages/finalizar-compra` |
| V-12 | minor | `/gestion-pedidos/:id` | 1440x900 | Panel «Próximo paso» sobre el historial; «Cancelar pedido» secundario blanco (`gestion-pedido-detalle.html`) | Sin panel «Próximo paso»; «Cancelar pedido» con borde y texto rojos, a la derecha de «Confirmar pago» | Abrir un pedido pendiente como pedidos | `pages/gestion-pedidos` |
| V-13 | minor | `/catalogo`, `/catalogo/:id` | 390x844 | Tarjeta con botón «+» redondo (`catalogo-mobile`); botón «Agregar al carrito · $ N» (`producto-detalle.html`) | Botón «Agregar» de ancho completo en las tarjetas; en el detalle el botón no muestra el precio y su texto se parte en dos líneas | Abrir el catálogo y un producto a 390 px | `entities/producto/ui`, `pages/producto` |

Notas sobre las comparaciones:

- V-04 a V-13 son divergencias de apariencia contra los mockups de Revision 4 que no estaban acordadas por escrito; el usuario decide si se corrige la aplicación o se actualiza el mockup (algunas, como el panel «Próximo paso» o las fechas del gestor, dependen de los datos de ejemplo).
- Diferencias solo de contenido (usuarios, pedidos y montos del seed local) y los toasts de las capturas (pedido creado, en camino, entregado) no cuentan como diferencias.
- Sin diferencias propias más allá de las listadas: catálogo con filtros y detalle de producto a 1440x900, pedido creado, lista de gestión de pedidos, detalle de «Mi pedido» (seguimiento e historial), productos, usuarios y categorías a 1440x900.

## Barrido programático (390x844 y 375x667)

Rutas revisadas: `/catalogo` (anónimo y cliente), `/catalogo/:id`, `/ingresar`, `/registrarse`, 404, `/carrito` (con 2 ítems), `/finalizar-compra`, `/finalizar-compra/pedido/:id`, `/mis-pedidos`, `/mis-pedidos/:id`, `/direcciones`, `/mi-cuenta`, `/gestion-pedidos`, `/gestion-pedidos/:id` (entregado y pendiente), `/admin/dashboard`, `/admin/productos`, `/admin/usuarios`, `/admin/categorias`, `/admin/ingredientes`.

- Desborde horizontal de la página: ninguno en ninguna ruta.
- Elementos cortados: solo los botones «Guardar stock» de `/admin/productos` (V-02).
- Intercepción de clics: solo «Sumar una unidad» del carrito (V-01). En una primera pasada aparecieron falsos positivos en `/admin/productos` y `/admin/dashboard` por el encabezado fijo que se colapsa al desplazar (`page-band is-sticky`); al esperar a que termine de colapsar desaparecen, y la inspección visual con scroll real (`verify/12-admin-productos/live-scroll-375x667.png`, `verify/11-dashboard/live-scroll-375x667.png`) no muestra elementos tapados.
- Los enlaces de la tabla de estados del dashboard (`a.tlink`) figuran «fuera de pantalla» porque están en un bloque solo para lector de pantalla (`sr-only`), a propósito; no es defecto.

## Consola y red

- Sesión anónima: `401` en `POST /api/v1/auth/refresh` y el `console.error` «Failed to load resource» asociado, en cada carga de página. Esperado (no hay cookie de refresh).
- Sesiones de cliente, pedidos y admin: sin errores ni advertencias de consola y sin pedidos de red fallidos (≥ 400) en las rutas recorridas.

## Pantallas revisadas y no revisadas

Revisadas (mockup contra captura, 1440x900 y 390x844): 01 catálogo, 02 producto, 03 carrito, 04 finalizar compra, 05 pedido creado, 06 gestión de pedidos, 07 gestión de pedido (detalle), 08 gestión de pedido entregado, 09 mis pedidos, 10 mi pedido (detalle), 11 dashboard, 12 productos y stock, 13 usuarios, 14 categorías, 15 ingresar, 16 página no encontrada, 17 direcciones. Renders de los mockups en `verify/NN-<pantalla>/mockup-<viewport>.png`.

Revisadas solo con el barrido programático (sin comparación contra mockup): `/registrarse`, `/mi-cuenta`, `/admin/ingredientes`.

No revisadas (sin captura ni recorrido en este verify): estados de carga, vacío y error del catálogo y del carrito; diálogos (vaciar carrito, cancelar pedido, confirmar pago, eliminar categoría, producto o usuario) y formularios modales (producto, categoría, usuario, dirección); pago con tarjeta `/finalizar-compra/pedido/:id/pago` (requiere credenciales sandbox de MercadoPago: tramo B del recorrido, a cargo del usuario); pantallas 403 y de carga de sesión; panel lateral colapsado y cajón mobile; viewports intermedios (tablet).

## Correcciones (2026-11-23)

Se corrigieron V-01, V-02 y V-03 (solo CSS). V-04..V-13 siguen pendientes de decisión del usuario (ajustar la app o actualizar el mockup; tarea 8.4).

| ID | Corrección | Antes / después |
|----|-----------|-----------------|
| V-01 | `carrito.css` (mobile): grilla `64px minmax(0,1fr) auto auto`, áreas `"thumb meta meta meta" "qty qty sub remove"`; el selector de cantidad ya no cae en la columna de 64 px ni queda bajo el subtotal | Antes: `elementFromPoint` en «Sumar» devolvía `SPAN.price` y el clic no cambiaba la cantidad (1 → 1). Después: el clic real sube la cantidad (1 → 2). Captura: `verify/fixes/carrito-390x844.png` |
| V-02 | `admin-productos.css`: `min-width:0` en `.stock-edit .input-sm` | Antes: botón en x 292–406 con la tarjeta hasta 373/358 px (recortado). Después: los 6 botones dentro de la tarjeta y del viewport. Captura: `verify/fixes/admin-productos-390x844.png` |
| V-03 | `encabezado-pagina.css` (≤1023 px): `.band-top:has(> .band-actions > .refresh + *)` en grilla de dos columnas, `.band-actions` con `display:contents`, ícono en la columna derecha de la fila del título y el resto de las acciones a todo el ancho | Antes: título en 2 líneas («Pedido / #N») e ícono flotando a mitad de fila (x 170–215). Después: título en 1 línea e ícono en el margen derecho (x 330–374 a 390 px). Capturas: `verify/fixes/gestion-pedido-detalle-390x844.png` (pendiente, con acciones) y `verify/fixes/mi-pedido-detalle-390x844.png` (mismo patrón) |

Comprobación automatizada (Edge headless + `playwright-core`, 390x844, 375x667 y 1440x900; script en el scratchpad de la sesión, no versionado): antes de la corrección falló en los tres puntos (10 aserciones en rojo: carrito tapado y sin cambio de cantidad, «Guardar stock» fuera de la tarjeta, título en 2 líneas e ícono desalineado, en 390 y 375); después, `RESULTADO: PASS` en los tres viewports, también con un pedido `PENDIENTE` (con botones «Confirmar pago» y «Cancelar pedido») y con uno `ENTREGADO`. A 1440x900 no hubo regresiones (los selectores de cantidad, el stock y el ícono de actualizar siguen alcanzables y sin solape).

Pruebas: `npx vitest run` de carrito, admin-productos, gestion-pedidos (17 archivos, 246 pruebas) pasaba antes y después (ampliado a shared/ui, mis-pedidos y admin-dashboard: 41 archivos, 437 pruebas); `npm run typecheck` y `npm run lint` sin errores.

Capturas de entrega reemplazadas (390x844): `docs/entrega/capturas/03-carrito-`, `07-gestion-pedido-detalle-` y `12-admin-productos-390x844.png`. La 07 ahora muestra el pedido #68 `PENDIENTE` (el #63 ya está `ENTREGADO`); para obtenerlo se creó el pedido #68 como cliente con `EFECTIVO` en el entorno local.

