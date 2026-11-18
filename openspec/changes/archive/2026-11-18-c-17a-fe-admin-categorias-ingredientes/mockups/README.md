# Mockups — C-17a `fe-admin-categorias-ingredientes`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-18, by user) — OQ-1 y OQ-2: por defecto (D5, D6)
- Preview: rendered (2026-11-18, headless Microsoft Edge desde `file://`, «reducir movimiento», 1440x900 y 390x844 —390 px dentro de un iframe—)

## Brief

- **Audiencia**: usuarios con rol `ADMIN` (usuaria de ejemplo «Ana Gómez», igual que el shell admin de C-13a). CLIENT, PEDIDOS y STOCK no ven estas secciones ni pueden abrirlas (página 403 de C-13b, sin mockup nuevo).
- **Tarea**: ordenar el catálogo en categorías y subcategorías sin crear ciclos ni dejar productos colgando, y mantener los ingredientes con su marca de alérgeno y unidad de medida.
- **Pantallas y estados**: árbol de categorías (con datos, recién creada, carga, vacío, error); formulario de categoría (alta de subcategoría con error, edición con padres filtrados, nombre repetido, sin conexión); baja de categoría (confirmar, con subcategorías, rechazada por productos); ingredientes (listado con alérgenos y uso, carga, filtro sin resultados, error); formulario de ingrediente (alta, edición, nombre repetido); baja de ingrediente (en uso, sin uso).
- **Tamaños**: 1440x900 y 390x844. Breakpoints del shell: 1024 px (panel ↔ drawer; las filas de ingredientes pasan de columnas a apiladas) y 720 px (acciones de cada fila debajo del contenido, formularios en una columna, diálogos como hoja inferior).
- **Tokens y assets**: `design-system/tokens.css`, `brand.js` y el logo provisional `design-system/assets/logo.svg`. `mockup.css`/`mockup.js` copiados de C-16b (shell, botones, campos, diálogo, toasts, estados) con el bloque «C-17a» agregado al final de `mockup.css`.
- **Restricciones**: datos del seed (`backend/app/db/seed.py`: 6 categorías, 12 ingredientes, 7 unidades, uso real por producto); contrato real de la API (ver `proposal.md`); textos en español rioplatense; sin rutas nuevas (formulario en la misma página, como C-15).

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `categorias.html` | Árbol del seed: raíces en tarjetas, subcategorías anidadas con guía, «N subcategorías», acciones «Subcategoría» / «Editar» / «Eliminar» por fila, «6 categorías · 3 principales». Mobile: acciones bajo cada fila. | `?estado=creada` («Aguas» nueva bajo Bebidas, resaltada, toast «Categoría creada»), `?estado=carga`, `?estado=vacio`, `?estado=error`, `?nav=drawer` |
| `categoria-form.html` | «Nueva subcategoría» abierta desde Bebidas (padre preelegido) tras guardar con el nombre vacío: «Ingresá un nombre.», contador 0/100. | `?modo=editar` (Hamburguesas: el padre no ofrece ella ni Sin TACC/Veganas), `?modo=duplicado` (409: «Ya existe una categoría con ese nombre.»), `?modo=red` (alerta general, datos conservados) |
| `categoria-eliminar.html` | Confirmar la baja de «Postres» (`btn-danger`). | `?estado=subcategorias` (Hamburguesas: «No podés eliminar… todavía», lista de hijas, solo «Entendido», sin pedido), `?estado=productos` (409 `CATEGORY_HAS_PRODUCTS` dentro del diálogo + «Ir a Productos y stock») |
| `ingredientes.html` | Lista con encabezado de columnas en desktop: nombre + marca «Alérgeno», descripción, unidad, «Usado en N productos», acciones; filtro segmentado Todos / Alérgenos / No alérgenos; «Maní» recién creado + toast. | `?estado=carga`, `?estado=vacio` (filtro Alérgenos sin resultados + «Ver todos»), `?estado=error` |
| `ingrediente-form.html` | Alta de «Maní»: unidad «Gramo (g)», «Es alérgeno» marcado (tarjeta resaltada en tono de aviso). | `?modo=editar` (Mayonesa sin la marca), `?modo=duplicado` (409 en «Nombre») |
| `ingrediente-eliminar.html` | Baja de «Queso Cheddar» con aviso «Lo usan 3 productos» y sus nombres. | `?estado=sin-uso` (sin aviso) |

