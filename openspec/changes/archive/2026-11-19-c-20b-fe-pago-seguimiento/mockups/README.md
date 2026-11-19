# Mockups C-20b — Seguimiento del pago y estado en la confirmación

- Design system revision: 2
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, headless Microsoft Edge desde `file://`, 1440x900 y 390x844 en iframe, con «reducir movimiento»; Playwright MCP no se usó: sin Chrome)

Extiende los mockups aprobados de C-20a (misma página de pago) y C-19 (confirmación del pedido). Respuestas del usuario (2026-11-19): OQ-2 = consulta cada 5 s hasta 2 min; OQ-7 = sí, la confirmación muestra la línea de pago. Los valores 5 s / 2 min están en las constantes `INTERVALO_S` y `TOPE_MIN` de `pago-pedido.html`.

## Pantallas y estados

`pago-pedido.html?estado=…` (página de pago `/finalizar-compra/pedido/58/pago`)

| estado | Qué muestra |
|---|---|
| `cargando-estado` | Al abrir/recargar: «Verificando el estado de tu pago…», sin brick |
| `conexion-estado` | Error de red al consultar el pago, con «Reintentar» |
| `recarga-aprobado` | Recarga tras aprobado: «¡Pago aprobado!» con N.º de operación del servidor |
| `recarga-rechazado` | Recarga tras rechazo: motivo del servidor + «Intentar de nuevo» |
| `recarga-pendiente` | Recarga con pago pendiente: mismo seguimiento que `pendiente` |
| `pendiente` | Seguimiento: indicador giratorio + texto «Verificando el pago…» (región `role=status`, se actualiza cada 5 s) |
| `pendiente-aprobado` | Transición a aprobado (aviso «Mercado Pago confirmó tu pago.») |
| `pendiente-rechazado` | Transición a rechazado (aviso + motivo + reintento) |
| `pendiente-a-devolver` | Transición a `a_devolver` (sin stock) |
| `demorando` | Tope de 2 min: «La confirmación está demorando», «Actualizar» y «Ver mi pedido» |

`pedido-creado-pago.html?pago=…` (confirmación `/finalizar-compra/pedido/58`, pedido MERCADOPAGO)

| pago | Línea | CTA |
|---|---|---|
| `sin-intentos` | sin línea (pendiente de pago) | «Pagar $ 3.850 con tarjeta» |
| `en-confirmacion` | «Pago en confirmación» | no (enlace «Ver el estado del pago») |
| `aprobado` | «Pago aprobado» (pedido Confirmado) | no |
| `rechazado` | «Último intento de pago: rechazado» + motivo | «Reintentar el pago de $ 3.850» |
| `a-devolver` | «Pago aprobado, a devolver» (pedido Cancelado) | no |

## Cómo verlos

1. Abrir `pago-pedido.html` o `pedido-creado-pago.html` con doble clic (`file://`); el selector «Estados del mockup» al pie cambia de estado. `?nav=collapsed|drawer` como en C-20a.
2. Re-render: `sh render.sh` desde esta carpeta (Edge headless) → `previews/*-desktop.png` y `*-mobile.png`.

Notas: los estados del formulario/brick y errores de `crear` son los de C-20a (sin cambios). Los textos de la región en vivo y de las líneas salen de design.md D2/D3.
