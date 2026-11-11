# Design — C-11 `pedidos-contrato-api-y-categorias`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/api-conventions`, `specs/order-api`, `specs/catalog-integrity`, `specs/product-ingredients` (nuevos) y `specs/order-lifecycle`, `specs/rbac-authorization`, `specs/backend-runtime` (MODIFIED).

Punto de partida en el código (`dev`, 2026-11-11):

- **Paginación**: `core/schemas.py::PaginatedResponse[T]` ya tiene la forma objetivo. El cálculo `pages = (total + size - 1) // size` está copiado en `core/service.py::get_all` y en los services de categorías, productos, ingredientes, unidades y usuarios; `_pagina_vacia` vive en `base_service`. Cada repositorio de catálogo tiene su par `get_all_filtered`/`count_filtered`. Pedidos usa `offset/limit` y `PedidoList`/`PedidoListAdmin` (`{data,total}`); `GET /direcciones/` devuelve `list[DireccionRead]`.
- **Errores**: `utils/errores.py` formatea `HTTPException` (`code = getattr(exc, "code", f"HTTP_{status}")`, `field = getattr(exc, "field", None)`) y `RequestValidationError` (`VALIDATION_ERROR`, `field = loc[-1]` del primer error). `RateLimitMiddleware` arma a mano `{"error":{...}}`. No hay handler para `Exception`. Los services lanzan `HTTPException` (deuda de capas, C-25a).
- **Pedidos**: `PedidoService` (C-09/C-10) ya tiene `_transicionar` como único punto de transición; `cambiar_estado_pedido` (async, emite WebSocket, traduce `StockInsuficiente` a 409) y `cancelar_pedido_propio` (verifica propiedad, delega). Los 409 de `_transicionar` son `HTTPException` sin código. `_armar_pedido_read_admin` busca el usuario por pedido (N+1 en el listado).
- **Catálogo**: los cuatro `_validar_nombre_unico`/`_validar_unicidad` usan `include_deleted=True` y responden 400; los modelos ya declaran `_unique_fields` (C-06) y la base tiene índices únicos parciales `WHERE deleted_at IS NULL`. `CategoriaService.delete` re-asigna hijas al abuelo y borra la imagen después del commit.
- **Matriz RBAC** (`tests/support/rbac_matriz.py`): 8 filas con dueño C-11 y un test que exige que toda ruta HTTP registrada tenga fila (o esté en `EXCLUIDAS`).

## Goals / Non-Goals

**Goals:** un contrato HTTP estable para el frontend, implementado con piezas genéricas en `core` (paginación, error de dominio, unicidad) que los módulos reusan sin copiar; los endpoints de pedidos nuevos son adaptadores finos sobre los métodos existentes del service.

**Non-Goals:** migrar **todos** los `HTTPException` de los services a errores de dominio (solo los que este change toca; el resto, C-25a); sacar `Session`/`get_session` de los routers (C-25a); cambiar la FSM, el stock o el WebSocket; tocar pagos.

## Decisions

**D1 — Paginación genérica en `core`, una sola vez.**
- `core/pagination.py`: `PageParams` (dataclass inmutable `page`, `size`, propiedad `offset`) sin dependencias de FastAPI, y `PageQuery = Annotated[PageParams, Depends(page_params)]`, donde `page_params(page: Query(ge=1)=1, size: Query(ge=1, le=100)=20)` es la única definición de los límites.
- `PaginatedResponse.desde(items, total, params)` y `PaginatedResponse.vacia(params)` (classmethods en `core/schemas.py`) son el único lugar que calcula `pages`. `_pagina_vacia` se elimina.
- `BaseRepository.paginar(statement, params) -> tuple[list[T], int]`: cuenta con `select(func.count()).select_from(statement.order_by(None).subquery())` y trae la página con `offset/limit`. Los repositorios que agreguen un listado nuevo (pedidos, direcciones) arman su `select` filtrado y llaman a `paginar`; los pares `get_all_filtered`/`count_filtered` del catálogo pueden pasar a `paginar` en el REFACTOR si no cambia el comportamiento.
- Todos los routers de listados reciben `params: PageQuery` (catálogo, usuarios, pedidos, cocina, direcciones).
*Alternativa descartada:* `fastapi-pagination` (dependencia nueva para algo que ya está casi hecho) o dejar el cálculo en cada service (viola la regla dura 3).

