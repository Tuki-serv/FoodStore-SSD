# Tasks — C-11 `pedidos-contrato-api-y-categorias`

> **Governance MEDIO**: implementar con checkpoints; al cerrar cada bloque (A, B, C) reportar al usuario. No empezar hasta que el usuario apruebe los artefactos y responda (o acepte por defecto) OQ-1..OQ-5 de `design.md`.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por la interfaz HTTP (o API pública del service), valores esperados escritos a mano, sin aserciones tautológicas, mocks solo en bordes del sistema (SDK de MercadoPago, Cloudinary).
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Capas `models ← repository ← unit of work ← services ← routers`; nada de lógica ni consultas nuevas en routers; sin migraciones (D11): si algo parece necesitarla, frenar y consultar. No leer/escribir `.env*`, no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 Correr la suite completa y registrar total/passed/failed (último conocido: 1158 passed). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.
- [x] 0.2 Registrar en `design.md` §Open Questions la respuesta a OQ-1..OQ-5 con fecha. Verificar con `grep -n "OQ-[1-5]" openspec/changes/c-11-pedidos-contrato-api-y-categorias/design.md`.

## Bloque A — Convenciones de la API

## 1. Formato de error y códigos (D2, D3; spec `api-conventions`)

- [x] 1.1 RED: en `tests/integration/test_exception_handlers.py`, una app de `create_app()` con una ruta de prueba que lanza `AppError(409, "INVALID_TRANSITION", "x", field=None)` → 409 `{detail:"x", code:"INVALID_TRANSITION", field:null}`; otra que lanza `RuntimeError("boom")` con `TestClient(app, raise_server_exceptions=False)` → 500 `code` `INTERNAL_ERROR` y «boom» ausente del cuerpo. Ejecutar → falla (no existe `core/errors.py`).
- [x] 1.2 GREEN: `core/errors.py` (`AppError`, `ErrorCode`), `cuerpo_error` + `app_error_handler` + `unhandled_exception_handler` en `utils/errores.py` (con `logger.exception`), registrados en `main.py`; los handlers existentes pasan a usar `cuerpo_error`. Ejecutar `pytest tests/integration/test_exception_handlers.py tests/integration/test_app_startup.py` → verde (los `HTTP_<status>` y `VALIDATION_ERROR` existentes no cambian).
- [x] 1.3 RED: en `tests/integration/test_rate_limit.py`, el 429 tiene `code` `RATE_LIMIT_EXCEEDED`, `field` nulo, `detail` no vacío, sin clave `error`, y `Retry-After` > 0. Ejecutar → falla.
- [x] 1.4 GREEN: `RateLimitMiddleware` devuelve `JSONResponse` con `cuerpo_error` y los mismos headers. Ejecutar `pytest tests/integration/test_rate_limit.py` → verde.
- [x] 1.5 TRIANGULATE: 405 de un método no permitido y 401 de `GET /api/v1/auth/me` sin token mantienen `{detail, code, field}` (`HTTP_405`, `HTTP_401`). Ejecutar → verde.

## 2. Paginación genérica (D1; spec `api-conventions`)

