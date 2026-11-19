# Mockups C-20a `fe-pago-tarjeta`

- Design system revision: 2
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, headless Microsoft Edge desde `file://`, 1440x900 y 390x844 en iframe, con «reducir movimiento»; Playwright MCP no se usó: sin Chrome)

## Brief

- **Audiencia/tarea**: cliente logueado (`CLIENT`) que acaba de crear un pedido `MERCADOPAGO` y lo paga con tarjeta en `/finalizar-compra/pedido/:pedidoId/pago`.
- **Pantallas**: una sola ruta, con la vista derivada del pedido y del último resultado de pago (design D4). Shell con panel lateral (DD-25), resumen del pedido a la derecha (una columna en mobile), tokens de `design-system/tokens.css` y `brand.js`.
- **Brick**: el recuadro punteado «Formulario de Mercado Pago (simulado)» es una maqueta de lo que dibuja `CardPayment`; sus colores y tipografía son de Mercado Pago, no del sistema. Food Store no ve ni guarda los datos de la tarjeta.
- Marca provisional (TBD) según el design system. Los íconos usados salen del sprite de C-19.

## Archivos

- `pago-pedido.html?estado=<estado>`: todas las vistas; al pie hay un selector de estados.
- `mockup.css`, `mockup.js`, `checkout.js`: copiados de C-19 (shell y helpers). `pago-pedido.css`: estilos propios de este change.
- `previews/pago-<estado>-desktop.png` (1440x900) y `-mobile.png` (390x844).

## Estados (`?estado=`)

| Estado | Qué muestra |
|---|---|
| `formulario` | Formulario listo (brick, total $ 2.850) |
| `cargando` | «Cargando el formulario de tarjeta…» |
| `procesando` | «Procesando el pago…», brick bloqueado |
| `brick-error` | «No pudimos cargar el formulario de tarjeta» + Reintentar |
| `aprobado` | «¡Pago aprobado!» + Ver mi pedido / Seguir comprando |
| `rechazado` (`&motivo=fondos\|datos\|codigo\|vencimiento\|emisor\|monto\|duplicado\|generico`) | «El pago fue rechazado» + motivo + Intentar de nuevo |
| `rechazado-datos` | Igual, con motivo genérico (400 del backend) |
| `a-devolver` | Pago aprobado pero pedido cancelado por stock; devolución manual (DD-20) |
| `pendiente` | «Estamos esperando la confirmación de Mercado Pago» (estático, sin polling) |
| `no-disponible` | 503: «El pago con tarjeta no está disponible en este momento» |
| `desconocido` | 502: «No pudimos confirmar el resultado con Mercado Pago» + Reintentar |
| `conexion` | Sin respuesta: «No pudimos conectarnos…» |
| `no-tarjeta`, `no-pagable`, `no-encontrado` | Nada que pagar / pedido no encontrado |

## Cómo verlo

1. Abrir `pago-pedido.html` desde `file://` (o con `?estado=aprobado`, etc.). Parámetro opcional `?nav=collapsed|drawer`.
2. Re-render: `msedge --headless=new --hide-scrollbars --force-prefers-reduced-motion --window-size=1440,900 --screenshot=<png> "file:///…/pago-pedido.html?estado=<estado>"`; para 390 px, un HTML contenedor con un iframe de 390x844 y `--window-size=390,844`.

## Preguntas abiertas de diseño

- Los textos de motivo del rechazo son los de la tabla corta de design D5; se ajustan tras la prueba en sandbox.
- En `a-devolver` el pedido figura «Cancelado» (DD-20); en `aprobado` figura «Confirmado».