**D2 — Error de dominio `AppError` sin FastAPI.**
`core/errors.py` define `AppError(Exception)` con `status_code`, `code`, `detail`, `field` y un `ErrorCode` (`StrEnum`) con los códigos de negocio de la spec (`INVALID_TRANSITION`, `INSUFFICIENT_STOCK`, `DUPLICATE_VALUE`, `CATEGORY_HAS_PRODUCTS`, `CATEGORY_HAS_CHILDREN`, `RATE_LIMIT_EXCEEDED`, `INTERNAL_ERROR`, `VALIDATION_ERROR`). `utils/errores.py` suma `app_error_handler` y un `unhandled_exception_handler` (500 `INTERNAL_ERROR`, `detail` genérico, `logger.exception`), y los tres handlers existentes más el middleware construyen el cuerpo con una única función `cuerpo_error(detail, code, field) -> dict`. El código lo migra solo donde este change escribe: `_transicionar`, el 409 de stock de `cambiar_estado_pedido`, unicidad, borrado de categoría y los accesos de pedidos.
*Alternativa:* subclase de `HTTPException` con `code`/`field` (el handler ya los lee): menos código hoy, pero acopla más los services a FastAPI justo antes de C-25a.

**D3 — 429 con el formato único.** `RateLimitMiddleware` devuelve `JSONResponse(status_code=429, content=cuerpo_error("Demasiadas peticiones. Intentá de nuevo más tarde.", "RATE_LIMIT_EXCEEDED", None), headers={Retry-After, X-RateLimit-*})`. Se pierden `retry_after_seconds`/`retry_after` del cuerpo: el dato queda en el header estándar.

**D4 — Contrato de pedidos sobre los métodos existentes.**
- Router: `GET /` (`CLIENT|ADMIN|PEDIDOS`), `GET /{id}` y `GET /{id}/historial` (mismos roles), `PATCH /{id}/estado` (roles actuales, incluido `COCINA`, dueño C-26), `DELETE /{id}` (`CLIENT`), `GET /cocina/pedidos` (roles actuales). Se borran las tres rutas `/mis-pedidos` y `eliminar_pedido`. El router solo pasa `current_user.id`, `roles`, filtros y `params`.
- Service: `listar_pedidos(usuario_id, roles, filtros, params)` decide el alcance con `tiene_algun_rol(roles, {"ADMIN", "PEDIDOS"})` (unión de roles, C-08); `obtener_detalle(pedido_id, usuario_id, roles)` y `obtener_historial(...)` comparten `_obtener_pedido_visible` (404 si no existe o tiene `deleted_at`, 403 si no es propio ni gestor); `cancelar_pedido_propio(pedido_id, usuario_id, roles, motivo)` mantiene su lógica (propiedad + `_transicionar`) y solo cambia el parámetro; `listar_cocina(params)` filtra por estado **en la consulta**. Se eliminan `obtener_pedidos_por_usuario`, `obtener_todos_los_pedidos`, `obtener_pedido_por_id`, `obtener_pedido_propio`, `obtener_pedidos_cocina` y `eliminar_pedido`.
- Repositorio: `listar(filtros, params, usuario_id: int | None, estados: set | None, ascendente: bool)` con un `JOIN` a `usuario` que trae `nombre` junto al pedido (sin N+1) y `paginar`. Filtro de fechas en UTC: `created_at >= desde` y `created_at < hasta + 1 día`.
- `PedidoService` no lanza `HTTPException` nuevos: usa `AppError`.

