# Design — `revision-visual` (C-25b0)

## Context

Ver `proposal.md` (Why). Estado actual relevante:

- El frontend importa `design-system/tokens.css` tal cual desde `src/app/styles/index.css` (alias `@design-system`), y el tema de Tailwind solo referencia variables (`tests/architecture/tailwind-tokens.test.ts`). Cambiar valores de tokens no requiere tocar `frontend/`; lo que sí requiere código es lo **estructural**: superficies, badges, tarjeta de producto, logo, movimiento.
- **Design system Revision 4** está aprobada en `design-system/` (`Revision: 4`, aprobada por el usuario el 2026-11-23): `tokens.css` ya declara `@font-face` de «Bricolage Grotesque» (display) y «Geist» (texto) con archivos locales en `design-system/assets/fonts/` (OFL 1.1), alias de superficie (`--surface-page`, `--surface-section`, `--surface-raised`, `--surface-overlay`), `--numeric-tabular`, tokens de movimiento (`--motion-*`, `--ease-*`, `--press-scale`, `--stagger-step`) y su anulación con `prefers-reduced-motion`. `package.json` ya tiene `@fontsource-variable/bricolage-grotesque` y `@fontsource-variable/geist` (origen de los woff2). Este change **no edita** `design-system/` ni depende de detalles no aprobados: si Revision 4 cambia antes de aprobarse, se ajustan los mockups, no los specs.
- Tarjeta de producto (`entities/producto/ui/tarjeta-producto.tsx`): `.card.prod`, chip `.cat` con la categoría principal en todas las tarjetas, marca de stock con clases de estado de pedido (`badge b-cancelado` / `badge b-pendiente`), y `ImagenProducto` que sin URL o con error muestra `.ph.none` con el ícono `plato` sobre degradés.
- Seed (`backend/app/db/seed.py`): `_IMG = "https://via.placeholder.com/400x300?text="` para categorías y productos; ese host no responde, así que **todas** las imágenes fallan (pedidos de red con error y el marcador en cada tarjeta). La base de desarrollo además tiene productos cargados a mano con el mismo problema.
- El shell muestra `design-system/assets/logo.svg` con el rótulo «LOGO PROVISIONAL (TBD)»; con el panel colapsado el logo se oculta. El favicon lo aplica `src/main.tsx` desde el import del asset.
- El sprite (`shared/ui/icon`) ya tiene `alergeno`, `plato`, etc. (Revision 3).

## Goals / Non-Goals

**Goals:**
- Que todas las pantallas aprobadas se vean bajo Revision 4 con jerarquía de superficies, tipografía con carácter y movimiento sobrio, sin romper ningún comportamiento ni test funcional existente.
- Dejar el catálogo con un punto focal claro y sin imágenes rotas para las capturas y el video de C-25b.

**Non-Goals:**
- Cambiar flujos, textos funcionales, rutas, API o permisos.
- Modo oscuro, landing, dashboard «cockpit», toasts globales de errores HTTP (follow-ups posibles).
- Editar `design-system/` (lo hace la redacción de Revision 4; cualquier ajuste pedido en los mockups vuelve a ese trabajo y re-abre su aprobación).
- Cloudinary / subida real de imágenes (C-28, PA-19).

## Decisions

### D1 — Fuentes: una sola fuente de verdad en `tokens.css`
El frontend usa las `@font-face` que declara `design-system/tokens.css` (archivos de `design-system/assets/fonts/`), que Vite empaqueta con hash al resolver los `url()` del CSS importado. **Alternativa**: importar `@fontsource-variable/*` en `index.css`; se descarta como fuente primaria porque duplicaría las declaraciones y los nombres de familia («… Variable») no coincidirían con los tokens. Si los `url()` relativos no se reescriben bien al pasar por `postcss-import` (riesgo R1), el plan B es importar los woff2 desde `@fontsource-variable/*` en un CSS del frontend **con los mismos nombres de familia** de los tokens. Si al final el frontend no importa los paquetes `@fontsource-variable/*`, se dejan como dependencia de desarrollo/origen documentado o se quitan (decisión menor de apply, registrada en el README del frontend).

