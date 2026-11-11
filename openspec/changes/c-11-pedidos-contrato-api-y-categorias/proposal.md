# Proposal — C-11 `pedidos-contrato-api-y-categorias`

## Why

El frontend (C-13b en adelante) va a consumir la API tal como quede después de este change, y hoy el contrato no es el de la spec `[INT]` §5 (DT-17, DT-18, DT-19; IN-11, IN-17, IN-19, IN-24): pedidos usa `offset/limit` y `{data,total}`, el cliente opera por `/mis-pedidos/...`, el cambio de estado recibe `estado_hacia`, `DELETE /pedidos/{id}` es un soft delete solo-ADMIN, el 429 devuelve `{"error":{...}}`, las unicidades responden 400 contando eliminados y borrar una categoría re-asigna sus hijas al abuelo sin validar productos. Es del camino crítico (`C-09 → C-11 → C-13b`): conviene fijar el contrato una sola vez, antes de escribir el cliente.

Observado en el código (`dev`, 2026-11-11):

- `pedidos/router.py`: `GET /mis-pedidos`, `GET /mis-pedidos/{id}`, `PATCH /mis-pedidos/{id}/cancelar` (CLIENT); `GET /`, `GET /{id}`, `GET /{id}/historial` (ADMIN, PEDIDOS); `PATCH /{id}/estado {estado_hacia, motivo}`; `DELETE /{id}` (ADMIN, soft delete, 204); `GET /cocina/pedidos` filtra en memoria **después** de traer 20 filas e ignora `offset/limit`.
- Catálogo y admin de usuarios ya usan `page/size` → `PaginatedResponse`, pero el cálculo de `pages` está copiado en 6 services; `GET /direcciones/` devuelve una lista sin paginar.
- `utils/errores.py` ya da `{detail, code, field}` a `HTTPException` (código `HTTP_<status>`) y a la validación (`VALIDATION_ERROR`); el rate limit arma su propio JSON y un error no controlado devuelve texto plano.
- `CategoriaService.delete` re-asigna hijas y no mira productos; `_validar_nombre_unico` de categorías, productos, ingredientes y unidades usa `include_deleted=True` y responde 400 (la base ya tiene índices parciales solo entre activos, C-06).
- `GET /productos/{id}/ingredientes` y `DELETE /productos/{id}/ingredientes/{ing_id}` (spec §5.2) no existen (dueño C-11 por OQ-5 de C-08).

## What Changes

- **BREAKING — Contrato de pedidos (spec §5.3):**
  - `GET /pedidos` lista los pedidos propios (`CLIENT`) o todos (`ADMIN`/`PEDIDOS`, por unión de roles), paginado y con filtros `estado`, `desde`, `hasta`.
  - `GET /pedidos/{id}` y `GET /pedidos/{id}/historial` para el propietario, `ADMIN` y `PEDIDOS` (otro usuario: 403).
  - `PATCH /pedidos/{id}/estado` recibe `{nuevo_estado, motivo}`.
  - `DELETE /pedidos/{id}` cancela el pedido propio (`CLIENT` dueño, body opcional `{motivo}`; sin motivo se usa «Cancelado por el cliente») y responde 200 con el pedido.
  - Se **retiran** `/pedidos/mis-pedidos`, `/pedidos/mis-pedidos/{id}`, `/pedidos/mis-pedidos/{id}/cancelar`, el campo `estado_hacia` y el soft delete de pedidos por ADMIN, sin alias (OQ-1).
  - Los endpoints nuevos delegan en `cambiar_estado_pedido` / `cancelar_pedido_propio` → `_transicionar` (C-09/C-10): la FSM y el stock no se tocan.
