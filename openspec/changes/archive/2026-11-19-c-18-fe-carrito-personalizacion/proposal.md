# Proposal — C-18 `fe-carrito-personalizacion`

## Why

US-015 (Épica 4) pide un carrito persistente donde la persona agregue, quite, cambie cantidades y personalice ítems, y US-016 pide excluir ingredientes removibles de un producto. Hoy el `cartStore` ya existe y persiste (C-13b) y el catálogo ya agrega productos sin personalizar (C-16b), pero **no hay forma de ver el carrito**: `/carrito` muestra la página provisoria (dueño `C-18` en `route-map.ts`), el panel lateral no tiene contador de ítems (heredado de C-13a) y el detalle de producto no ofrece personalización. C-18 está en el camino crítico: C-19 (checkout) parte del carrito que deja este change.

Observado en el repo (`dev`, 2026-11-18):

- `@/entities/cart`: `useCartStore` con `agregar(producto, cantidad?, personalizacion?)`, `fijarCantidad(clave, n)`, `quitar(clave)`, `vaciar()`, `reset()`; `claveLinea(productoId, ids)` = `<id>:<ids ordenados>`; selectores `selectLineas`, `selectTotalItems`, `selectTotalPrecio` (en centavos enteros), `selectLinea(clave)`. Persistencia `foodstore.cart`, **versión 1**, `merge` que descarta datos inválidos. La línea guarda `personalizacion: number[]` (ids) pero **no los nombres** de los ingredientes excluidos.
- `@/shared/model` `uiStore` tiene `cartOpen`/`abrirCarrito`/`cerrarCarrito` (solo estado, nadie lo dibuja), `notificar` (toasts) y `pedirConfirmacion` (diálogo global ya dibujado por el shell desde C-15).
- `RUTAS.carrito = '/carrito'` con acceso `sesion`; el ítem «Carrito» ya está en la navegación de todo rol con sesión.
- `BotonAgregarAlCarrito` (`@/features/agregar-al-carrito`) agrega siempre sin personalización. `Producto.ingredientes[]` trae `es_removible` y `es_alergeno` (C-16b/C-17b).
- El design system (Revision 2) ya define `.cartitem`, `.qty`, `.count` (en el ítem del panel, en el panel colapsado y en un `icon-btn` de carrito en la barra superior mobile) y el estado vacío «Tu carrito está vacío».
- Backend: `POST /pedidos/` recibe `personalizacion: int[]` por ítem, rechaza líneas duplicadas (producto + personalización) y guarda el snapshot de nombres (DD-05, RN-PE-09). **No** valida que los ids sean ingredientes removibles del producto.

## What Changes

- **Página «Carrito»** (`/carrito`, con sesión): lista de líneas (imagen, nombre, ingredientes excluidos «Sin cebolla, sin tomate», precio unitario, selector de cantidad, subtotal de la línea, «Quitar»), resumen con unidades e importe total, «Vaciar carrito» con confirmación, estado vacío con «Ver catálogo». Reemplaza la página provisoria.
- **Personalización en el detalle de producto** (US-016): si el producto tiene ingredientes removibles y stock, una sección «Personalizá tu pedido» permite marcar «Sin <ingrediente>»; «Agregar al carrito» suma la línea con esa personalización (misma personalización → misma línea; otra → línea nueva). La tarjeta del catálogo sigue agregando sin personalizar.
- **Contador del carrito** (heredado de C-13a): badge `.count` con las unidades del carrito en el ítem «Carrito» del panel lateral (también colapsado) y un botón de carrito con contador en la barra superior mobile; oculto con el carrito vacío; suscripción por *slice* al store.
- **Store del carrito**: la línea guarda también los **nombres** de los ingredientes excluidos (snapshot del momento de agregar, en el espíritu de DD-05) para mostrarlos sin consultar al servidor; la persistencia pasa a **versión 2** con migración desde v1 (sin pérdida de líneas). Nuevo helper de subtotal de línea en centavos.
- **Docs al cerrar**: KB/06 (US-015, US-016), KB/08 (estado del cliente: `cartStore` v2), `frontend/README.md`, `CHANGES.md` (cierre de C-18 y «Punto de partida (C-18)» para C-19).

**Fuera de alcance (con dueño):** checkout, dirección, forma de pago y creación del pedido (C-19), incluido el botón para continuar al checkout (ver design OQ-5); validar el stock acumulado del carrito y refrescar precios contra el servidor (C-19: la creación del pedido lo resuelve); editar la personalización de una línea existente (se quita y se vuelve a agregar; ver design OQ-3); drawer lateral de carrito (ver design OQ-1); validación backend de que los ids de `personalizacion` sean removibles del producto (deuda backend, se registra como riesgo).

## Capabilities

### New Capabilities
- `frontend-cart`: pantalla del carrito en el frontend — listado de líneas con su personalización, cambio de cantidades, quitar y vaciar, totales, estado vacío y contador de ítems en la navegación.

### Modified Capabilities
- `frontend-client-stores`: la línea del carrito guarda los nombres de los ingredientes excluidos y la persistencia migra de la versión 1 a la 2 sin perder líneas; nuevo subtotal por línea.
- `frontend-catalog`: «Agregar al carrito» del detalle suma la personalización elegida (antes: siempre sin personalización); nuevo requisito de selección de ingredientes removibles en el detalle.

## Impact

- **Código nuevo** (`frontend/src/`): `pages/carrito/` (`ui/`, `model/`, `index.ts`), `entities/cart/ui/` (contador y presentación de línea), selector de personalización en `features/agregar-al-carrito/ui/`, fixtures de test que hagan falta.
- **Código modificado**: `entities/cart/model/cart-store.ts` (nombres excluidos, persistencia v2, subtotal de línea), `entities/producto/model/producto.ts` (helper de ingredientes removibles), `features/agregar-al-carrito` (prop de personalización, texto del toast), `pages/producto/ui/detalle-producto.tsx` (sección de personalización), `app/layouts/app-shell/` (`nav-sections.tsx`, `topbar.tsx`: contador), `app/router/routes.tsx` (`/carrito` monta la página real), `app/styles/index.css` (import del CSS de la página).
- **Backend**: ninguno. **Dependencias de paquetes**: ninguna nueva. **Dependencias de changes**: C-16b (cerrado).
- **Governance MEDIO**: implementar con checkpoints; gate de mockups aprobados antes de `/opsx:apply` (`[UI-MOCKUP]`, política `system-and-mockups`).