- [x] 2.1 RED: nuevo `tests/unit/test_pagination.py`: `PaginatedResponse.desde([...2 items], total=5, PageParams(page=2, size=2))` → `pages` 3; `vacia(PageParams(1, 20))` → `{items:[], total:0, page:1, size:20, pages:0}`; `PageParams(3, 10).offset` → 20. Ejecutar → falla.
- [x] 2.2 GREEN: `core/pagination.py` (`PageParams`, `page_params`, `PageQuery`) y los classmethods en `core/schemas.py`. Ejecutar → verde.
- [x] 2.3 RED: test de integración de `BaseRepository.paginar` sobre una tabla real (p. ej. unidades de medida con 5 filas): página 2 de tamaño 2 → 2 filas y total 5; con un `where` que deja 1 → total 1. Ejecutar → falla.
- [x] 2.4 GREEN: `BaseRepository.paginar`. Ejecutar → verde.
- [x] 2.5 REFACTOR: categorías, productos, ingredientes, unidades, usuarios y `base_service.get_all` usan `PageQuery` en el router y `PaginatedResponse.desde/vacia` en el service; se borran `_pagina_vacia` y las cinco copias del cálculo de `pages`. Verificar `grep -rn "size - 1) // size\|_pagina_vacia" app` sin resultados y `pytest tests/integration/test_categoria.py tests/integration/test_producto.py tests/integration/test_ingrediente.py tests/integration/test_unidad_medida.py tests/integration/test_catalogo_visibilidad.py` → verde.
- [x] 2.6 TRIANGULATE: `GET /api/v1/productos?size=101` → 422 `field` `size`; `GET /api/v1/categorias?page=0` → 422 `field` `page`; página posterior a la última → `items` vacío con `total` real. Ejecutar → verde.

## 3. Direcciones paginadas (D9)

- [x] 3.1 RED: en `tests/integration/test_direccion_entrega.py`, un cliente sin direcciones recibe `{"items": [], "total": 0, "page": 1, "size": 20, "pages": 0}`; con 3 direcciones y `size=2`, la página 1 trae la principal primero y `pages` 2. Ejecutar → falla (hoy devuelve una lista).
- [x] 3.2 GREEN: `DireccionRepository.listar_por_usuario(usuario_id, params)` con `paginar`, service y router con `PageQuery` y `PaginatedResponse[DireccionRead]`; ajustar los tests existentes que leían la lista directa. Ejecutar `pytest tests/integration/test_direccion_entrega.py` → verde.
- [x] 3.3 Checkpoint bloque A: suite completa verde; reportar al usuario.

## Bloque B — Contrato de pedidos

## 4. Listado de pedidos por alcance (D4, D5; spec `order-api`)

- [x] 4.1 RED: nuevo `tests/integration/test_pedidos_contrato.py` (helpers locales para crear pedidos por HTTP): cliente A con 2 pedidos y B con 3; A llama a `GET /api/v1/pedidos` → 200, `total` 2, solo pedidos de A, cada elemento con `usuario_id` y `cliente_nombre` y sin `items`. Ejecutar → falla (hoy CLIENT recibe 403).
- [x] 4.2 GREEN: `PedidoResumen`, `FiltrosPedidos`, `PedidoRepository.listar(...)` con `JOIN` a usuario y `paginar`, `PedidoService.listar_pedidos(usuario_id, roles, filtros, params)` y router `GET /` para `CLIENT|ADMIN|PEDIDOS`. Ejecutar → verde.
- [x] 4.3 TRIANGULATE: `PEDIDOS` → `total` 5; `CLIENT`+`PEDIDOS` → todos; `STOCK` → 403; orden del más nuevo al más viejo; `page=2&size=2` → `pages` 3; `estado=PENDIENTE` filtra; `desde`/`hasta` inclusivos (fijar `created_at` en el test); `estado=DESPACHADO` → 422 `field` `estado`. Ejecutar → verde.

## 5. Detalle e historial para dueño y gestores (D4; spec `order-api`)

- [x] 5.1 RED: en `test_pedidos_contrato.py`, el dueño CLIENT llama a `GET /api/v1/pedidos/{id}` → 200 con `usuario_id`, `direccion_id` e `items`; otro cliente → 403. Ejecutar → falla (hoy CLIENT recibe 403 en ambos casos por rol).
- [x] 5.2 GREEN: `PedidoDetalle`, `_obtener_pedido_visible` con `AppError`, `obtener_detalle`, router con `CLIENT|ADMIN|PEDIDOS`. Ejecutar → verde.
- [x] 5.3 TRIANGULATE: `PEDIDOS` ve el pedido de A; inexistente → 404 `HTTP_404`; historial con el mismo acceso (dueño 200 con la fila nulo→`PENDIENTE`, otro cliente 403). Ejecutar → verde.

