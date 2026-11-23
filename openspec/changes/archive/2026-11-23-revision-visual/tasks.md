# Tasks — C-25b0 `revision-visual`

Convenciones:
- `[GATE: …]` = no empezar hasta cumplir lo indicado. `[USUARIO]` = la hace el usuario. `[OQ-x]` = condicionada por esa pregunta abierta de `design.md` (se escribe con la opción recomendada).
- Strict TDD: en cada tarea de código, safety net (tests existentes de los archivos tocados) → RED → GREEN → triangulación → refactor. Frontend desde `frontend/` (`npm test`, `npm run typecheck`, `npm run lint`); backend desde `backend/` (`pytest` contra `foodstore_test`). No levantar dev server ni build sin permiso del usuario (regla 13); no commitear.
- Este change **no edita** `design-system/`: si los mockups piden un ajuste de tokens o assets, se devuelve a la redacción de Revision 4 y su aprobación se reinicia.

## 1. Gate del design system

- [x] 1.1 [GATE] [USUARIO] Aprobar design system **Revision 4** (`design-system/README.md` con `Approval: approved (<fecha>, by user)` y `.active-orchestrator-state.json` alineado); verifica: ambos archivos dicen Revision 4 aprobada y `## UI Mockups` de `design.md` pasa a `Design system revision: 4`
- [x] 1.2 Resolver OQ-2 (isotipo separado o recorte del logo) y OQ-1 (fotos locales CC0/propias o solo respaldo tipográfico) con el usuario a la vista de Revision 4; verifica: decisiones anotadas en `design.md` (D6, D7)

## 2. Mockups bajo Revision 4 [GATE: 1.1]

- [x] 2.1 Crear `mockups/` copiando los HTML aprobados de cada pantalla de la tabla «Pantallas a rehacer» de `design.md` y re-cablearlos a `design-system/` Revision 4 aplicando D2 (superficies), D3 (badges), D4 (movimiento), D5 (tarjeta y respaldo) y D6 (logo); `mockups/README.md` con pantallas, fuentes, pasos de preview y `Approval: pending`; verifica: cada fila de la tabla tiene su HTML y abre desde `file://` sin pedidos externos
- [x] 2.2 Renderizar cada mockup a 1440x900 y 390x844 (headless Edge, `--force-prefers-reduced-motion`; una captura extra del catálogo sin esa bandera) en `mockups/previews/`, inspeccionarlas y corregir defectos; verifica: capturas presentes, sin desborde horizontal en 390 px, `Preview: rendered (<fecha>, mockups/previews/)` en `design.md`
- [x] 2.3 [GATE] [USUARIO] Presentar capturas y enlaces a los HTML y obtener la aprobación explícita de la revisión de mockups; verifica: `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`, y los mockups enlazados como criterio de aceptación en este archivo

## 3. Fundamentos: fuentes, tokens y movimiento [GATE: 2.3]

- [x] 3.1 Test de compilación de estilos: cada `@font-face` compilado del frontend apunta a un archivo local existente, sus familias coinciden con `--font-display`/`--font-sans`, y ningún `url()` es remoto; GREEN con D1 (o su plan B); verifica: escenarios «Fuentes autoalojadas» y «Familias tipográficas declaradas» en verde en `tests/architecture/styles-compile.test.ts`
- [x] 3.2 Extender `tests/architecture/tailwind-tokens.test.ts` a los tokens nuevos de Revision 4 que use el tema (superficies, movimiento, `--numeric-tabular`) y mapearlos en `tailwind.config.ts` sin literales; verifica: escenario «Tema mapeado a variables existentes» en verde
- [x] 3.3 Test de arquitectura: ningún selector `:hover` en `src/**/*.css` fuera de `@media (hover: hover)`; envolver los hover existentes; verifica: escenario «Pantalla táctil» (test de arquitectura) en verde
- [x] 3.4 Respuesta al presionar en `claseBoton`, enlaces-botón y tarjetas clicables con `--press-scale` y tokens de movimiento; test de componente/CSS de la clase aplicada; verifica: escenarios «Botón presionado» y «Preferencia de movimiento reducido» (sin escala con `--press-scale: 1`)
- [x] 3.5 Hook de primer montaje en `shared/lib` (con su `index.ts`) + clase de entrada escalonada con `--i` topado en 8 para catálogo, mis pedidos y gestión de pedidos; tests: anima al montar, no al cambiar filtro/página; verifica: escenarios «Primer montaje» y «Cambio de filtro» en verde
- [x] 3.6 Numerales tabulares en `Precio` y en totales/cantidades (carrito, checkout, pedidos, dashboard); verifica: escenario «Importes alineados» en verde