- **BREAKING — Paginación uniforme:** todo listado de colección recibe `page` (≥1, por defecto 1) y `size` (1..100, por defecto 20) y responde `{items, total, page, size, pages}`. Se suman `GET /pedidos`, `GET /pedidos/cocina/pedidos` y `GET /direcciones/`. El cálculo se hace una sola vez en `core` (sin copias por service).
- **Formato de errores en toda la API:** `{detail, code, field}` también en el 429 (`RATE_LIMIT_EXCEEDED`, conserva `Retry-After`) y en el 500 no controlado (`INTERNAL_ERROR`, sin filtrar la traza). Se mantienen los códigos `HTTP_<status>` y `VALIDATION_ERROR`; se agregan códigos de negocio estables para lo que el frontend debe distinguir (transición inválida, stock insuficiente, valor duplicado, categoría con productos o subcategorías).
- **BREAKING — Unicidad del catálogo:** nombre de categoría, producto e ingrediente, y nombre/símbolo de unidad de medida, únicos solo entre **activos**; un duplicado responde **409** `DUPLICATE_VALUE` con `field` (antes 400 y contaba eliminados).
- **BREAKING — Borrado de categoría con validación (RN-CA-03):** soft delete solo si no tiene productos activos asociados ni subcategorías activas; si los tiene, 409 con código propio y nada cambia (ya no se re-asignan hijas).
- **Ingredientes de un producto (spec §5.2):** `GET /productos/{id}/ingredientes` (público, con la visibilidad de C-08) y `DELETE /productos/{id}/ingredientes/{ing_id}` (ADMIN, 204).
- **Sin migración:** ningún cambio de esquema (las reglas nuevas son de aplicación; los índices parciales ya existen desde la 001).

**Fuera de alcance (con dueño):** sacar todos los `HTTPException` de los services y cortar `Session` en routers (C-25a; acá solo se migra lo que se toca); estado de pago dentro del detalle del pedido (C-12); WebSocket y rol `COCINA` (C-26/C-27, PA-07); retiro de `GET /usuarios/me` (C-14/C-25a); slowapi y límite de login 5/15 min (C-03); filtros de pedidos más allá de estado y fecha.

## Capabilities

### New Capabilities
- `api-conventions`: convenciones transversales del contrato HTTP — paginación `page/size` con `{items,total,page,size,pages}` y formato de error `{detail, code, field}` con catálogo de códigos, incluido 429 y 500.
- `order-api`: superficie HTTP de pedidos — listado por alcance de rol con filtros, detalle e historial para propietario/gestores, cambio de estado `{nuevo_estado, motivo}`, cancelación propia por `DELETE`, listado de cocina, rutas retiradas.
- `catalog-integrity`: reglas de integridad del catálogo por API — unicidad entre activos con 409 y borrado de categoría con validación de productos y subcategorías.
- `product-ingredients`: lectura pública y quita (ADMIN) de los ingredientes asociados a un producto.

### Modified Capabilities
- `order-lifecycle`: los escenarios usan `nuevo_estado` y la cancelación del dueño por `DELETE /pedidos/{id}`.
- `rbac-authorization`: la matriz deja de prohibir `GET /pedidos` a `CLIENT` (ve solo los propios); la cancelación propia se hace por `DELETE /pedidos/{id}`.
- `backend-runtime`: las rutas montadas son las del contrato vigente (ya no «los mismos paths que el código actual») y las retiradas responden 404.

## Impact

- **Código**: `core/schemas.py` + `core/pagination.py` (nuevo), `core/repository.py` (paginado genérico), `core/service.py`, `core/errors.py` (nuevo, error de dominio sin FastAPI), `utils/errores.py` + `main.py` (handlers), `core/rate_limit/rate_limit_middleware.py`; `pedidos/{router,service,repository,schemas}.py`; `direcciones_entrega/{router,service}.py`; `categorias/{service,repository}.py`; `productos/{router,service,repository}.py`; `ingredientes/service.py`; `unidades_medida/service.py`; `usuarios/service.py` (paginado).
- **API**: cambios incompatibles listados arriba; OpenAPI regenerado solo.
- **Tests**: `tests/support/rbac_matriz.py` (filas con dueño C-11 + 2 filas nuevas de productos/ingredientes); tests existentes que usan `/mis-pedidos`, `estado_hacia`, `["data"]`, `offset/limit` o esperan 400 por duplicado.
- **Datos**: sin migración (cabeza sigue en `002`) ni variables nuevas.
- **Docs**: `knowledge-base/02` (§API REST), `05` (RN-GL-01, RN-CA-02/03), `07` (flujos de pedidos), `09` (DT-17, DT-18, DT-19 resueltas), `10` (IN-11, IN-17, IN-19, IN-24 cerradas; PA-14 asumida spec).