### D2 — Jerarquía de superficies por rol, no por componente
Se aplican los alias de Revision 4: `--surface-raised` (borde 1 px + `shadow-sm`) **solo** para objetos sobre los que se actúa (tarjeta de producto, línea de carrito, pedido en listas, panel de formulario); `--surface-section` (sin sombra) para zonas agrupadas (barra/hoja de filtros, resumen del checkout y del pedido, encabezados de tabla); el resto se separa con divisores `--color-border` y espaciado de la escala. Pantallas tocadas: catálogo (filtros), detalle de producto (bloques de ingredientes y alérgenos), carrito (resumen), finalizar compra (resumen y bloques), pago, pedido creado, mis pedidos y detalle, gestión de pedidos y detalle, CRUDs admin (paneles de lista/formulario), usuarios, dashboard (tarjetas KPI quedan `raised`; contenedores de gráficos pasan a `section`), cuenta/direcciones, ingresar/registrarse (`tarjeta-auth` queda `raised`). **Alternativa**: cambiar solo valores de tokens; se descarta porque el problema es estructural (todo es la misma caja).

### D3 — Badges solo para estados; marca de stock propia
`.badge` + `b-<estado>` queda para estados de pedido y de pago. La marca de stock pasa a un único componente/estilo (`MarcaStock` con una clase propia de marca de stock y un modificador de tono `agotado`/`pocas`), ya no reutiliza `b-cancelado`/`b-pendiente`. Categorías, roles en el listado de usuarios y metadatos pasan a texto (`--color-text-muted`) o al chip neutro existente. Se verifica con tests de componente (clases/estilos) y con el spec `frontend-visual-language`.

### D4 — Movimiento solo con CSS y tokens
- Presión: `:active { transform: scale(var(--press-scale)) }` con `transition: transform var(--motion-fast) var(--ease-out)` en botones (`claseBoton`), enlaces-botón y tarjetas clicables.
- Hover: todas las reglas de hover existentes se envuelven en `@media (hover: hover)` (barrido de los CSS del frontend; un test de arquitectura comprueba que no queden `:hover` fuera de ese media query en `src/**/*.css`).
- Entrada escalonada: una clase de entrada aplicada por el contenedor de la lista **solo en el primer render** de la página (un hook en `shared/lib`, p. ej. `usePrimerMontaje`, que devuelve `true` hasta el primer efecto); cada ítem recibe `--i` (índice, tope 8) y `animation-delay: calc(min(var(--i), 8) * var(--stagger-step))`. Cambios de filtro/página re-renderizan sin la clase (el componente sigue montado).
- Movimiento reducido: lo resuelve `tokens.css` (anula duraciones, `--press-scale: 1`, `--stagger-step: 0ms`); el frontend no agrega lógica propia salvo no forzar animaciones con JS.
**Alternativa**: librería de animación (Framer Motion); se descarta (peso, dependencia nueva, el alcance es CSS).

### D5 — Tarjeta de producto y respaldo tipográfico
Orden visual: imagen (o respaldo) → nombre (enlace, área completa clicable) → precio en `--font-display` con `--numeric-tabular` → acción. Categoría en texto pequeño apagado, omitida si `categoria` del filtro activo coincide con la principal (la página pasa el id filtrado a la tarjeta como prop opcional; la entidad no lee la URL). Ícono `alergeno` del sprite con `aria-label="Contiene alérgenos"` cuando `alergenos(producto).length > 0`. Respaldo: inicial = primer carácter alfanumérico del nombre en mayúscula (Unicode, conserva tildes: «Ñoquis» → «Ñ»; sin alfanumérico → ícono `plato`), en `--font-display` sobre un único color de marca del design system (p. ej. `--color-primary-soft` con texto `--color-primary-hover`), `role="img"` + `aria-label="Sin imagen de <nombre>"`. Se quitan los degradés por categoría. El detalle de producto usa el mismo respaldo en tamaño grande.