## 6. Cambio de estado con `nuevo_estado` (D4, D5; specs `order-api`, `order-lifecycle`)

- [x] 6.1 RED: `PATCH /api/v1/pedidos/{id}/estado` con `{"nuevo_estado": "EN_PREP"}` sobre un `CONFIRMADO` → 200 con `estado_codigo` `EN_PREP`, `usuario_id` e `items`; con `{"estado_hacia": "EN_PREP"}` → 422 `field` `nuevo_estado`; `{"nuevo_estado": "CANCELADO"}` sin motivo → 422 `field` `motivo`. Ejecutar → falla.
- [x] 6.2 GREEN: `PedidoCambioEstado` con `nuevo_estado` y `field_validator("motivo", validate_default=True)`; `cambiar_estado_pedido` lee `data.nuevo_estado`; `POST`/`PATCH` responden `PedidoDetalle`. Ejecutar → verde.
- [x] 6.3 GREEN: los 409 de `_transicionar` pasan a `AppError(409, INVALID_TRANSITION)` y el de stock a `AppError(409, INSUFFICIENT_STOCK)` (mismos mensajes). Test: `ENTREGADO` desde `EN_PREP` → `code` `INVALID_TRANSITION`; confirmación sin stock → `INSUFFICIENT_STOCK`. Ejecutar → verde.
- [x] 6.4 Migrar `estado_hacia` → `nuevo_estado` en `test_pedidos.py`, `test_pedidos_fsm.py`, `test_pedidos_multirol.py`, `test_pedidos_stock.py`, `test_pedidos_stock_concurrente.py`, `test_historial_append_only.py`, `test_pago_webhook_fsm.py` (solo los bodies HTTP; `estado_hacia` del historial queda). Ejecutar esos archivos → verde.

## 7. `DELETE` cancela el pedido propio y rutas retiradas (D4, D10; specs `order-api`, `rbac-authorization`)

- [x] 7.1 RED: `DELETE /api/v1/pedidos/{id}` del dueño con `{"motivo": "me arrepentí"}` sobre su `PENDIENTE` → 200 `CANCELADO` y fila de historial con ese motivo y su `usuario_id`. Ejecutar → falla (hoy CLIENT recibe 403).
- [x] 7.2 GREEN: `PedidoCancelacion`, `cancelar_pedido_propio(pedido_id, usuario_id, roles, motivo)` (misma lógica, delega en `_transicionar`), router `DELETE /{id}` para `CLIENT`; borrar `eliminar_pedido` del router y del service. Ejecutar → verde.
- [x] 7.3 TRIANGULATE: pedido ajeno → 403; sin body → 200 con motivo «Cancelado por el cliente» en el historial; body `{"motivo": "  "}` → igual; solo-`ADMIN` → 403 y el pedido no tiene `deleted_at`; `CLIENT` en `EN_PREP` → 409 `INVALID_TRANSITION`; `CLIENT`+`ADMIN` en `EN_PREP` → 200; cancelar un `CONFIRMADO` devuelve stock (regresión C-10); el pedido cancelado sigue en `GET /pedidos/{id}` y en el listado. Ejecutar → verde.
- [x] 7.4 Retirar las tres rutas `/mis-pedidos` y los métodos de service que quedan sin uso (`obtener_pedidos_por_usuario`, `obtener_todos_los_pedidos`, `obtener_pedido_por_id`, `obtener_pedido_propio`), `PedidoList`, `PedidoListAdmin`, `PedidoReadAdmin`, `PedidoReadFull`. Test: `PATCH /api/v1/pedidos/mis-pedidos/{id}/cancelar` y `GET /api/v1/pedidos/mis-pedidos` no dan 200 y el pedido no cambia. Migrar los tests existentes de `/mis-pedidos` a `GET /pedidos`, `GET /pedidos/{id}` y `DELETE /pedidos/{id}`. Verificar `grep -rn "mis-pedidos\|PedidoReadFull\|PedidoListAdmin" app tests` sin resultados y `pytest tests/integration/test_pedidos*.py` → verde.

