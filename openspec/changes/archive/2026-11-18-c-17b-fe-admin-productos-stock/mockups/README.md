# Mockups — C-17b `fe-admin-productos-stock`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-18, by user) — OQ-1, OQ-2 y OQ-3: por defecto
- Preview: rendered (2026-11-18, headless Microsoft Edge + `playwright-core` desde `file://`, «reducir movimiento», viewports 1440x900 y 390x844)

## Brief

- **Audiencia**: `ADMIN` (usuaria de ejemplo «Ana Gómez») y `STOCK` (usuario de ejemplo «Gestor Stock», `?rol=stock`). La misma página sirve a los dos; con solo `STOCK` desaparecen «Nuevo producto», «Editar» y «Eliminar» y el panel muestra solo «Productos y stock». CLIENT y PEDIDOS ven la página 403 de C-13b (sin mockup nuevo).
- **Tareas**: ADMIN da de alta y edita productos con precio, categorías (con una principal) e ingredientes (cantidad, unidad y «Se puede quitar» = `es_removible`); ADMIN y STOCK ajustan stock y disponibilidad desde la fila, sin entrar al formulario.
- **Pantallas y estados**: listado ADMIN (con recién creado), listado STOCK, estados de la fila (stock editado, inválido, interruptor guardando, aviso), carga, búsqueda sin resultados, error; formulario (alta lista, errores de validación, edición sin stock/disponibilidad, nombre repetido); baja (confirmar, error); seguimiento de C-17a: ingredientes con la unidad siempre visible y edición con la unidad preelegida.
- **Tamaños**: 1440x900 y 390x844. Breakpoints del shell: 1024 px (panel ↔ drawer; las filas de productos pasan de columnas a tarjeta con stock y disponibilidad debajo) y 720 px (stock y disponibilidad a lo ancho, acciones al pie de la tarjeta, formulario en una columna, filas de ingredientes apiladas, diálogos como hoja inferior).
- **Tokens y assets**: `design-system/tokens.css`, `brand.js`, logo provisional `design-system/assets/logo.svg`. `mockup.css`/`mockup.js` copiados de C-17a con el bloque «C-17b» agregado al final de `mockup.css`; `admin.js` nuevo (shell por rol, datos y piezas).
- **Restricciones**: datos del seed (`backend/app/db/seed.py`: 6 productos, 6 categorías, 12 ingredientes en «u»; «Burger Sin TACC» con stock 4 y «Limonada Natural» con stock 0 y no disponible, para mostrar las marcas; «Maní» en gramos viene de C-17a); contrato real de la API (ver `proposal.md`); textos en español rioplatense; sin rutas nuevas (formulario en la misma página, como C-15/C-17a).

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `productos.html` | Vista ADMIN: búsqueda, categoría, filtro segmentado Todos / Disponibles / No disponibles, «7 productos · 1 no disponible», filas con nombre + marca de alérgenos, categoría (· subcategoría · N ingredientes), precio, stock editable con «Guardar», interruptor «Disponible», «Editar»/«Eliminar»; «Burger Doble» recién creada + toast. | `?rol=stock` (vista STOCK), `?rol=stock&estado=stock` (valor cambiado → «Guardar» habilitado, «-1» con error, interruptor «Guardando…», toast «Stock actualizado»), `?estado=carga`, `?estado=vacio` (búsqueda «pizza» + «Limpiar filtros»), `?estado=error`, `?nav=drawer` |
| `producto-form.html` | Alta de «Burger Doble»: nombre (contador /150), precio con `$`, descripción, stock inicial, «Disponible para la venta»; categorías en casillas en orden de árbol + «Categoría principal»; 4 filas de ingredientes (ingrediente con «(alérgeno)», cantidad, unidad propuesta, «Se puede quitar», quitar) + «Agregar ingrediente». | `?modo=errores` (nombre vacío, precio `12,345`, sin categorías, ingrediente repetido, alerta arriba), `?modo=editar` («Burger Vegana»: sin stock ni disponibilidad, nota informativa), `?modo=duplicado` (409 en «Nombre») |
| `producto-eliminar.html` | Confirmar la baja de «Limonada Natural» (`btn-danger`). | `?estado=error` (sin conexión: mensaje dentro del diálogo + «Reintentar») |
| `ingredientes-unidad.html` | Listado de ingredientes de C-17a con la columna «Unidad» siempre completa («Maní» → «Gramo (g)»). | `?modo=editar` (edición de «Maní» con «Gramo (g)» preelegida; ya no existe «Sin cambios») |

Las anotaciones (franja amarilla y píldoras «Anotación») no son parte de la app.

## Cambios respecto del design system

- **Ícono nuevo, requiere revisión**: `i-guardar` (tilde), en «Guardar» del stock.
- **Fila de producto** (`.plist`/`.prow`): grilla con encabezado en versalitas (no `<table>`); stock con `input` numérico compacto (`.input-sm`) + botón, deshabilitado mientras no cambie el valor; marcas «Agotado» (`.badge b-cancelado`) y «Quedan N» (`.stock-low`) de C-16b; producto no disponible con nombre y precio atenuados. En mobile el bloque de stock (con rótulo «Stock») y el interruptor van sobre `--color-surface-alt`.
- **Interruptor** (`.switch` de C-16b) en la fila, con estado `.is-busy` («Guardando…», no optimista).
- **Formulario en secciones** (`.fsec`), casillas compactas (`.mini-check`), categorías indentadas (`.catpick`) y filas de ingredientes (`.pirow`) sobre `--color-surface-alt`; marca «Alérgeno» junto al rótulo de la fila.
- **Nota informativa** (`.ro-note`, tokens `--color-info`) en la edición: stock y disponibilidad se cambian desde la lista.

## Capturas (`previews/`)

Cada una en `-desktop.png` (1440x900) y `-mobile.png` (390x844): `productos`, `productos-rol-stock`, `productos-fila-stock`, `productos-carga`, `productos-vacio`, `productos-error`, `producto-form`, `producto-form-errores`, `producto-form-editar`, `producto-form-duplicado`, `producto-eliminar`, `producto-eliminar-error`, `ingredientes-unidad`, `ingrediente-form-unidad`; más `drawer-stock-mobile.png`. `previews/full/` tiene las páginas completas (listados y formularios) y `previews/resumen/` seis láminas para revisar en el teléfono: `1-listado-mobile.png`, `2-listado-desktop.png`, `3-formulario-mobile.png`, `4-formulario-desktop.png`, `5-baja-ingredientes-mobile.png`, `6-baja-ingredientes-desktop.png`.

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Panel abierto: `?nav=drawer`.
3. Re-render: `playwright-core` con Edge headless (`executablePath` de `msedge.exe`), contexto con `viewport` 1440x900 / 390x844, `reducedMotion: 'reduce'`, captura del viewport. Playwright MCP no está disponible en esta máquina.

## Fuentes

- `design-system/README.md` (Revision 2), `components.html`, `tokens.css`, `brand.md`
- Mockups aprobados de C-13a (shell admin), C-15 (formulario, diálogo), C-16b (interruptor, marcas de stock, búsqueda) y C-17a (`mockup.css`/`mockup.js`, listas admin, filtro segmentado)
- `knowledge-base/06_funcionalidades.md` US-010/US-011/US-012, `05_reglas_de_negocio.md` RN-PR-01..06, `03_actores_y_roles.md` (matriz RBAC)
- `backend/app/modules/productos/`, `ingredientes/`, `backend/app/db/seed.py`; `proposal.md`, `design.md` y specs de este change