**D5 — Schemas de pedidos.**
- `PedidoCambioEstado { nuevo_estado: str (max 20), motivo: str | None }`; la exigencia de motivo para `CANCELADO` va en un `field_validator("motivo")` con `validate_default=True` para que el 422 salga con `field = "motivo"` (un `model_validator` daría `field = "body"`). `nuevo_estado` sigue siendo `str` para conservar el 400 «Estado destino inválido» de `order-lifecycle`.
- `PedidoCancelacion { motivo: str | None = None }` (body opcional; `strip` y vacío se normalizan a `None`); el service usa «Cancelado por el cliente» si no hay motivo.
- `PedidoResumen` (elemento del listado: `PedidoRead` + `usuario_id`, `cliente_nombre`) y `PedidoDetalle` (`PedidoResumen` + `direccion_id`, `items`). `POST /pedidos`, `GET /{id}`, `PATCH /{id}/estado` y `DELETE /{id}` responden `PedidoDetalle` (en `POST` y `PATCH` solo **agrega** campos). Se eliminan `PedidoList`, `PedidoListAdmin`, `PedidoReadAdmin`, y `PedidoReadFull` se reemplaza por `PedidoDetalle` (también en el webhook y el WebSocket, que solo serializan).
- Filtros: `FiltrosPedidos` (dataclass) con `estado: Literal[6 códigos] | None`, `desde: date | None`, `hasta: date | None` como query params.

**D6 — Unicidad genérica entre activos.** `BaseRepository.existe_activo(campo, valor, excluir_id) -> bool` y `base_service._validar_unicos(datos: dict, excluir_id=None)` recorren `model._unique_fields` y lanzan `AppError(409, DUPLICATE_VALUE, field=campo)` al primer choque. Los cuatro services de catálogo borran su `_validar_nombre_unico`/`_validar_unicidad` y llaman al genérico en `create`/`update` (solo con los campos que cambian). Comparación exacta, como el índice parcial.

**D7 — Baja de categoría con validación.** `CategoriaRepository.tiene_productos_activos(id)` (`EXISTS` sobre `producto_categoria` unido a `producto` con `deleted_at IS NULL`) y `tiene_hijas_activas(id)`. `CategoriaService.delete`: 404 → productos (409 `CATEGORY_HAS_PRODUCTS`) → hijas (409 `CATEGORY_HAS_CHILDREN`) → soft delete; se borra la re-asignación al abuelo. La imagen se sigue borrando en Cloudinary **solo** después de un commit exitoso (comportamiento actual).

**D8 — Ingredientes de un producto.** `ProductoService.listar_ingredientes(producto_id, *, ver_no_disponibles)` reutiliza la misma verificación de visibilidad que `get_by_id_full` (extraída a un helper privado, sin copiarla) y arma `ProductoIngredienteRead` ordenado por nombre, salteando ingredientes eliminados. `quitar_ingrediente(producto_id, ingrediente_id)`: producto activo (404), asociación existente (404), borrado físico de la fila de `producto_ingrediente` (no tiene `deleted_at`). Router: `GET /{producto_id}/ingredientes` (público, `VeNoDisponibles`) y `DELETE /{producto_id}/ingredientes/{ingrediente_id}` (ADMIN, 204).

**D9 — Direcciones paginadas.** `DireccionRepository.listar_por_usuario(usuario_id, params)` (principal primero, luego `id` ascendente) con `paginar`; `GET /direcciones/` responde `PaginatedResponse[DireccionRead]`.

**D10 — Matriz RBAC.** En `rbac_matriz.py`: se borran las filas de `/mis-pedidos` (3); `GET /pedidos/`, `GET /pedidos/{id}` y `/historial` pasan a `CLIENT|ADMIN|PEDIDOS` sin dueño; `DELETE /pedidos/{id}` pasa a `CLIENT` sin dueño (body `{"motivo": "x"}`); `PATCH /estado` usa `{"nuevo_estado": ...}`; `DELETE /categorias/{id}` pierde el dueño; se agregan `GET /productos/{id}/ingredientes` (`PUBLICO`) y `DELETE /productos/{id}/ingredientes/{ingrediente_id}` (`ADMIN`). Constante nueva `CLIENT_ADMIN_PEDIDOS`.

**D11 — Sin migración.** Ninguna decisión toca el esquema: la unicidad entre activos ya la garantizan los índices parciales de la 001; la baja de categoría y el borrado de `producto_ingrediente` usan columnas existentes; `pedidos.deleted_at` queda (sin escritores) para no migrar.

## Risks / Trade-offs

