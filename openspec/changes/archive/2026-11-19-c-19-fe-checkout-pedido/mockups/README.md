# Mockups — C-19 `fe-checkout-pedido`

- Design system: Revision 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14). Los mockups importan `../../../../design-system/tokens.css` y `brand.js`; no copian valores.
- Approval: approved (2026-11-19, by user) — incluye los defaults de OQ-1..OQ-6
- Preview: rendered (2026-11-19, `previews/`, 1440x900 y 390x844, página completa; Edge + playwright-core porque el Playwright MCP no tenía Chrome instalado; sin errores de consola)
- Fotos de producto: marcadores `(TBD)` (igual que C-16b/C-18). Dirección del local para retiro: `(TBD)`.

## Brief

Cliente (`CLIENT`) con productos en el carrito que finaliza la compra: elige dónde lo recibe (dirección guardada o retiro en el local), cómo paga (tarjeta con Mercado Pago, efectivo o transferencia) y confirma. El pedido se crea `PENDIENTE` con un único POST. Efectivo/transferencia: el local confirma el pago a mano (DD-22), sin formulario de tarjeta. Mercado Pago: la confirmación ofrece «Pagar $ X con tarjeta», que lleva al punto de traspaso de C-20. Envío fijo $ 50 y descuento $ 0 (DD-10; PA-11/PA-13 abiertas). El stock se verifica pero no se reserva (DD-20).

## Pantallas y estados

| Archivo | Estado | Qué muestra |
|---------|--------|-------------|
| `carrito-checkout.html` | por defecto | Carrito de C-18 + nota de envío $ 50 + «Finalizar compra» |
| `carrito-checkout.html?rol=admin` | sin rol CLIENT | Sin CTA; «Solo las cuentas de cliente pueden hacer pedidos» |
| `finalizar-compra.html` | por defecto | Entrega (principal preseleccionada), forma de pago sin elegir, «Agregar una nota», resumen con líneas, subtotal, envío, descuento, total estimado, notas de precios y stock, «Confirmar pedido» |
| `?estado=validacion` | validación | «Elegí una forma de pago» en el paso 2 (borde de error) |
| `?estado=efectivo` / `transferencia` | DD-22 | Nota «Confirmación manual»; sin campos de tarjeta |
| `?estado=mercadopago` | traspaso | Nota «Pago en el paso siguiente» |
| `?estado=retiro` | sin direcciones | «No tenés direcciones guardadas», retiro elegido, «Tarifa fija por pedido, también con retiro» (PA-13) |
| `?estado=nota` | notas | Paso 3 «Notas para el local» (máx. 300, contador) |
| `?estado=enviando` | enviando | Campos deshabilitados, «Creando pedido…» con spinner |
| `?error=stock` · `no-disponible` · `no-encontrado` · `duplicado` | error | Aviso «No pudimos crear el pedido» con el mensaje del servidor + «Revisar carrito» (foco en el aviso) |
| `?error=forma-pago` | error | Aviso + «Elegí otra forma de pago»; error en el grupo de pago con la forma aún marcada |
| `?error=red` | error | «No pudimos conectar con el servidor.» + «Reintentar» |
| `pedido-creado.html?forma=EFECTIVO` | confirmación | «Pedido #57 recibido», «¿Qué sigue?» (3 pasos de confirmación manual), detalle, resumen con totales del servidor, aviso de falta de stock, «Ver mis pedidos» / «Seguir comprando» |
| `pedido-creado.html?forma=TRANSFERENCIA&estado=retiro` | confirmación | Transferencia («El local te indica los datos para transferir», OQ-5) con retiro en el local |
| `pedido-creado.html?forma=MERCADOPAGO` | traspaso | «Falta el pago» + «Pagar $ 3.850 con tarjeta» → `pago-provisorio.html` |
| `pedido-creado.html?forma=EFECTIVO&estado=precios` | precios | Aviso «Los precios se actualizaron» (total del servidor ≠ estimado) |
| `pedido-creado.html?estado=no-encontrado` | 404/403 | «No encontramos este pedido» + «Ver catálogo» |
| `pago-provisorio.html` | provisoria | `/finalizar-compra/pedido/58/pago`: página provisoria con dueño C-20 |

Parámetros extra de las páginas con shell: `?nav=collapsed` y `?nav=drawer`.

## Fuentes

- `design-system/components.html` (Revision 2): `.opt`, `.summary`, `.badge` de estado (`--state-pendiente-*`), `.toast`, `.state`.
- `archive/2026-11-17-c-15-fe-direcciones/mockups/selector-checkout.html` (pasos y selector de dirección pensados para C-19) y `archive/2026-11-19-c-18-fe-carrito-personalizacion/mockups/` (`mockup.css`, `mockup.js`, `carrito.js` → `checkout.js`).
- `design.md` (D1–D11, OQ-1..OQ-6) y specs `frontend-checkout`, `frontend-cart` de este change.
- Íconos nuevos (`(TBD)` para sumarse al sprite del design system): `i-ok`, `i-tarjeta`, `i-efectivo`, `i-transferencia`, `i-reloj`, `i-info`.

## Cómo verlos

Abrir cada `.html` desde el explorador (`file://`) o servir la carpeta con cualquier servidor estático. Capturas en `previews/<pantalla>-<desktop|mobile>.png`.

## Preguntas abiertas

OQ-1..OQ-6 en `design.md` §Open Questions (defectos ya reflejados en estos mockups).