### D6 — Logo, isotipo y favicon
El shell importa el logo de Revision 4 desde `@design-system/assets/` (mismo mecanismo que el favicon de C-25b1) y, si Revision 4 entrega un isotipo separado, lo usa con el panel colapsado; si no, se recorta del logo con un `viewBox` en el componente (decisión según los assets aprobados). Nombre accesible «Food Store» desde `shared/config/brand.ts`. Se elimina cualquier texto «PROVISIONAL/(TBD)» del chrome y del comentario de `index.html`. Tests: `tests/architecture/favicon.test.ts` extendido (sin «PROVISIONAL»/«TBD» en el asset) y test del shell (nombre accesible, isotipo colapsado).

### D7 — Imágenes del seed (ver OQ-1)
**Decisión (OQ-1, 2026-11-23): opción solo respaldo tipográfico, seed con `imagen_url = null`; Cloudinary queda para C-28.** El seed deja de usar `_IMG` externo. Implementación según OQ-1: **(a)** rutas relativas `/demo/productos/<slug>.webp` a archivos en `frontend/public/demo/` (el frontend los sirve en el mismo origen en dev y en la imagen `prod`), o **(b)** `imagenes_url = None` / `imagen_url = None` y respaldo tipográfico. En ambos casos el test de seed exige que ninguna URL empiece con `http(s)://`. La base de desarrollo ya sembrada no se toca con el seed (es idempotente: no reescribe filas existentes); para las capturas se documenta el paso (editar las imágenes desde el admin o recrear la base y sembrar), a cargo del usuario.

### D8 — Mockups: reutilizar los aprobados y re-renderizarlos bajo Revision 4
`openspec/changes/revision-visual/mockups/` copia los HTML aprobados de `archive/*/mockups/` de cada pantalla afectada y los re-cablea a `design-system/` Revision 4 (tokens, fuentes, logo) aplicando D2–D6; no se re-diseñan flujos. Render a 390x844 y 1440x900 con headless Edge (Playwright MCP no arranca en esta máquina: falta Chrome) en `mockups/previews/`, con `--force-prefers-reduced-motion` para las capturas estáticas y una captura sin esa bandera del catálogo para mostrar el estado final de la entrada.

### D9 — Encabezado de página fijo (feedback del usuario, 2026-11-23)
El panel lateral (DD-25) y la barra superior <1024 px quedan como están. El problema era que título y filtros no tenían presencia: lo único que se destacaba era el panel o la lista. Se agrega un patrón compartido `EncabezadoPagina` (`shared/ui`, con su `index.ts`) para toda página con título:
- **Banda**: ruta o volver (opcional), eyebrow (sección: «Tienda», «Operación», «Administración», «Tu cuenta», «Tu compra»), título en `--font-display`, subtítulo de una línea, metadatos (conteo, período, hora de actualización) y acción primaria alineada a la derecha.
- **Barra de herramientas dentro de la banda**: búsqueda, filtros, orden y período; debajo, conteo de resultados + filtros activos como chips quitables + «Limpiar filtros».
- **Fija en páginas de listado** (catálogo, mis pedidos, gestión de pedidos, categorías, ingredientes, productos y stock, usuarios, direcciones, dashboard): `position: sticky; top: 0` dentro del área de contenido, fondo `--surface-page`, `z-index: var(--z-page-header)` (token nuevo, 15: debajo de la barra superior y de los overlays). Solo la lista se desplaza por debajo.
- **Estado compacto al desplazar**: un centinela de alto 0 antes de la banda y un `IntersectionObserver` marcan `data-stuck`; el título baja un paso de escala, el subtítulo y el eyebrow se ocultan y aparece un filete + sombra sutil, con `--motion-*`/`--ease-*`; con movimiento reducido el cambio es instantáneo.
- **Encabezados de tabla** fijos debajo de la banda (`top` = alto de la banda, publicado como variable CSS por el componente; el contenedor de la tabla usa `overflow: clip`).
- **Mobile (<1024 px)**: la banda queda fija debajo de la barra superior existente, compacta (título + acción, botón «Filtros» con contador que abre la hoja inferior existente, fila de chips con desplazamiento horizontal), alto máximo ~25 % de 844 px (medido en los mockups: 203–213 px incluida la barra superior).
- **Detalle y formularios** (detalle de producto, finalizar compra, pago, detalle de pedido, formularios admin, mi cuenta): misma banda con volver/ruta, título y estado; **fija solo si tiene acciones** (p. ej. detalle de gestión de pedido: Actualizar, Cancelar pedido y Confirmar pago suben al encabezado). El detalle de producto conserva el `h1` en el bloque del producto y la banda lleva solo la ruta.
- Sin banda: 404, error, prohibido, carga de sesión, ingresar/registrarse y pedido creado (pantallas de estado centradas).
- **Respaldo de la tarjeta** (ajuste a D5): inicial más chica, centrada, `--color-primary` con opacidad reducida sobre `--color-primary-soft`, para que el foco vaya a nombre y precio; mismas reglas de marca de stock y alérgenos.
- El botón «+» de agregar en mobile queda igual y **sigue abierto** para revisión del usuario.