## 4. Catálogo y producto [GATE: 2.3]

- [x] 4.1 Respaldo tipográfico en `ImagenProducto`: inicial Unicode en mayúscula (tildes y «Ñ»; sin alfanumérico → ícono), color de marca único, `role="img"` y «Sin imagen de <nombre>»; tests de los tres escenarios; verifica: «Producto sin imágenes», «Imagen que no carga» y «Respaldo de color único» en verde
- [x] 4.2 `MarcaStock` con un único estilo de marca de stock (tono por estado), sin clases `b-<estado>` de pedido; verifica: «Producto agotado», «Pocas unidades» y «Mismo estilo de marca» en verde
- [x] 4.3 `TarjetaProducto`: jerarquía de D5 (precio en display + tabular), categoría como texto omitida si coincide con el filtro activo (prop opcional pasada por la página), ícono de alérgeno con «Contiene alérgenos»; ajustar la página Catálogo; verifica: escenarios de «Listado del catálogo» (incluidos «Categoría omitida al filtrar por ella» y «Producto con alérgenos») y «Categoría como texto» en verde
- [x] 4.4 [OQ-1] Seed sin hosts externos: test en `backend/tests/integration/test_seed.py` (ninguna URL de demostración empieza con `http(s)://`; idempotencia intacta) y quitar `_IMG` de `backend/app/db/seed.py`; variante recomendada: `None` salvo que el usuario haya aprobado fotos locales CC0/propias en 1.2 (entonces rutas `/demo/productos/<slug>.webp` en `frontend/public/demo/` + `ATRIBUCIONES.md`); verifica: «Imágenes de demostración sin hosts externos», «Demo sobre base vacía» y «Seed idempotente» en verde
- [x] 4.5 Detalle de producto con superficies de D2 y respaldo grande; verifica: tests del detalle existentes en verde y revisión axe del catálogo, filtros y detalle sin violaciones («Revisión automática»)

## 5. Shell, logo y favicon [GATE: 2.3]

- [x] 5.1 Logo de Revision 4 en el panel con nombre accesible «Food Store», isotipo con el panel colapsado (según OQ-2), sin «PROVISIONAL/(TBD)» en el shell ni en `index.html`; verifica: «Logo sin rótulo provisorio» e «Isotipo con el panel colapsado» en verde, más los tests existentes del shell
- [x] 5.2 Favicon nuevo: extender `tests/architecture/favicon.test.ts` (sin «PROVISIONAL»/«TBD» en el asset) y mantener la carga desde el import del alias; verifica: «Sin 404 de favicon» y «Favicon sin marca provisoria» en verde

## 6. Superficies y badges en el resto de pantallas [GATE: 2.3]