- [Cambio incompatible en muchos endpoints a la vez] → no hay frontend todavía (C-13a/b vienen después); los tests existentes que dependen del contrato viejo se ajustan en el grupo que lo cambia. La lista de rupturas va en el resumen del change.
- [Dos formatos de origen de error conviven (`HTTPException` y `AppError`) hasta C-25a] → ambos salen por `cuerpo_error`, así que el cliente ve un solo formato.
- [Fechas de filtro en UTC: un pedido de las 22 h de Argentina cae en el día siguiente] → documentado; ajustar a zona local es un cambio acotado del repositorio si C-22 lo pide.
- [Carrera entre dos altas con el mismo nombre: el chequeo previo pasa en ambas y el índice parcial rechaza la segunda con `IntegrityError` → 500] → baja probabilidad en un panel de un solo admin; se acepta y se deja anotado para C-25a.
- [El handler de 500 no se ve en `TestClient` por defecto] → el test usa `TestClient(app, raise_server_exceptions=False)` con una ruta de prueba agregada a una app creada con `create_app()`.
- [`DELETE` con body: algunos clientes HTTP no lo envían por defecto] → Axios lo soporta (`data`); se documenta en la KB 02 para C-13b.
- [Change ancho] → tareas agrupadas en cortes verticales independientes (convenciones → pedidos → catálogo), cada uno con su suite verde; ver OQ-4.

## Migration Plan

Sin migración Alembic ni variables nuevas (cabeza en `002`). Rollback = revertir el commit. No hay consumidores del contrato viejo fuera de los tests del repo.

## Open Questions

- **OQ-1 — ¿Alias deprecado para `/mis-pedidos` y `estado_hacia`?** Por defecto: no, se retiran sin alias (no hay frontend que los use). Alternativa: aceptarlos un tiempo con aviso en OpenAPI.
- **OQ-2 — ¿Qué recibe `DELETE /pedidos/{id}`?** Por defecto: body obligatorio `{motivo}`. **Resuelta ajustada:** body opcional `{motivo}`; sin body o con motivo ausente/vacío se usa «Cancelado por el cliente»; responde 200 con el pedido.
- **OQ-3 — ¿Quién ve el detalle y el historial?** Por defecto: dueño, `ADMIN` y `PEDIDOS` (la spec dice «Propietario/ADMIN», pero PEDIDOS gestiona pedidos); otro cliente recibe 403. Alternativa: 404 para no revelar que el pedido existe.
- **OQ-4 — ¿Partir el change?** Por defecto: uno solo, con tareas en tres bloques que se pueden cerrar por separado. Alternativa: C-11a (pedidos + paginación + errores) y C-11b (unicidad, categorías, ingredientes de producto).
- **OQ-5 — Filtros de `GET /pedidos`.** Por defecto: `estado`, `desde`, `hasta` (lo que pide US-021/C-22). Alternativa: solo paginación y dejar filtros para C-22.

## Aprobación

Aprobado (2026-11-11, by user). OQ-1, OQ-3, OQ-4 y OQ-5: por defecto. OQ-2: **ajustada** (body opcional con motivo por defecto «Cancelado por el cliente»).

## Notas de implementación (apply, 2026-11-11)

- **Checkpoints (Governance MEDIO):** línea base 1158 passed; bloque A (convenciones, paginación, direcciones) 1180 passed; bloque B (pedidos) 1189 passed; bloque C y cierre: ver `tasks.md` §12.3.
- **Desviación 1:** `FiltrosPedidos` vive en `pedidos/schemas.py` (dataclass usada como dependencia de FastAPI) y el repositorio la importa; no hay otro lugar neutro sin crear un módulo nuevo para un solo tipo.
- **Desviación 2:** los 404/403 de pedidos usan `AppError(404/403, "HTTP_404"/"HTTP_403")` (no hay `ErrorCode` para ellos: la spec fija `HTTP_<status>`); el resto de los `HTTPException` previos del `PedidoService` (crear pedido, forma de pago, estado inexistente) no se tocaron.
- **Desviación 3:** `PedidoCambioEstado` usa `model_config = ConfigDict(validate_default=True)` (SQLModel `Field` no acepta `validate_default`) para que el 422 por motivo faltante salga con `field = "motivo"`.
- **Descubrimiento (fuera de alcance, no corregido):** `POST /productos/` con `ingredientes` inline falla con 500 (`NotNullViolation`: `ProductoService.create` no copia `cantidad` ni `unidad_medida_id` a `ProductoIngrediente`); la asociación por `POST /productos/{id}/ingredientes` sí funciona. Candidato para C-25a/C-12.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-11