## 8. Listado de cocina y matriz RBAC (D4, D10)

- [x] 8.1 RED: 25 pedidos `ENTREGADO` nuevos y 3 `CONFIRMADO` viejos → `GET /api/v1/pedidos/cocina/pedidos` devuelve los 3, del más viejo al más nuevo, con `total` 3 y forma paginada. Ejecutar → falla (hoy filtra después de traer 20).
- [x] 8.2 GREEN: `listar_cocina(params)` sobre `PedidoRepository.listar` con `estados={CONFIRMADO, EN_PREP}` y orden ascendente; router con `PageQuery`. Ejecutar → verde.
- [x] 8.3 Actualizar `tests/support/rbac_matriz.py` según D10 en lo que toca a pedidos (constante `CLIENT_ADMIN_PEDIDOS`; las filas del bloque C van en 11.4). Ejecutar `pytest tests/integration/test_rbac_matriz.py tests/integration/test_rbac_autoridad.py` → verde.
- [x] 8.4 Docs: `knowledge-base/02` (§API REST: pedidos y paginación; nota de `DELETE` con body para C-13b), `07` (flujos 5, 6 y cancelación sin «deuda DT-17»), `09` (DT-17 resuelta por C-11), `10` (IN-24 cerrada). Verificar con `grep -n "DT-17\|IN-24\|mis-pedidos" knowledge-base/02_descripcion_general.md knowledge-base/07_flujos_principales.md knowledge-base/09_decisiones_y_supuestos.md knowledge-base/10_preguntas_abiertas.md` (sin `mis-pedidos` salvo como histórico).
- [x] 8.5 Checkpoint bloque B: suite completa verde; reportar al usuario.

## Bloque C — Integridad del catálogo

## 9. Unicidad entre activos con 409 (D6; spec `catalog-integrity`)

- [x] 9.1 RED: en `tests/integration/test_categoria.py`, crear «Bebidas» con otra «Bebidas» eliminada → 201; crear un producto «Pizza» con otro activo → 409 `DUPLICATE_VALUE` `field` `nombre`. Ejecutar → falla (hoy 400 y cuenta eliminados).
- [x] 9.2 GREEN: `BaseRepository.existe_activo` y `base_service._validar_unicos` sobre `_unique_fields`; categorías y productos lo usan en `create`/`update` y borran su `_validar_nombre_unico`. Ejecutar → verde.
- [x] 9.3 TRIANGULATE: ingredientes (nombre) y unidades (nombre y símbolo: `field` `simbolo`) usan el mismo genérico; editar enviando el mismo nombre → 200; reusar el símbolo de una unidad eliminada al editar → 200. Ajustar los tests que esperaban 400 por duplicado (`test_unidad_medida_unicidad.py`, `test_ingrediente.py`, `test_producto.py`, `test_categoria.py`). Verificar `grep -rn "include_deleted=True" app/modules/*/service.py` sin usos de unicidad y `pytest tests/integration/test_categoria.py tests/integration/test_producto.py tests/integration/test_ingrediente.py tests/integration/test_unidad_medida.py tests/integration/test_unidad_medida_unicidad.py` → verde.

## 10. Baja de categoría con validación (D7; spec `catalog-integrity`)

