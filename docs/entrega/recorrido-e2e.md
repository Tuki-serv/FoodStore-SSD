# Recorrido de punta a punta (compra → pago → entrega)

Guion verificable del flujo completo con el frontend sobre el stack local (backend en `http://localhost:8000`, frontend en `http://localhost:5173`, base sembrada con `python -m app.db.seed`). Cubre los escenarios «Recorrido de punta a punta verificado» de la capability `project-delivery`. Además existe el E2E de API automatizado `backend/tests/integration/test_flujo_compra_pago_entrega.py` (`pytest -m e2e`).

Cuentas del seed (solo desarrollo): `cliente@foodstore.com` / `cliente123` (CLIENT), `pedidos@foodstore.com` / `pedidos123` (PEDIDOS), `admin@foodstore.com` / `Admin1234!` (ADMIN).

Estado de ejecución: tramos A y C ejecutados el 2026-11-23 sobre el stack local con Edge headless + `playwright-core`; el tramo B (tarjeta sandbox) lo ejecuta el usuario (`[USUARIO]`). Cada tramo tiene un bloque «Resultado de la ejecución» con fecha, pedido y capturas.

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

**Resultado de la ejecución:** 2026-11-23 — **ok**. Cuentas: `cliente@foodstore.com`, `pedidos@foodstore.com`, `admin@foodstore.com`. Pedido **#62** (2 × Hamburguesa Clásica sin un ingrediente removible, `EFECTIVO`, total $ 3.050 con el envío fijo de $ 50).

- A1-A4: el cliente filtra por «Hamburguesas», personaliza el producto, sube la cantidad a 2 en el carrito y confirma con `EFECTIVO`; la pantalla «Pedido #62 recibido» muestra `Pendiente` (capturas [01](capturas/01-catalogo-1440x900.png), [02](capturas/02-producto-1440x900.png), [03](capturas/03-carrito-1440x900.png), [04](capturas/04-finalizar-compra-1440x900.png), [05](capturas/05-pedido-creado-1440x900.png)).
- A5-A9: el gestor ve el pedido `PENDIENTE` en la lista y recorre `CONFIRMADO` (diálogo «Confirmar pago») → `EN_PREP` → `EN_CAMINO` → `ENTREGADO`; el historial registra cada cambio como «Gestor» (capturas [06](capturas/06-gestion-pedidos-1440x900.png), [07](capturas/07-gestion-pedido-detalle-1440x900.png), [08](capturas/08-gestion-pedido-entregado-1440x900.png)).
- A10: el cliente ve `ENTREGADO` con el seguimiento completo y el historial `Pedido creado → Confirmado → En preparación → En camino → Entregado` ([09](capturas/09-mis-pedidos-1440x900.png), [10](capturas/10-mi-pedido-detalle-1440x900.png)).
- A11: el dashboard del admin muestra los KPI de ventas, ingresos por forma de pago (`Efectivo` la mayor participación) y pedidos por estado ([11](capturas/11-dashboard-1440x900.png)). No se comparó el delta exacto del KPI antes y después del pedido #62; la coherencia de ventas (39 = confirmados + en preparación + en camino + entregados del período) sí se verificó.
- Pasada equivalente a 390x844 con el pedido **#63** (mismas capturas `*-390x844.png`), también hasta `ENTREGADO`. La captura `07-gestion-pedido-detalle-390x844.png` se rehízo tras corregir V-03 con el pedido **#68** (`PENDIENTE`, efectivo), porque #63 ya estaba entregado.

## Tramo B — Tarjeta sandbox hasta `CONFIRMADO` (cuenta: `cliente@foodstore.com`; lo ejecuta el usuario, CE-09)

Prerrequisitos: credenciales de prueba de MercadoPago en `backend/.env` (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`), `ngrok http 8000` y el webhook `<URL de ngrok>/api/v1/pagos/webhook` configurado en el panel de MercadoPago (evento «Order (Mercado Pago)»). Detalle en el README.

| Paso | Acción | Resultado esperado |
|------|--------|--------------------|
| B1 | Como cliente, armar un pedido nuevo y elegir la forma de pago `MERCADOPAGO` | Pedido `PENDIENTE`; pantalla de pago en `/finalizar-compra/pedido/:id/pago` con el formulario de tarjeta |
| B2 | Pagar con una tarjeta de prueba que aprueba el pago (titular `APRO`) | El formulario informa que el pago se procesa |
| B3 | Esperar la notificación del webhook (reintentar si MercadoPago demora) | El pedido pasa a `CONFIRMADO` sin intervención del gestor; el historial lo atribuye a «Sistema» |

**Resultado de la ejecución:** pendiente `[USUARIO]` (anotar fecha, id de pago y captura).

## Tramo C — Cancelación con motivo (cuentas: `cliente@foodstore.com` y `pedidos@foodstore.com`)

| Paso | Quién | Acción | Resultado esperado |
|------|-------|--------|--------------------|
| C1 | cliente | Crear un pedido `EFECTIVO` y, desde `/mis-pedidos`, pulsar «Cancelar» mientras está `PENDIENTE` | Diálogo de confirmación con campo de motivo obligatorio |
| C2 | cliente | Ingresar un motivo y confirmar | Estado `CANCELADO`; el historial guarda el motivo; el stock no cambia (no se había descontado) |
| C3 | pedidos | Crear/usar otro pedido `CONFIRMADO` y cancelarlo desde `/gestion-pedidos` con motivo | Estado `CANCELADO`; el stock descontado se repone |

**Resultado de la ejecución:** 2026-11-23 — **ok**.

- C1-C2: el cliente crea el pedido **#64** (`EFECTIVO`, 1 × Coca-Cola 500ml, $ 850), lo abre en «Mis pedidos» y pulsa «Cancelar pedido»; el diálogo exige el motivo («La cancelación no se puede deshacer»). Con el motivo el pedido queda `CANCELADO` y el historial lo guarda («Vos»).
- C3: el pedido **#65** se confirma desde el gestor y se cancela con motivo; el diálogo indica «El stock de sus productos se devuelve» y el historial registra `Pedido creado → Confirmado → Cancelado` con el motivo. La reposición numérica del stock no se midió en la UI (el campo de stock no se leyó antes y después). Quedaron además los pedidos de prueba #66 (cancelado por el cliente) y #67 (confirmado y cancelado por el gestor) de una repetición del tramo.
## Verificación final

- Dashboard (`/admin/dashboard`) coherente con los pedidos de los tramos A y B (los `CANCELADO` no cuentan como venta).
- Las fechas del gestor y del dashboard son UTC (limitación conocida, ver README).
- Capturas de este recorrido: se guardan en `docs/entrega/capturas/` con el nombre `NN-<pantalla>-<viewport>.png` (tarea 3.1, hecha el 2026-11-23: 17 pantallas, cada una en 1440x900 y 390x844).
