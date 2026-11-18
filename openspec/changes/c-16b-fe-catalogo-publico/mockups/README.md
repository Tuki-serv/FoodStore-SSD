# Mockups — C-16b `fe-catalogo-publico`

> Creados en `openspec/changes/c-16-fe-catalogo-publico/mockups/` y movidos intactos aquí cuando C-16 se partió en C-16a (backend) y C-16b (este change, frontend) el 2026-11-18. Los títulos y franjas de los HTML (y las capturas) dicen «Mockup C-16»: se refieren a C-16b.

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: pending
- Preview: rendered (2026-11-18, headless Microsoft Edge desde `file://`, 1440x900 y 390x844, con «reducir movimiento»)

## Brief

- **Audiencia**: cualquier visitante, con o sin sesión (la ruta `/catalogo` es pública y es el destino de `/`). Los mockups muestran a la usuaria de ejemplo «Lucía Pérez» (`CLIENT`); `catalogo-carga.html` muestra la variante sin sesión (panel con «Ingresar» y «Registrarse», sin carrito en la barra superior).
- **Tarea**: encontrar rápido algo para pedir (por categoría, nombre, precio o solo lo que hay en stock), entender qué tiene cada producto —sobre todo los alérgenos— y sumarlo al carrito.
- **Pantallas y estados**: catálogo con datos y filtrado, esqueleto de carga, sin resultados con filtros, catálogo sin productos, error del listado, filtros con error de rango (columna en desktop / hoja en mobile), detalle con alérgenos, detalle agotado, producto no disponible.
- **Tamaños**: 1440x900 y 390x844 (breakpoint del shell 1024 px: bajo eso la columna de filtros pasa a chips + hoja «Filtros»; bajo 720 px la grilla es de 2 columnas y el detalle tiene la barra de compra fija abajo).
- **Tokens y assets**: `design-system/tokens.css` y `brand.js` importados; logo provisional `design-system/assets/logo.svg`. Shell copiado sin cambios de los mockups aprobados de C-15/C-13b.
- **Restricciones**: datos según el contrato real (`precio_base` string decimal, `stock_cantidad`, `categorias` con `es_principal`, `ingredientes` con `es_alergeno`); productos y categorías del seed (`backend/app/db/seed.py`) más seis productos ilustrativos para llenar una página de 12 (Burger Doble Cheddar, Flan Casero, Brownie con Helado, Volcán de Chocolate, Agua Mineral, Sprite: no están en el seed); textos en español rioplatense; animaciones cortas `ease-out` y quietas con «reducir movimiento».

## Pantallas

| Archivo | Qué muestra | Parámetros |
|---------|-------------|------------|
| `catalogo.html` | Desktop: columna «Categorías / Precio / Disponibilidad», buscador, «20 productos», 12 tarjetas (normal, «Quedan 4», «Quedan 2», «Agotado» con botón deshabilitado, sin imagen —Coca-Cola—, precio con centavos «$ 1.250,50»), paginación «Página 1 de 2» y toast «Agregado al carrito». Mobile: buscador, chips de categorías raíz desplazables y botón «Filtros», grilla de 2 columnas. | `?estado=filtrado` («Hamburguesas» con subcategorías + precio $ 1.000 – $ 2.000: chips de filtros activos, «Limpiar filtros», sin paginación); `?nav=expanded\|collapsed\|drawer` |
| `catalogo-carga.html` | Esqueleto de 6 tarjetas (`aria-busy`) con el árbol ya cargado; visitante sin sesión. | — |
| `catalogo-vacio.html` | «No encontramos productos» con «sushi» + «Solo con stock», chips y «Limpiar filtros». | `?estado=sin-productos` («Todavía no hay productos», sin acción); `?estado=error` («No pudimos cargar los productos» + «Reintentar», árbol visible con «Bebidas» elegida) |
| `catalogo-filtros.html` | «Veganas» elegida (su padre «Hamburguesas» en tono de acento) y rango inválido 3000/1000 con «El mínimo no puede superar al máximo». Desktop: en la columna. Mobile: hoja «Filtros» abierta (árbol completo, precio, disponibilidad; pie «Limpiar» / «Ver 1 producto»). | — |
| `producto-detalle.html` | «Volver al catálogo», imagen, categoría principal, nombre, «$ 1.500» + «Quedan 3», descripción, selector de cantidad y «Agregar al carrito · $ 3.000», aviso «Contiene alérgenos», ingredientes con marca «Alérgeno». Mobile: barra de compra fija abajo. | `?estado=agotado` (Burger BBQ Bacon: «Agotado», imagen atenuada, sin selector, botón deshabilitado); `?estado=no-disponible` («Este producto no está disponible» + «Ver el catálogo») |