## UI Mockups

- Design system revision: 4 (approved 2026-11-23, by user)
- Decision: yes (2026-11-23)
- Mockups: `openspec/changes/revision-visual/mockups/` (42 HTML, índice y bases en `mockups/README.md`; base: mockups aprobados en `openspec/changes/archive/*/mockups/`)
- Approval: approved (2026-11-23, by user)
- Preview: rendered (2026-11-23, re-render por D9; `openspec/changes/revision-visual/mockups/previews/`: 115 capturas a 1440x900 y 390x844, headless Edge con viewport real y movimiento reducido; `catalogo-motion-desktop.png` sin movimiento reducido; `catalogo-scrolled-*` y `gestion-pedidos-scrolled-*` con la lista desplazada bajo el encabezado fijo)
- Visual verify: passed (2026-11-23, `mockups/verify/` + `mockups/verify/README.md`: 1 blocker y 5 major corregidos con TDD en dos rondas; quedan 4 diferencias minor abiertas; pantallas no comparadas listadas)

Pantallas a rehacer (cada una a 1440x900 y 390x844; base archivada entre paréntesis):

| Pantalla / estados | Base aprobada |
|---|---|
| Shell anónimo y admin, panel colapsado, drawer mobile | C-13a `shell-anon`, `shell-admin` |
| 404, error genérico, prohibido, carga de sesión | C-13a `not-found`, `error`; C-13b `forbidden`, `session-loading` |
| Catálogo: con datos (escritorio y mobile), filtros, carga, vacío | `fe-catalogo-filtros-arriba` `catalogo-escritorio`, `catalogo-mobile`; C-16b `catalogo-filtros`, `catalogo-carga`, `catalogo-vacio` |
| Detalle de producto (con y sin imagen, personalización) | C-16b `producto-detalle`; C-18 `producto-personalizar` |
| Carrito (con ítems, vacío, contador en navegación) | C-18 `carrito`, `carrito-vacio`, `navegacion-contador` |
| Finalizar compra y pedido creado | C-19 `finalizar-compra`, `carrito-checkout`, `pedido-creado`; C-20b `pedido-creado-pago` |
| Pago del pedido | C-20b `pago-pedido` (reemplaza a C-20a y al provisorio de C-19) |
| Mis pedidos, detalle y diálogos | C-21 `mis-pedidos`, `mi-pedido-detalle`, `dialogos` |
| Gestión de pedidos, detalle y diálogos | C-22 `gestion-pedidos`, `gestion-pedido-detalle`, `dialogos` |
| Admin CRUD: categorías (lista, formulario, baja) como plantilla; productos y stock (lista, formulario) | C-17a `categorias`, `categoria-form`, `categoria-eliminar`; C-17b `productos`, `producto-form` |
| Ingredientes (lista y unidad) | C-17a `ingredientes`; C-17b `ingredientes-unidad` (mismo patrón que categorías: una captura de control) |
| Usuarios (lista, formulario, desactivar) | C-23 `usuarios`, `usuario-form`, `usuario-desactivar` |
| Dashboard | C-24 `dashboard` |
| Ingresar, registrarse, mi cuenta | C-14 `ingresar`, `registrarse`, `mi-cuenta` |
| Direcciones (lista, formulario, vacío, selector del checkout) | C-15 `direcciones-lista`, `direcciones-form`, `direcciones-vacio`, `selector-checkout` |

