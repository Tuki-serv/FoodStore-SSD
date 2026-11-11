# Proposal — C-10 `pedidos-stock-descuento`

## Why

El código descuenta el stock **al crear** el pedido y lo devuelve en **toda** cancelación (DT-04, RN-ST-01-real): un pedido impago reserva stock para siempre (no hay TTL) y cancelar un `PENDIENTE` «devuelve» algo que nunca debió salir. El usuario decidió el modelo de PA-03 (DD-20): **verificar al crear, descontar al confirmar, devolver solo al cancelar un CONFIRMADO o posterior**. C-09 ya dejó un único punto de entrada a `CONFIRMADO` con el gancho `al_confirmar` vacío: este change lo llena.

Observado en el código (`dev`, 2026-11-11):

- `PedidoService.crear_pedido` llama a `descontar_stock_del_pedido` (con `get_for_update`, 409 si falta).
- `_transicionar` llama a `restaurar_stock_del_pedido` en toda cancelación, también desde `PENDIENTE`.
- `construir_pedido_service(session)` crea el service con `al_confirmar=sin_efecto`.
- La verificación al crear es **por línea**: dos líneas del mismo producto (distinta personalización) que suman más que el stock pasan la validación.
- El actor Sistema solo puede `PENDIENTE → CONFIRMADO`: no tiene forma de cancelar un pedido pagado sin stock.

## What Changes

- **Crear no descuenta**: solo verifica existencia, `disponible` y stock suficiente **sumando las líneas del mismo producto** (400 con mensaje claro, como hoy).
- **Confirmar descuenta**: el paso `al_confirmar` descuenta el stock de todas las líneas dentro de la misma transacción de la transición, bloqueando las filas de producto en orden de `id` (sin deadlocks). Si alguna línea no alcanza, no se descuenta nada.
- **Confirmación manual sin stock** (`EFECTIVO`/`TRANSFERENCIA`, ADMIN/PEDIDOS): **409** «No hay stock suficiente para <producto>», el pedido sigue `PENDIENTE` y el historial no suma filas.
- **Pago aprobado sin stock** (webhook, `MERCADOPAGO`): el pedido pasa a `CANCELADO` con motivo «Sin stock» y actor Sistema (`usuario_id` NULL); el pago queda en estado local `a_devolver` (devolución manual, PA-08 fuera de alcance); el webhook responde 200. El Sistema suma la transición `PENDIENTE → CANCELADO`, solo para pedidos `MERCADOPAGO`.
- **Cancelar**: desde `PENDIENTE` no toca el stock; desde `CONFIRMADO` o `EN_PREP` devuelve las cantidades (mismo bloqueo ordenado).
- **`StockService` único** (`verificar`, `descontar`, `devolver` sobre líneas `producto_id`/`cantidad`): ni el router ni el webhook tocan el stock. Se eliminan `descontar_stock_del_pedido` y `restaurar_stock_del_pedido` de `PedidoService`.
- **`PATCH /productos/{id}/stock`** sigue siendo absoluto (contrato C-08 intacto) pero lee la fila con bloqueo, para serializarse con un descuento concurrente.
- **Sin migración**: `pagos.estado` es `VARCHAR(20)` sin `CHECK`; `a_devolver` entra sin cambiar el esquema.

**Fuera de alcance (con dueño):** devolución automática del pago y qué hacer con pagos `cancelled`/`refunded` (PA-08); `disponible=false` automático al llegar a 0 (PA-12); consistencia general pago/pedido ante otras excepciones del webhook, firma e idempotencia (IN-22/DT-21, **C-05**); contrato `{nuevo_estado}` (C-11).

## Capabilities

### New Capabilities
- `order-stock`: ciclo del stock ligado al pedido — verificar al crear, descontar al confirmar, devolver al cancelar CONFIRMADO+, rechazo y cancelación por falta de stock, concurrencia sobre la última unidad.

### Modified Capabilities
- `order-lifecycle`: la confirmación automática del Sistema admite el desvío a `CANCELADO` por falta de stock (el Sistema ya no tiene «solo esa transición»); el punto único de entrada a `CONFIRMADO` define el paso de confirmación como el descuento de stock.

## Impact

- **Código**: `backend/app/modules/productos/stock_service.py` (nuevo), `pedidos/service.py` (crear, `_transicionar`, `confirmar_por_pago_aprobado`, fábrica), `pedidos/fsm.py` (fila SISTEMA), `pagos/service.py` (marca `a_devolver`), `productos/service.py` (`fijar_stock` con bloqueo).
- **API**: sin endpoints nuevos ni cambios de body. Cambia el comportamiento observable: el stock baja al confirmar, no al crear; nuevo 409 de confirmación manual sin stock; nuevo valor `a_devolver` en `GET /pagos/{pedido_id}`.
- **Datos**: sin migración ni variables de entorno nuevas.
- **Docs**: `knowledge-base/05` (RN-ST-01-real/RN-ST-02 resueltas, RN-PA-04 con `a_devolver`), `09` (DT-04 resuelta), `11` (estado `a_devolver`).
