# Tasks — C-10 `pedidos-stock-descuento`

> **Governance ALTO**: no se empieza hasta que el usuario apruebe los artefactos y responda (o acepte por defecto) OQ-1..OQ-3 de `design.md`.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por interfaz pública (HTTP o API pública del service), cantidades esperadas escritas a mano, mocks solo en el SDK de MercadoPago (`app.modules.pagos.service.mercadopago.SDK`, como en `test_pago_webhook_fsm.py`).
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Sin migraciones (D7): si algo parece necesitarla, frenar y consultar. No leer/escribir `.env*`, no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 Correr la suite completa y registrar total/passed/failed (último conocido: 1122 passed). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.
- [x] 0.2 Registrar en `design.md` §Open Questions la respuesta a OQ-1..OQ-3 con fecha. Verificar con `grep -n "OQ-[1-3]" openspec/changes/c-10-pedidos-stock-descuento/design.md`.

## 1. `StockService` (D1, D2)

- [x] 1.1 RED: nuevo `tests/integration/test_stock_service.py` (fixture `session`): `StockService(ProductoRepository(session)).descontar([LineaStock(a.id, 2)])` con stock 5 deja 3. Ejecutar → falla (el módulo no existe).
- [x] 1.2 GREEN: crear `app/modules/productos/stock_service.py` con `LineaStock`, `StockInsuficiente` y `StockService.descontar` (agrupa por producto, ordena por id, `get_for_update`, verifica todo antes de escribir). Ejecutar → verde.
- [x] 1.3 TRIANGULATE: dos líneas del mismo producto (2+3, stock 5) → stock 0; (3+3, stock 5) → `StockInsuficiente` con el nombre del producto y stock sin cambios; A alcanza y B no → ninguno cambia; `devolver` suma; `alcanza` devuelve el producto que no alcanza o `None`; `verificar` lanza para no disponible y para stock insuficiente sumado, sin escribir. Ejecutar → verde.
- [x] 1.4 REFACTOR: type hints, docstrings, sin duplicar el agrupado/ordenado entre métodos. Ejecutar `pytest tests/integration/test_stock_service.py` → verde.

## 2. Crear no descuenta (D8)

- [x] 2.1 RED: nuevo `tests/integration/test_pedidos_stock.py` con helpers locales (producto con stock, pedido por HTTP). Crear un pedido de 2 sobre stock 5 → 201 y stock releído 5. Ejecutar → falla (hoy queda 3).
- [x] 2.2 GREEN: `crear_pedido` arma las líneas, llama a `StockService.verificar` (400 con los mensajes actuales) y deja de descontar. Ejecutar → verde.
- [x] 2.3 TRIANGULATE: dos líneas del mismo producto que suman 6 sobre stock 5 → 400 y no se crea pedido; producto no disponible → 400. Ajustar los tests existentes que asumían descuento al crear (detectados en 0.1/2.2). Ejecutar `pytest tests/integration/test_pedidos_stock.py tests/integration/test_pedidos.py` → verde.

## 3. Confirmación manual descuenta o se rechaza (D3, D4)

- [x] 3.1 RED: en `test_pedidos_stock.py`, `PEDIDOS` confirma un `EFECTIVO` de 2 sobre stock 5 → 200 y stock 3. Ejecutar → falla (la fábrica usa `sin_efecto`).
- [x] 3.2 GREEN: `descontar_stock_al_confirmar` en `pedidos/service.py` y conectarlo en `construir_pedido_service`. Ejecutar → verde.
- [x] 3.3 RED: `ADMIN` confirma un `TRANSFERENCIA` de 2 con stock bajado a 1 tras crear → 409 con el nombre del producto, sigue `PENDIENTE`, sin fila hacia `CONFIRMADO`, stock 1. Ejecutar → falla (hoy la excepción no se traduce a 409).
- [x] 3.4 GREEN: `cambiar_estado_pedido` traduce `StockInsuficiente` a 409 fuera del `with uow`. Ejecutar → verde.
- [x] 3.5 TRIANGULATE: pedido con A (1/stock 4) y B (3/stock 3) → 3 y 0; A alcanza y B no → 409 y ambos sin cambio. Ejecutar `pytest tests/integration/test_pedidos_stock.py tests/integration/test_pedidos_fsm.py` → verde.

## 4. Cancelar devuelve solo desde CONFIRMADO+ (D3, D10)

