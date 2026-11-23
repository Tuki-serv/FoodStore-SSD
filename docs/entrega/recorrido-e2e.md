# Recorrido de punta a punta (compra → pago → entrega)

Guion verificable del flujo completo con el frontend sobre el stack local (backend en `http://localhost:8000`, frontend en `http://localhost:5173`, base sembrada con `python -m app.db.seed`). Cubre los escenarios «Recorrido de punta a punta verificado» de la capability `project-delivery`. Además existe el E2E de API automatizado `backend/tests/integration/test_flujo_compra_pago_entrega.py` (`pytest -m e2e`).

Cuentas del seed (solo desarrollo): `cliente@foodstore.com` / `cliente123` (CLIENT), `pedidos@foodstore.com` / `pedidos123` (PEDIDOS), `admin@foodstore.com` / `Admin1234!` (ADMIN).

Estado de ejecución: **sin ejecutar** (en espera de la revisión de la aplicación por el usuario). Cada tramo tiene un bloque «Resultado» para anotar fecha, cuentas y capturas.

## Tramo A — Efectivo hasta `ENTREGADO` (cuentas: `cliente@foodstore.com` y `pedidos@foodstore.com`)

| Paso | Quién | Acción en la UI | Resultado esperado |
|------|-------|-----------------|--------------------|
| A1 | cliente | Ingresar en `/ingresar` con `cliente@foodstore.com` | Redirige al catálogo con la sesión iniciada |
| A2 | cliente | En `/catalogo`, filtrar por una categoría, abrir un producto (`/catalogo/:id`), quitar un ingrediente removible y agregarlo al carrito | Toast de confirmación; el carrito muestra el producto con su personalización |
| A3 | cliente | En `/carrito`, ajustar la cantidad y pulsar «Finalizar compra» | Abre `/finalizar-compra` |
| A4 | cliente | Elegir una dirección propia (o crear una en `/direcciones`) y la forma de pago `EFECTIVO`; confirmar | Pantalla «Pedido creado» en `/finalizar-compra/pedido/:id`; estado `PENDIENTE`; total con el envío fijo de $50 |
| A5 | pedidos | En otra sesión, ingresar con `pedidos@foodstore.com` y abrir `/gestion-pedidos` | El pedido aparece en la lista como `PENDIENTE` |
| A6 | pedidos | Abrir el detalle y confirmar el pago en efectivo | Estado `CONFIRMADO`; el stock se descuenta; el historial registra el cambio |
| A7 | pedidos | Pasar el pedido a preparación | Estado `EN_PREP` |
| A8 | pedidos | Despacharlo | Estado `EN_CAMINO` |
| A9 | pedidos | Entregarlo | Estado `ENTREGADO` (terminal) |
| A10 | cliente | Abrir `/mis-pedidos` y el detalle del pedido | Ve `ENTREGADO` con el historial completo (`PENDIENTE → CONFIRMADO → EN_PREP → EN_CAMINO → ENTREGADO`) |
| A11 | admin | Ingresar con `admin@foodstore.com` y abrir `/admin/dashboard` | El dashboard cuenta el pedido como venta (KPI de ventas, ingresos por forma de pago `EFECTIVO`, pedidos por estado) |

**Resultado:** pendiente (fecha, cuentas y capturas).

## Tramo B — Tarjeta sandbox hasta `CONFIRMADO` (cuenta: `cliente@foodstore.com`; lo ejecuta el usuario, CE-09)

Prerrequisitos: credenciales de prueba de MercadoPago en `backend/.env` (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`), `ngrok http 8000` y el webhook `<URL de ngrok>/api/v1/pagos/webhook` configurado en el panel de MercadoPago (evento «Order (Mercado Pago)»). Detalle en el README.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| B1 | Como cliente, armar un pedido nuevo y elegir la forma de pago `MERCADOPAGO` | Pedido `PENDIENTE`; pantalla de pago en `/finalizar-compra/pedido/:id/pago` con el formulario de tarjeta |
| B2 | Pagar con una tarjeta de prueba que aprueba el pago (titular `APRO`) | El formulario informa que el pago se procesa |
| B3 | Esperar la notificación del webhook (reintentar si MercadoPago demora) | El pedido pasa a `CONFIRMADO` sin intervención del gestor; el historial lo atribuye a «Sistema» |

**Resultado:** pendiente (anotar fecha, id de pago y captura).

## Tramo C — Cancelación con motivo (cuentas: `cliente@foodstore.com` y `pedidos@foodstore.com`)

| Paso | Quién | Acción | Resultado esperado |
|------|-------|--------|--------------------|
| C1 | cliente | Crear un pedido `EFECTIVO` y, desde `/mis-pedidos`, pulsar «Cancelar» mientras está `PENDIENTE` | Diálogo de confirmación con campo de motivo obligatorio |
| C2 | cliente | Ingresar un motivo y confirmar | Estado `CANCELADO`; el historial guarda el motivo; el stock no cambia (no se había descontado) |
| C3 | pedidos | Crear/usar otro pedido `CONFIRMADO` y cancelarlo desde `/gestion-pedidos` con motivo | Estado `CANCELADO`; el stock descontado se repone |

**Resultado:** pendiente.

## Verificación final

- Dashboard (`/admin/dashboard`) coherente con los pedidos de los tramos A y B (los `CANCELADO` no cuentan como venta).
- Las fechas del gestor y del dashboard son UTC (limitación conocida, ver README).
- Capturas de este recorrido: se guardan en `docs/entrega/capturas/` con el nombre `NN-<pantalla>-<viewport>.png` (tarea 3.1, pendiente).