## Risks / Trade-offs

- [R1] `postcss-import` inlinea `tokens.css` y los `url("assets/fonts/…")` podrían quedar relativos a `src/app/styles/` → fuentes 404. → Test de compilación de estilos (`tests/architecture/styles-compile.test.ts`) que comprueba que cada `@font-face` compilado resuelve a un archivo existente; plan B de D1.
- [R2] Revision 4 puede cambiar (o no aprobarse) mientras se preparan los mockups. → Gate 1 de tasks: no se crean mockups hasta su aprobación; los specs no nombran valores ni familias concretas.
- [R3] Un barrido de CSS amplio puede romper tests de componentes que miran clases (`badge`, `cat`, `card`). → Safety net antes de cada grupo y TDD por componente; los tests se actualizan solo donde el spec cambia (stock, categoría, respaldo).
- [R4] Fotos de terceros sin licencia clara en un repositorio público. → OQ-1 recomienda solo licencias que permitan redistribución (CC0 o fotos propias) con un archivo de atribuciones; sin eso, respaldo tipográfico.
- [R5] La base de desarrollo conserva URLs externas viejas → pedidos fallidos en consola durante el video. → D7: paso documentado para el usuario antes de capturar.
- [R6] Animaciones que distraen en el video. → Tokens cortos (`--motion-fast` 120 ms), tope de 8 en el escalonado, sin animaciones en refrescos.

## Migration Plan

Sin migración de datos ni de esquema. Despliegue = merge del frontend + seed. Rollback: revertir el commit del change (Revision 3 sigue en el historial de `design-system/`).

## Open Questions

- **OQ-1 — RESUELTA (2026-11-23, usuario): solo respaldo tipográfico; el seed queda con `imagen_url = null`, sin fotos locales. Las imágenes reales se cargarán más adelante con Cloudinary (C-28, PA-19).** Planteo original: Imágenes de producto (recomendación: respaldo tipográfico siempre + fotos locales CC0 opcionales).** Opciones: (a) fotos reales locales en `frontend/public/demo/productos/` con licencia que permita redistribución (CC0 o fotos propias del usuario) y `ATRIBUCIONES.md`; (b) Cloudinary: descartado aquí, es C-28/PA-19 y exige cuenta y secretos; (c) solo respaldo tipográfico (inicial + color único). **Recomendado**: implementar (c) siempre (es el respaldo que exige el spec y cubre productos futuros) y sumar (a) para los 6 productos del seed **solo si el usuario provee o aprueba las fotos y su licencia**; sin esa aprobación el seed queda con `null`. No cambia specs ni tareas: la tarea 4.4 se ejecuta con la variante elegida.
- **OQ-2 — RESUELTA (2026-11-23): Revision 4 entrega el isotipo como asset separado (`design-system/assets/favicon.svg`), que se usa en el panel colapsado y como favicon.** Planteo original: Isotipo para el panel colapsado.** Depende de si Revision 4 entrega un asset separado (D6); se resuelve al aprobarla, sin cambiar specs.
- **OQ-3 — Paquetes `@fontsource-variable/*`**: mantener como origen documentado o quitarlos si el frontend no los importa (D1); se decide en apply.