Las anotaciones (franja amarilla) no son parte de la app. `catalogo.js` solo arma los datos de ejemplo y repite tarjetas/árbol entre mockups.

## Cambios respecto del design system

- **Íconos nuevos, requieren revisión**: `i-buscar`, `i-filtros`, `i-menos`, `i-volver`, `i-plato` (marcador de foto) en `mockup.js`, mismo trazo que el sprite de `components.html`.
- **Tarjeta de producto**: la `.card` de `components.html` con imagen 3:2 (en vez de 4:3, para ver más productos sobre el pliegue), categoría en versalitas, descripción a 2 líneas, toda la tarjeta clicable (enlace en el nombre) y el botón «Agregar» con ícono. «Agotado» usa `b-cancelado` (el ejemplo del design system decía «No disponible»: para el público un no disponible no se lista, así que la marca visible es «Agotado» por stock 0); «Quedan N» usa `b-pendiente`.
- **Marcador de foto** (`.ph`): fondo con tokens `*-soft`/`*-bg` y el ícono `i-plato`; lo reemplaza la foto de Cloudinary cuando existe. Sin imagen → variante neutra.
- **Árbol de categorías** (`.tree-item`): mismo lenguaje que `.nav-item` del panel (fondo `--color-primary-soft` y barra izquierda en la actual).
- **Componentes nuevos con tokens existentes**: chips de filtro (`.chip`), chips de categoría mobile (`.pill`, con fundido al borde para indicar scroll), interruptor «Solo con stock» (`.switch`, `--color-accent`), campo de precio con prefijo `$`, buscador con ícono y «Borrar búsqueda», hoja inferior (`.modal.sheet`, sobre el diálogo de C-15), selector de cantidad (`.qty` de `components.html`), aviso de alérgenos (`.allergen-note`) y lista de ingredientes en píldoras.

## Capturas (`previews/`)

| Captura | Tamaño |
|---------|--------|
| `catalogo-desktop.png` / `catalogo-mobile.png` | 1440x900 / 390x844 |
| `catalogo-completo-desktop.png` (página entera: agotado, precio con centavos y paginación) | 1440x2080 |
| `catalogo-filtrado-desktop.png` / `catalogo-filtrado-mobile.png` | 1440x900 / 390x844 |
| `carga-desktop.png` / `carga-mobile.png` | 1440x900 / 390x844 |
| `vacio-desktop.png` / `vacio-mobile.png` | 1440x900 / 390x844 |
| `sin-productos-desktop.png` / `sin-productos-mobile.png` | 1440x900 / 390x844 |
| `error-desktop.png` / `error-mobile.png` | 1440x900 / 390x844 |
| `filtros-desktop.png` / `filtros-mobile.png` | 1440x900 / 390x844 |
| `detalle-desktop.png` / `detalle-mobile.png` | 1440x900 / 390x844 |
| `detalle-agotado-desktop.png` / `detalle-agotado-mobile.png` | 1440x900 / 390x844 |
| `no-disponible-desktop.png` / `no-disponible-mobile.png` | 1440x900 / 390x844 |

## Cómo previsualizar

1. Abrir cualquier `.html` directamente en el navegador (sin servidor). Las rutas a `design-system/` son relativas: `../../../../design-system/` (al archivar el change pasan a `../../../../../`).
2. Mobile: ventana de menos de 1024 px; menú con «Abrir menú». Para capturas del panel: `?nav=drawer`.
3. Re-render: headless Edge con `--screenshot`, `--force-prefers-reduced-motion` (sin él la hoja se captura a mitad de su animación de entrada) y `--window-size=1440,900`; para 390 px, un HTML contenedor con un iframe de 390x844 y `--window-size=390,844`.

## Fuentes

- `design-system/README.md` (Revision 2), `design-system/components.html` (tarjeta de producto, `.qty`, `.skel`, `.state`), `design-system/tokens.css`, `design-system/brand.md`
- Mockups aprobados de C-15 (`mockup.css`, `mockup.js`, diálogo y toasts) y C-13b
- `knowledge-base/06_funcionalidades.md` US-007/US-008, `knowledge-base/05_reglas_de_negocio.md` RN-PR-02..04, RN-CA-05
- `backend/app/modules/productos/` y `categorias/` (contrato real), `backend/app/db/seed.py`; `design.md` y spec `frontend-catalog` de este change; spec `catalog-search` y decisiones DU-1..DU-3 de `openspec/changes/c-16a-backend-catalogo-filtros/`