Las anotaciones (franja amarilla y píldoras «Anotación») no son parte de la app. `admin.js` arma el shell alrededor de `<main id="main">`, los datos de ejemplo y las piezas repetidas.

## Cambios respecto del design system

- **Íconos nuevos, requieren revisión**: `i-subcategoria` (agregar hija), `i-alergeno` (escudo con «!», marca de alérgeno) e `i-reintentar`, mismo trazo que el sprite de `components.html`.
- **Árbol editable** (`.ctree`/`.crow`): tarjeta por raíz, hijas sobre `--color-surface-alt` con guía en «L»; ícono de categoría en `--color-primary-soft`. «Eliminar» en `--color-danger` (ghost).
- **Lista de ingredientes** (`.ilist`/`.irow`): filas en grilla con encabezado en versalitas (no `<table>`, para apilar en mobile sin scroll horizontal).
- **Marca «Alérgeno»** (`.b-alergeno`): tokens `--color-warning`/`--color-warning-bg` con ícono en vez del punto de `.badge` (la del detalle público de C-16b usa la misma familia de color).
- **Control segmentado** (`.seg`, `aria-pressed`) para el filtro; **casilla destacada** (`.check`) para «Es alérgeno»; `select.input` y `textarea.input` con los estilos de `.input`; contador de caracteres.
- **Diálogo con error** (`.warn.is-danger`) para el 409 dentro del diálogo.

## Capturas (`previews/`)

Cada una en `-desktop.png` (1440x900) y `-mobile.png` (390x844):
`categorias`, `categorias-creada`, `categorias-carga`, `categorias-vacio`, `categorias-error`, `categoria-form`, `categoria-form-editar`, `categoria-form-duplicado`, `categoria-form-red`, `categoria-eliminar`, `categoria-eliminar-subcategorias`, `categoria-eliminar-productos`, `ingredientes`, `ingredientes-carga`, `ingredientes-vacio`, `ingredientes-error`, `ingrediente-form`, `ingrediente-form-editar`, `ingrediente-form-duplicado`, `ingrediente-eliminar`, `ingrediente-eliminar-sin-uso`; más `drawer-admin-mobile.png` (panel abierto en mobile con la sección «Administración»).

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Para capturas del panel: `?nav=drawer`.
3. Re-render: headless Edge (`--headless=old`, `--force-prefers-reduced-motion`, `--virtual-time-budget=4000`) con `--window-size=1440,900`; para 390 px, un HTML contenedor con un iframe de 390x844 en una ventana de 390x1100 y luego recorte a 844 px de alto (en una ventana de 844 px el headless no pinta el texto de los elementos fijos cercanos al borde inferior: toasts y botones de la hoja). Playwright MCP no estaba disponible en esta máquina (falta el canal Chrome).

## Fuentes

- `design-system/README.md` (Revision 2), `components.html`, `tokens.css`, `brand.md`
- Mockups aprobados de C-13a (shell admin), C-15 (formulario, diálogo de baja) y C-16b (`mockup.css`/`mockup.js`, estados, marca de alérgeno)
- `knowledge-base/06_funcionalidades.md` US-009/US-011, `05_reglas_de_negocio.md` RN-CA-01..03, `03_actores_y_roles.md` (matriz RBAC)
- `backend/app/modules/categorias/`, `ingredientes/`, `unidades_medida/` (contrato real), `backend/app/db/seed.py`; `proposal.md`, `design.md` y spec `frontend-admin-catalog` de este change
