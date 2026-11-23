# Proposal — `revision-visual` (C-25b0, ajuste extra antes de la entrega)

## Why

En la revisión de la aplicación (2026-11-23) el usuario la encontró prolija pero poco profesional, con aspecto genérico. Nuestra propia crítica de diseño identificó las causas: beige cálido en todas las superficies; ninguna foto de producto (los productos del seed apuntan a `via.placeholder.com`, que no responde, y todas las tarjetas caen al mismo ícono de cubiertos sobre degradés de colores distintos); tipografía del sistema con jerarquía de pesos plana; todo contenedor es la misma tarjeta redondeada (sin jerarquía de superficies); exceso de pastillas y badges teñidos; el logo muestra «LOGO PROVISIONAL (TBD)» en el panel lateral; sin respuesta al presionar, hover ni entrada escalonada; y un catálogo de grilla uniforme con «Agregar» repetido y sin punto focal. Hay que corregirlo **antes** de las capturas y el video de C-25b (tareas 2.2, 3.1, 3.2 y 4.2 en espera), porque esa evidencia se graba una sola vez.

## What Changes

- Aplicar al frontend el **design system Revision 4** (lo redacta en paralelo `design-system/`, queda `Approval: pending` hasta el OK del usuario; este change no lo edita, lo consume):
  - Fuentes de display y de texto **autoalojadas** (`@fontsource-variable/*`, ya en `package.json`) cableadas con `@font-face` en el frontend, sin pedidos a servicios de fuentes externos; numerales tabulares en precios, cantidades y totales.
  - Nuevos valores de tokens (superficies más neutras con un único acento cálido) sin literales en `frontend/` (la regla «tokens como única fuente visual» sigue vigente).
  - **Jerarquía de superficies**: se reemplazan las cajas-tarjeta por divisores y espaciado donde no aportan (filtros del catálogo, resumen del checkout, bloques de detalle, paneles admin); la tarjeta queda para objetos (producto, pedido).
  - Logo original (isotipo + wordmark) y favicon nuevos en el shell; se quita «(TBD)»/«LOGO PROVISIONAL» de la interfaz; isotipo en el panel colapsado.
  - **Disciplina de badges**: los badges quedan para estados (pedido, pago, stock); categorías y metadatos pasan a texto.
  - **Micro-interacciones**: `:active` con escala sutil en controles presionables, hover solo en `(hover: hover)`, entrada escalonada solo en el primer montaje de listas, todo anulado con `prefers-reduced-motion: reduce`.
- **Tarjeta de producto del catálogo**: jerarquía más clara (nombre, precio en la fuente de display con numerales tabulares), sin chip de categoría repetido (la categoría pasa a texto y se omite cuando el listado ya está filtrado por ella), un único estilo de marca de stock, ícono de alérgeno del sprite cuando corresponde, y un **respaldo de imagen tipográfico** (inicial grande sobre el color de marca único) en lugar de los degradés multicolores.
- **Imágenes del seed**: los productos de demostración dejan de apuntar a un host de marcadores externo; según la decisión abierta OQ-1 apuntan a fotos locales con licencia que permite redistribución o quedan sin imagen (respaldo tipográfico).
- Re-render de los mockups de las pantallas afectadas bajo Revision 4 y aprobación del usuario **antes** del apply (política `system-and-mockups`).
- Fuera de alcance (posibles follow-ups, no se planifican): modo oscuro (declinado por ahora), página de inicio/landing, rediseño «cockpit» del dashboard admin, toasts globales de errores HTTP.

## Capabilities

### New Capabilities
- `frontend-visual-language`: reglas visuales transversales verificables del frontend: fuentes autoalojadas, numerales tabulares en importes, disciplina de badges y movimiento (respuesta al presionar, hover solo con puntero, entrada escalonada en el primer montaje, movimiento reducido).

### Modified Capabilities
- `frontend-catalog`: «Listado del catálogo» (categoría como texto, omitida si ya se filtra por ella; alérgeno con ícono), «Estado de stock visible» (un único estilo de marca), «Imagen del producto con respaldo» (respaldo tipográfico con inicial y color único).
- `frontend-app-shell`: «Panel lateral como navegación principal» (logo definitivo sin rótulo provisional; isotipo con el panel colapsado).
- `frontend-foundation`: «Ícono de la aplicación» (favicon derivado del logo de Revision 4, ya no provisional) y «Tokens del design system como única fuente visual» (incluye las fuentes autoalojadas).
- `backend-db-seed`: «Datos de demostración» (las imágenes de los productos de demostración no dependen de un host externo).

## Impact

- **Frontend** (`frontend/src/`): `app/styles/index.css` (fuentes), CSS de `entities/producto/ui`, `pages/catalogo`, `pages/producto`, `pages/carrito`, `pages/finalizar-compra`, `pages/pago-pedido`, `pages/mis-pedidos`, `pages/gestion-pedidos`, páginas admin, `app/layouts/app-shell` (logo, isotipo), `shared/ui` (botón, estados, badges), `index.html` (favicon). Tests de arquitectura (`tests/architecture/tailwind-tokens`, `favicon`, `styles-compile`) y de componentes con axe.
- **Design system**: consume `design-system/` Revision 4 (tokens, fuentes, logo, favicon) sin editarlo; bloqueado hasta su aprobación.
- **Backend**: solo `backend/app/db/seed.py` (URLs de imágenes de demostración) y, si OQ-1 elige fotos locales, los archivos de imagen con su licencia; sin migraciones, sin cambios de API.
- **Roadmap**: nuevo ajuste extra `[C-25b0] revision-visual` en `CHANGES.md`; C-25b pasa a depender de él para capturas y video.
- **Governance**: MEDIO/BAJO (visual); `[UI-MOCKUP]` con aprobación de Revision 4 y de los mockups antes del apply.