- [x] 10.1 RED: en `test_categoria.py`, eliminar una categoría con un producto activo → 409 `CATEGORY_HAS_PRODUCTS`, la categoría sigue activa y Cloudinary no se llama (mock de `eliminar_imagen`). Ejecutar → falla (hoy 204).
- [x] 10.2 GREEN: `CategoriaRepository.tiene_productos_activos` / `tiene_hijas_activas` y `CategoriaService.delete` con las validaciones; borrar la re-asignación de hijas. Ejecutar → verde.
- [x] 10.3 TRIANGULATE: hija activa → 409 `CATEGORY_HAS_CHILDREN` y la hija conserva `parent_id`; productos y hijas → `CATEGORY_HAS_PRODUCTS`; solo un producto eliminado → 204; solo una hija eliminada → 204 y la hija conserva `parent_id`; hoja vacía → 204 y no aparece en el listado. Ejecutar → verde.
- [x] 10.4 Docs: `knowledge-base/05` (RN-CA-02 con 409 entre activos, RN-CA-03 resuelta), `09` (DT-19 resuelta por C-11), `10` (IN-17 cerrada). Verificar con `grep -n "RN-CA-0[23]\|DT-19\|IN-17" knowledge-base/05_reglas_de_negocio.md knowledge-base/09_decisiones_y_supuestos.md knowledge-base/10_preguntas_abiertas.md`.

## 11. Ingredientes de un producto (D8; spec `product-ingredients`)

- [x] 11.1 RED: nuevo `tests/integration/test_producto_ingredientes.py`: un anónimo lista los ingredientes de un producto disponible con «Tomate» y «Queso» (alérgeno) → 200 ordenados por nombre con `es_alergeno`. Ejecutar → falla (404 de ruta).
- [x] 11.2 GREEN: helper de visibilidad compartido con `get_by_id_full`, `ProductoService.listar_ingredientes` y router `GET /{producto_id}/ingredientes`. Ejecutar → verde.
- [x] 11.3 TRIANGULATE: ingrediente eliminado no aparece; producto no disponible → 404 anónimo y 200 para `STOCK`; producto sin ingredientes → `[]`; `ADMIN` quita «Tomate» → 204, ya no se lista y el ingrediente sigue existiendo; asociación inexistente → 404; `STOCK` → 403. Implementar `quitar_ingrediente` y `DELETE /{producto_id}/ingredientes/{ingrediente_id}` en el GREEN que corresponda. Ejecutar → verde.
- [x] 11.4 Matriz: filas `GET /productos/{producto_id}/ingredientes` (`PUBLICO`) y `DELETE /productos/{producto_id}/ingredientes/{ingrediente_id}` (`ADMIN`); `DELETE /categorias/{categoria_id}` sin dueño. Ejecutar `pytest tests/integration/test_rbac_matriz.py` → verde.
- [x] 11.5 Checkpoint bloque C: suite completa verde; reportar al usuario.

## 12. Cierre

- [x] 12.1 Docs transversales: `knowledge-base/02` (errores con catálogo de códigos y 429; paginación en todos los listados; endpoints de ingredientes de producto), `05` (RN-GL-01 sin deuda DT-18), `09` (DT-18 resuelta por C-11), `10` (IN-11 e IN-19 cerradas; PA-14 asumida spec v5.0). Verificar con `grep -n "DT-18\|IN-11\|IN-19\|PA-14" knowledge-base/*.md`.
- [x] 12.2 Revisión de capas y DRY: ningún router nuevo importa `Session` ni arma consultas; `PedidoService` no importa `HTTPException` en el código nuevo; `grep -rn "offset: Annotated\|limit: Annotated" app/modules` sin resultados; `grep -rn "\"data\"" app/modules/pedidos` sin resultados.
- [x] 12.3 Suite completa: 0 failed y passed ≥ baseline de 0.1 menos los tests de rutas retiradas más los nuevos; registrar el número y la diferencia.

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-11-pedidos-contrato-api-y-categorias` (marca `[x]` en CHANGES.md y agrega «Punto de partida (C-11)» en C-13b y C-22: contrato de pedidos, `DELETE` con body, códigos de error).

## Registro de checkpoints (apply, 2026-11-11)

- Línea base (0.1): 1158 passed, 0 failed. Bloque A: 1180 passed. Bloque B: 1189 passed. Bloque C / cierre (12.3): **1236 passed, 0 failed** (+78 sobre la línea base; no se perdió ningún test: los de rutas retiradas se migraron al contrato nuevo).
