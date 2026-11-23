# Mockups — `revision-visual` (C-25b0)

- Design system revision: 4 (`design-system/README.md`, aprobada 2026-11-23)
- Approval: approved (2026-11-23, by user)
- Preview: rendered (2026-11-23, re-render por D9, `previews/`, 115 capturas: 1440x900 y 390x844 con viewport real, más `catalogo-scrolled-*` y `gestion-pedidos-scrolled-*` con la lista desplazada bajo el encabezado fijo)
- Decisiones aplicadas: D2 superficies por rol, D3 badges solo de estado (stock = chip neutro con punto), D4 movimiento (presión, hover solo con puntero fino, entrada escalonada solo al primer montaje), D5 tarjeta de producto y respaldo tipográfico (OQ-1: solo respaldo, sin fotos), D6 logo de Revision 4 e isotipo `assets/favicon.svg` con el panel colapsado (OQ-2).

Los flujos, rutas, textos funcionales y estados son los de los mockups aprobados (columna «Base»); lo que cambia es la apariencia. No hay pantallas nuevas.

## Archivos de soporte

| Archivo | Qué es |
|---|---|
| `base.css` | Copia de las reglas de componentes de `design-system/components.html` (Revision 4), sin las muestras del catálogo. Si cambia `components.html`, se vuelve a copiar. |
| `pages.css` | Patrones de página (catálogo, producto, carrito, checkout, pedidos, tablas, formularios, dashboard, auth). Solo tokens de `tokens.css`. |
| `sprite.js` | Los 49 `<symbol>` de `components.html`, inyectados inline (file:// no permite `<use>` de un SVG externo). |
| `mockup.js` | Arma el panel lateral por rol alrededor del `<main>`, datos de ejemplo del seed, tarjeta de producto y respaldo tipográfico. |
| `render.mjs` | Script de captura (ver abajo). |

Rutas compartidas desde esta carpeta: `../../../../design-system/` (`tokens.css` con las `@font-face` locales, `brand.js`, `assets/logo.svg`, `assets/favicon.svg`). Al archivar el change, la profundidad pasa a `../../../../../`. Ningún mockup hace pedidos fuera de `file://` (lo verifica `render.mjs`).

## Pantallas

Base = `openspec/changes/archive/<fecha>-<change>/mockups/<archivo>`.

| Fila de `design.md` | Archivo | Estados (`?param`) | Base aprobada |
|---|---|---|---|
| Shell anónimo y admin, colapsado, drawer | `shell-anon.html`, `shell-admin.html` | `?nav=expanded \| collapsed \| drawer` (drawer solo < 1024 px) | C-13a `shell-anon`, `shell-admin` |
| 404, error, prohibido, carga de sesión | `not-found.html`, `error.html`, `forbidden.html`, `session-loading.html` | — | C-13a `not-found`, `error`; C-13b `forbidden`, `session-loading` |
| Catálogo | `catalogo.html` | con datos (escritorio y mobile) | C-16b `catalogo`; fe-catalogo-filtros-arriba `catalogo-mobile` |
| | `catalogo-categoria.html` | «Hamburguesas» + rango + stock, panel «Precio» abierto; categoría omitida en las tarjetas | fe-catalogo-filtros-arriba `catalogo-escritorio` |
| | `catalogo-filtros.html` | «Veganas» + rango inválido; mobile: hoja «Filtros» | C-16b `catalogo-filtros` |
| | `catalogo-carga.html`, `catalogo-vacio.html` | `?estado=sin-productos \| error` | C-16b `catalogo-carga`, `catalogo-vacio` |
| Detalle de producto | `producto-detalle.html` | `?estado=agotado \| no-disponible` | C-16b `producto-detalle` |
| | `producto-personalizar.html` | `?estado=agregado` (toast) | C-18 `producto-personalizar` |
| Carrito | `carrito.html` | `?estado=vaciar` (diálogo), `?rol=admin` (sin CTA) | C-18 `carrito`; C-19 `carrito-checkout` |
| | `carrito-vacio.html` | — | C-18 `carrito-vacio` |
| | (contador en navegación) | cubierto por `shell-admin` expandido, colapsado y barra mobile | C-18 `navegacion-contador` |
| Finalizar compra y pedido creado | `finalizar-compra.html` | `?estado=validacion \| efectivo \| mercadopago \| enviando`, `?error=stock` | C-19 `finalizar-compra` |
| | `pedido-creado.html` | `?estado=precios` | C-19 `pedido-creado` |
| | `pedido-creado-pago.html` | `?pago=rechazado \| en-confirmacion \| aprobado` | C-20b `pedido-creado-pago` |
| Pago del pedido | `pago-pedido.html` | formulario (Brick) por defecto; `?estado=pendiente \| aprobado \| rechazado \| demorando \| cargando` | C-20b `pago-pedido` |
| Mis pedidos | `mis-pedidos.html`, `mi-pedido-detalle.html`, `mis-pedidos-dialogos.html` | diálogo «Cancelar pedido» | C-21 `mis-pedidos`, `mi-pedido-detalle`, `dialogos` |
| Gestión de pedidos | `gestion-pedidos.html`, `gestion-pedido-detalle.html`, `gestion-dialogos.html` | diálogo «Confirmar pago» | C-22 `gestion-pedidos`, `gestion-pedido-detalle`, `dialogos` |
| Admin CRUD (plantilla) | `categorias.html`, `categoria-form.html`, `categoria-eliminar.html` | — | C-17a `categorias`, `categoria-form`, `categoria-eliminar` |
| | `productos.html`, `producto-form.html` | — | C-17b `productos`, `producto-form` |
| Ingredientes | `ingredientes.html` | — | C-17a `ingredientes`; C-17b `ingredientes-unidad` |
| Usuarios | `usuarios.html`, `usuario-form.html`, `usuario-desactivar.html` | — | C-23 `usuarios`, `usuario-form`, `usuario-desactivar` |
| Dashboard | `dashboard.html` | — | C-24 `dashboard` |
| Ingresar, registrarse, mi cuenta | `ingresar.html`, `registrarse.html`, `mi-cuenta.html` | `ingresar.html?estado=error` | C-14 `ingresar`, `registrarse`, `mi-cuenta` |
| Direcciones | `direcciones-lista.html`, `direcciones-form.html`, `direcciones-vacio.html`, `selector-checkout.html` | `direcciones-lista.html?estado=eliminar` | C-15 `direcciones-lista`, `direcciones-form`, `direcciones-vacio`, `selector-checkout` |

## Qué cambia respecto de los aprobados

- Tipografía: títulos y precios en Bricolage Grotesque, el resto en Geist; importes con numerales tabulares.
- Superficies: filtros, resúmenes, toolbars, zonas de acción y contenedores de gráficos sobre `--surface-section` (sin sombra); elevados solo la tarjeta de producto, el carrito, formularios, tablas, direcciones y KPI; datos de cuenta y bloques de detalle separados por divisores.
- Badges: solo el estado del pedido lleva chip con tinte; stock = chip neutro con punto («Quedan N», «Agotado»); categoría, rol, forma de pago, «En curso» y «Principal» como texto o chip neutro; máximo un distintivo por tarjeta o fila (se quitó «Nuevo» en productos).
- Encabezado de página (D9, feedback del 2026-11-23): banda con eyebrow, título display, subtítulo, metadatos y acción; búsqueda/filtros/período dentro de la banda; conteo + chips quitables + «Limpiar filtros». Fija en las listas (solo la lista se desplaza; encabezados de tabla fijos debajo), compacta al desplazar; en mobile fija bajo la barra superior con botón «Filtros» y fila de chips desplazable. Detalle y formularios: banda con ruta/volver, fija solo si tiene acciones (detalle de gestión de pedido). Sin banda: pantallas de estado, ingresar/registrarse y pedido creado.
- Tarjeta de producto: respaldo tipográfico (inicial en display, más chica, centrada y con opacidad reducida sobre `--color-primary-soft`), categoría en texto y omitida cuando coincide con el filtro, ícono de alérgeno con nombre accesible «Contiene alérgenos». En mobile el botón «Agregar» es un botón redondo con «+» (nombre accesible «Agregar <producto> al carrito») para que la grilla de 2 columnas no sea una pared de botones terracota.
- Marca: logo de Revision 4 en el panel y la barra mobile, isotipo con el panel colapsado, sin «(TBD)».
- Tablas en mobile: cada fila pasa a un bloque con «etiqueta … valor».

## Cómo previsualizar

1. Abrir cualquier `.html` directo en el navegador (sin servidor). Mobile: ventana de menos de 1024 px (drawer) o de 720 px (diseño de una columna).
2. Re-render: `node render.mjs [regex]` desde esta carpeta, con `playwright-core` resoluble (o `PLAYWRIGHT_CORE=<ruta al paquete>`). Usa el Microsoft Edge instalado en modo headless, `reducedMotion: 'reduce'`, viewport 1440x900 (alto extendido al de la página, para que el panel lateral cubra toda la captura) y 390x844 con `isMobile` (captura de página completa, salvo diálogos, drawer y barra de compra fija). Informa `scrollWidth` (390 en mobile, sin desborde), fuentes cargadas, errores de consola y cualquier pedido no `file://`.
3. `catalogo-scrolled-*` (640 px) y `gestion-pedidos-scrolled-*` (360 px desktop, 700 px mobile) se capturan a viewport tras desplazar la página; `render.mjs` comprueba que la banda esté en estado fijo e informa su borde inferior (desktop 193–197 px, mobile 203–213 px).
4. `catalogo-motion-desktop.png` es la única captura sin movimiento reducido (estado final de la entrada escalonada). `producto-detalle-mobile-full.png` y `producto-personalizar-mobile-full.png` muestran la página completa con la barra de compra en el flujo.

## Pendiente

- Aprobación explícita del usuario (tarea 2.3): aprobados el 2026-11-23.
- Botón «+» de agregar en mobile: se mantiene igual, pendiente de revisión del usuario.