- [x] 6.1 Filtros del catálogo, carrito, finalizar compra, pago y pedido creado: cajas → `--surface-section`/divisores según D2 y los mockups aprobados; verifica: tests de esas páginas en verde y axe sin violaciones
- [x] 6.2 Mis pedidos, gestión de pedidos y sus detalles/diálogos: superficies de D2; badges solo para estado de pedido y de pago; verifica: «Estado de pedido como badge» y tests existentes en verde, axe sin violaciones
- [x] 6.3 Admin (categorías, ingredientes, productos y stock, usuarios, dashboard), cuenta, direcciones, ingresar/registrarse, 404/error: superficies de D2, roles y metadatos como texto o chip neutro; verifica: tests de esas páginas en verde, axe sin violaciones
- [x] 6.4 [D9] `EncabezadoPagina` en `shared/ui` (con su `index.ts`) con TDD: props `titulo`, `eyebrow`, `subtitulo`, `ruta`/volver, `estado`, `acciones`, `herramientas`, `filtrosActivos` (chips quitables + «Limpiar filtros» + conteo) y `fijo`; centinela + `IntersectionObserver` → `data-stuck` (título un paso menor, subtítulo oculto, filete/sombra) y variable CSS con el alto para los encabezados de tabla; token `--z-page-header`; movimiento reducido sin transición; tests: render de cada slot, chip quitable llama a su callback, compacto al dejar de intersectar el centinela, sin `position: sticky` cuando `fijo` es falso; verifica: escenarios «Estado compacto al desplazar», «Encabezado fijo con movimiento reducido», «Filtro activo quitable» y «Detalle sin acciones» en verde
- [x] 6.5 [D9] Adoptar `EncabezadoPagina` fijo en las páginas de listado (catálogo con búsqueda, categorías raíz, precio y «Solo con stock» en la barra y botón «Filtros» mobile que abre la hoja inferior existente; mis pedidos; gestión de pedidos con estado y fechas; categorías; ingredientes; productos y stock; usuarios; direcciones; dashboard con período y agrupación), encabezados de tabla fijos debajo; reemplazar los títulos y barras de filtros actuales sin perder sus tests; mockups `catalogo*`, `mis-pedidos`, `gestion-pedidos`, `categorias`, `ingredientes`, `productos`, `usuarios`, `direcciones-lista`, `dashboard` y capturas `*-scrolled-*` como criterio; verifica: «Lista que se desplaza bajo el encabezado», «Encabezados de tabla fijos» y «Encabezado en mobile» en verde, tests existentes de esas páginas en verde
- [x] 6.6 [D9] Adoptar `EncabezadoPagina` no fijo en detalle y formularios (detalle de producto solo con ruta, finalizar compra, pago, detalle de mi pedido, formularios admin, mi cuenta) y fijo en el detalle de gestión de pedido con sus acciones (Actualizar, Cancelar pedido, Confirmar pago) en el encabezado; verifica: «Detalle sin acciones» en verde y tests existentes de esas páginas en verde
- [x] 6.7 Suite completa del frontend, `npm run typecheck` y `npm run lint`; suite del backend si se tocó el seed; README del frontend actualizado (fuentes, movimiento, respaldo de imagen); verifica: todo en verde y sin `any`

## 7. Verify visual [GATE: 6.7] [GATE: permiso del usuario para levantar el stack, regla 13]

- [x] 7.1 [USUARIO] Actualizar las imágenes de la base de desarrollo (editar desde el admin o recrear la base y sembrar) para que no queden URLs externas antes de capturar; verifica: el catálogo no hace pedidos a hosts externos
- [x] 7.2 Comparar cada pantalla implementada con su mockup aprobado y con Revision 4 a 1440x900 y 390x844; revisar consola y red; capturas en `mockups/verify/`; reporte blocker/major/minor por pantalla y viewport, con pantallas revisadas y no revisadas; detener lo levantado; verifica: `Visual verify:` registrado en `design.md`

## Workflow follow-up

- Verify del change (`openspec-verify`) y archivo con `/opsx:archive`; marcar `[C-25b0] revision-visual` `[x]` en `CHANGES.md`.
- Al archivar, se desbloquean las tareas 2.2, 3.1, 3.2 y 4.2 de C-25b (capturas, verify visual y guion se hacen sobre Revision 4).
- Commits y push solo a pedido del usuario, flujo `dev → main → dev` de `CLAUDE.md`.
