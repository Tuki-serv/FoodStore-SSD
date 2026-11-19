# Proposal — C-20b `fe-pago-seguimiento`

> Parte B de C-20 (`fe-pago-mercadopago`), partido por decisión del usuario el 2026-11-19 (OQ-5 = partir). **Depende de C-20a** `fe-pago-tarjeta` (página de pago, brick, `pagoQueries`, `vistaPago`, `motivoRechazo`): se aplica y archiva después de C-20a.

## Why

US-025 pide que la confirmación por webhook se refleje en la UI y US-026 que el cliente vea el estado de su pago con un motivo legible. C-20a deja la página de pago con el resultado **inmediato** de `POST /pagos/crear`: un pago `pendiente` muestra un mensaje estático que no se actualiza cuando llega el webhook, una recarga no reconstruye el resultado (tras un pago aprobado se ve «Este pedido ya no se puede pagar»; tras un rechazo, el formulario sin motivo) y la confirmación del pedido (`/finalizar-compra/pedido/:id`, C-19) no dice nada del pago. C-20b cierra esos huecos. Está en el camino crítico (`… → C-20a → C-20b → C-25b`).

Observado en el repo y en C-20a (2026-11-19):

- `GET /api/v1/pagos/{pedido_id}` → `{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (todo `null` salvo `pedido_id` si no hubo intentos); el webhook (C-05/C-12) deja el estado terminal en la base.
- C-20a define `pagoQueries.estado(pedidoId)` (`['pagos', pedidoId]`), `vistaPago(pedido, pago)` y `motivoRechazo(detalle)` en `@/entities/payment`, y la vista sale de esa caché; en C-20a la consulta no se dispara al montar.
- La confirmación del pedido es `pages/pedido-creado` (C-19), con el CTA «Pagar $ X con tarjeta» para `MERCADOPAGO` `PENDIENTE`.

## What Changes

- **Reconstrucción al recargar**: la página de pago consulta `GET /pagos/{pedido_id}` al montarse (solo pedidos `MERCADOPAGO`), así recargar muestra aprobado, rechazado con motivo, pendiente o `a_devolver` según el servidor.
- **Seguimiento del pendiente** (US-025): mientras la vista es `pendiente`, polling de `GET /pagos/{pedido_id}` cada 5 s hasta un estado terminal o un tope de 2 min (OQ-2); al pasar el tope, «La confirmación está demorando» con «Actualizar» y «Ver mi pedido». Al llegar a un estado terminal se corta el polling y se invalidan el detalle y la lista de pedidos.
- **Estado del pago en la confirmación** (US-026, OQ-7): para pedidos `MERCADOPAGO`, la confirmación del pedido muestra el último intento (rechazado con motivo, pendiente «Pago en confirmación») y mantiene el CTA «Pagar» mientras el pedido siga `PENDIENTE` y el pago no esté `pendiente` ni `aprobado`.
- **Sin cambios de backend** ni dependencias nuevas.

## Capabilities

### New Capabilities
_Ninguna_ (`frontend-payment` la crea C-20a).

### Modified Capabilities
- `frontend-payment`: se agregan «Reconstrucción de la vista al recargar», «Seguimiento del pago pendiente» y «Tope de espera del pago pendiente».
- `frontend-checkout`: se agrega «Estado del pago en la confirmación».

## Impact

- **Governance CRÍTICO** (pagos): solo propuesta; no se escribe código sin el OK explícito del usuario. Gate visual `[UI-MOCKUP]`: mockups aprobados antes de apply.
- **Frontend**: `src/pages/pago-pedido/` (consulta al montar y polling), `src/entities/payment/` (opciones de polling de `pagoQueries.estado`, si hace falta), `src/pages/pedido-creado/` (línea de estado del pago).
- **Backend**: sin cambios.
- **Secretos**: ninguno.
- **Pruebas**: Vitest + RTL + MSW con timers falsos para el polling; el doble de `@mercadopago/sdk-react` de C-20a. Prueba manual en sandbox (`CONT` → webhook) en verify, con el backend y ngrok del usuario.
