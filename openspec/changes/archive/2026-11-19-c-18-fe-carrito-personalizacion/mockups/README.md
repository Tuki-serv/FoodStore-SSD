# Mockups — C-18 `fe-carrito-personalizacion`

- Design system: Revision 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14). Los mockups importan `../../../../design-system/tokens.css` y `brand.js`; no copian valores.
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, `previews/`, 390x844 y 1440x900, página completa salvo los estados con diálogo/toast, que son de viewport)
- Fotos de producto: marcadores `(TBD)` (igual que C-16b). Los productos marcados con `*` son ilustrativos (no están en el seed).

## Brief

Cliente con sesión que revisa su carrito, ajusta cantidades, quita líneas o lo vacía, y que personaliza un producto («sin cebolla») desde el detalle. Una hamburguesa personalizada y la misma sin personalizar son líneas distintas. El carrito es estado de cliente: no hay envío ni precio final hasta C-19 (no hay botón de checkout).

## Pantallas y estados

| Archivo | Estado | Qué muestra |
|---------|--------|-------------|
| `carrito.html` | por defecto | 4 líneas (una personalizada «Sin cebolla, sin tomate», la misma hamburguesa sin personalizar, una sin imagen, una con precio decimal), stepper con «−» deshabilitado en 1, subtotal por línea, «Quitar», «Vaciar carrito», resumen (unidades, total, nota de envío y precios) lateral en desktop y debajo en mobile |
| `carrito.html?estado=vaciar` | diálogo | «¿Vaciar el carrito?» (acción destructiva: «Vaciar» / «Cancelar») |
| `carrito.html?estado=quitado` | toast | «Quitado del carrito» tras quitar la línea sin personalizar; contador 6 |
| `carrito.html?estado=sin-nombres` | línea migrada | «Sin 2 ingredientes» (carrito v1 sin nombres de exclusiones) |
| `carrito-vacio.html` | vacío | «Tu carrito está vacío» + «Ver catálogo»; sin resumen, sin «Vaciar carrito», sin contador |
| `producto-personalizar.html` | por defecto | Detalle con «Personalizá tu pedido»: una casilla «Sin X» por ingrediente removible, «Queso Cheddar» con marca «Alérgeno», «Cebolla» marcada; cantidad y «Agregar al carrito»; en mobile la sección queda en el flujo y la barra de compra fija |
| `producto-personalizar.html?estado=agregado` | toast | «Agregado al carrito — 1 × Hamburguesa Clásica, sin cebolla»; las casillas se mantienen (OQ-6); contador 3. En mobile el toast sube sobre la barra de compra |
| `navegacion-contador.html` | especimen | Contador en panel expandido, panel colapsado (badge sobre el ícono) y barra superior mobile con botón de carrito |
| `navegacion-contador.html?carrito=vacio` | sin número | Mismos tres lugares sin badge |

Parámetros extra de las páginas con shell: `?nav=collapsed` y `?nav=drawer` (panel lateral, heredados de C-16b).

## Fuentes

- `design-system/components.html` (Revision 2): `.cartitem`, `.qty`, `.count`, `.toast`, `.summary`, estados vacíos.
- `openspec/changes/c-18-fe-carrito-personalizacion/design.md` (D1–D10, OQ-1..OQ-7) y specs `frontend-cart`, `frontend-client-stores`, `frontend-catalog`.
- Base copiada de `archive/2026-11-18-c-16b-fe-catalogo-publico/mockups/` (`mockup.css`, `mockup.js` con el contador parametrizable por `window.MOCK_COUNT`); `carrito.js` arma el shell y los datos de ejemplo. Íconos nuevos: ninguno (se usan `i-basura`, `i-mas`, `i-menos`, `i-volver`, `i-carrito`, `i-plato` ya presentes).

## Cómo verlos

Abrir cada `.html` desde el explorador (`file://`) o servir la carpeta con cualquier servidor estático. Capturas en `previews/<pantalla>-<mobile|desktop>.png`.

## Preguntas abiertas (OQ-1..OQ-7)

Resueltas por el usuario el 2026-11-19 aceptando todos los defectos; ver `design.md` §Open Questions.