- [x] 4.1 RED: el `CLIENT` cancela su `PENDIENTE` de 2 sobre stock 5 → stock 5. Ejecutar → falla (hoy queda 7 porque se restaura sin haber descontado).
- [x] 4.2 GREEN: `_transicionar` llama a `StockService.devolver` solo si el origen es `CONFIRMADO` o `EN_PREP`; eliminar `descontar_stock_del_pedido` y `restaurar_stock_del_pedido`. Ejecutar → verde.
- [x] 4.3 TRIANGULATE: confirmar y cancelar (CLIENT) → stock vuelve a 5; `PEDIDOS` cancela un `EN_PREP` de 1 con stock 0 → 1; producto eliminado tras confirmar → cancelar no falla y su stock no cambia. Ejecutar `pytest tests/integration/test_pedidos_stock.py tests/integration/test_pedidos_multirol.py tests/integration/test_pedidos.py` → verde.

## 5. Webhook: confirma descontando o cancela sin stock (D5, D6, D7)

- [x] 5.1 RED: `tests/unit/test_pedido_fsm.py`: `ACTOR_SISTEMA` en `PENDIENTE` con `"MERCADOPAGO"` es `{CONFIRMADO, CANCELADO}` (actualizar la aserción de C-09); con `"EFECTIVO"` sigue vacío; en `CONFIRMADO` sigue vacío. Ejecutar → falla.
- [x] 5.2 GREEN: `TRANSICIONES[SISTEMA]` suma `CANCELADO` y `destinos_permitidos` limita al Sistema a pedidos `MERCADOPAGO` (D6). Ejecutar `pytest tests/unit/test_pedido_fsm.py` → verde.
- [x] 5.3 RED: en `tests/integration/test_pago_webhook_fsm.py`, pago aprobado de un `MERCADOPAGO` de 2 sobre stock 5 → 200, `CONFIRMADO`, stock 3. Luego dos `MERCADOPAGO` sobre la última unidad procesados en serie → el segundo `CANCELADO` con fila `PENDIENTE→CANCELADO`, motivo «Sin stock», `usuario_id` nulo, su pago `a_devolver`, stock 0, ambas respuestas 200. Ejecutar → falla.
- [x] 5.4 GREEN: `confirmar_por_pago_aprobado` con pre-chequeo `StockService.alcanza` y desvío a `CANCELADO`; `pagos/service.py` pone `a_devolver` cuando el pedido devuelto quedó `CANCELADO`. Ejecutar → verde.
- [x] 5.5 TRIANGULATE: `GET /api/v1/pagos/{pedido_id}` del cancelado → `estado` `a_devolver`; reenvío de la misma notificación → 200, sin filas nuevas ni cambio de stock; pago aprobado de un `EFECTIVO` → sigue `PENDIENTE` y stock sin cambio. Ejecutar `pytest tests/integration/test_pago_webhook_fsm.py tests/integration/test_pago.py tests/unit/test_pedido_fsm.py` → verde.

## 6. Concurrencia y ajuste manual de stock (D2, D9)

- [x] 6.1 RED/GREEN: nuevo `tests/integration/test_pedidos_stock_concurrente.py` con el patrón de `test_auth_refresh_concurrente.py` (sesiones propias por hilo, `threading.Barrier`, datos confirmados y borrados al final): dos `PEDIDOS` confirman en paralelo dos `EFECTIVO` de 1 sobre stock 1 → exactamente un 200 y un 409, stock 0. Ejecutar → verde (si falla, corregir el bloqueo de D1/D2 antes de seguir).
- [x] 6.2 TRIANGULATE: dos pedidos con líneas (A, B) y (B, A) confirmados en paralelo con stock suficiente → ambos 200, sin deadlock (timeout del test), stocks bajan la suma. Ejecutar → verde.
- [x] 6.3 `fijar_stock` lee con `get_for_update` (D9; según OQ-3). Ejecutar `pytest tests/integration/test_producto_inventario.py tests/integration/test_producto.py` → verde (contrato C-08 intacto).

## 7. Docs y cierre

- [x] 7.1 KB: `05` RN-ST-01-real y nota de RN-ST-02 marcadas resueltas por C-10, RN-PE-09 sin «descuenta el stock», RN-PA-04 con `a_devolver`; `09` DT-04 resuelta por C-10; `11` estado local `a_devolver`. Verificar con `grep -n "DT-04\|a_devolver" knowledge-base/05_reglas_de_negocio.md knowledge-base/09_decisiones_y_supuestos.md knowledge-base/11_pagos_mercadopago.md`.
- [x] 7.2 Revisión SOLID/DRY y capas: `grep -rn "stock_cantidad" app/modules/pedidos app/modules/pagos` sin escrituras de stock fuera de `StockService`; ni router ni webhook importan `StockService`.
- [x] 7.3 Suite completa: 0 failed y passed ≥ baseline de 0.1 más los tests nuevos; registrar el número.

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-10-pedidos-stock-descuento` (marca `[x]` en CHANGES.md).
