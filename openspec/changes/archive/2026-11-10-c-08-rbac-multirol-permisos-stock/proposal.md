# Proposal — C-08 `rbac-multirol-permisos-stock`

## Why

La spec (integrador v5.0, `[INT]`) define cuatro roles acumulables: un usuario puede tener varios y sus permisos son la **unión** de los de sus roles. El código evalúa bien los roles en `require_role`, pero la FSM de pedidos decide con `current_user.roles[0]`. El resultado depende del orden en que se cargan los roles: un usuario `STOCK + PEDIDOS` puede recibir un 500 (`KeyError`, DT-14 / IN-13) y un `CLIENT + ADMIN` puede quedar sin poder avanzar pedidos. Además, el rol `STOCK` no tiene cómo actualizar `stock_cantidad`, porque solo el `PUT` de ADMIN lo permite. `PATCH /disponibilidad` es un toggle no idempotente, y la lectura pública del catálogo deja ver productos no disponibles y eliminados (DT-16, IN-14, auditoría PA-09 de C-01, RN-PR-03). Es un change de seguridad de la Fase 0 y bloquea a C-09 (FSM con todos los roles), C-17a/C-17b (vistas por rol) y C-23 (gestión de roles).

Problemas observados en el código (`backend/app/core/deps.py`, `backend/app/modules/{pedidos,productos,ingredientes,categorias,unidades_medida,pagos}/`):

- **`roles[0]` en la FSM (DT-14)**: `PATCH /pedidos/{id}/estado` y `PATCH /pedidos/mis-pedidos/{id}/cancelar` pasan `current_user.roles[0].codigo` a `PedidoService`. `TRANSICIONES[rol]` da `KeyError` (500) si ese rol es `STOCK` o `COCINA` (`COCINA` está habilitado por `require_role` en `/estado`).
- **Fuente de autoridad de los roles sin escribir**: `require_role` usa los roles de la BD y el access lleva un claim `roles` que puede quedar desactualizado hasta 30 minutos. Ninguna regla dice cuál manda.
- **STOCK sin endpoint de stock (DT-16, PA-09 gap 1)**: la spec dice que STOCK «actualiza `stock_cantidad` y `disponible`», pero el único camino es `PUT /productos/{id}`, que es solo ADMIN.
- **`PATCH /productos/{id}/disponibilidad` es un toggle sin body (PA-09 gap 2)**: no es idempotente y no recibe el valor. La spec lo define como «cambiar `disponible` (true/false)».
- **Lectura pública con eliminados (PA-09 gaps 3 y 8, RN-PR-03, RN-GL-02)**: `GET /productos` acepta `estado=ELIMINADO|TODOS` y `disponible=false`, y `GET /productos/{id}` acepta `include_deleted=true`, sin autenticación. `ingredientes`, `categorias` y `unidades-medida` repiten el patrón (`estado`, `incluir_eliminado`).
- **Menor**: el 403 de `require_role` incluye en el `detail` los roles del usuario.

## What Changes

- **Autorización multi-rol con un único mecanismo**: toda decisión de permisos evalúa el **conjunto completo** de roles del usuario (unión). Hay primitivas puras y genéricas en `core/` («tiene alguno de estos roles», «unión de permisos por rol») y una dependencia que expone los roles del usuario autenticado. `require_role` se apoya en ellas. Ningún router ni service vuelve a leer `roles[0]` (el WebSocket queda fuera, ver abajo).
- **Fuente de autoridad de los roles**: los roles **leídos de la BD en cada request** son la autoridad. El claim `roles` del access es informativo: lo usa el frontend para la UI y ninguna decisión de autorización lo usa. Es la recomendación del design. **Queda como decisión explícita del usuario** (Open Questions, OQ-1); specs y tasks aplican este valor por defecto.
- **Ajuste mínimo en pedidos (no adelanta C-09)**: `PedidoService` recibe el conjunto de roles y calcula las transiciones permitidas como la unión de las filas de `TRANSICIONES` de esos roles. Un rol sin fila (`STOCK`, `COCINA`) no aporta transiciones, así que la respuesta pasa a ser 409 y no 500. El contenido de `TRANSICIONES` no cambia. El webhook de pagos pasa el conjunto `{ADMIN}` en lugar del string `"ADMIN"`, sin cambio de comportamiento.
- **BREAKING — `PATCH /productos/{id}/disponibilidad` fija el valor**: body obligatorio `{"disponible": bool}`. Es idempotente y responde 200 con el producto. Sin body responde 422. Roles: ADMIN, STOCK.
- **Nuevo `PATCH /productos/{id}/stock`**: body `{"stock_cantidad": int >= 0}`, seteo absoluto e idempotente. Responde 200 con el producto y 422 si el valor es negativo o vienen campos extra. Roles: ADMIN, STOCK. No cambia `disponible` (RN-PR-02). La spec `[INT]` no define este endpoint: el contrato es una propuesta (OQ-2). El descuento de stock por pedidos sigue siendo de C-10 (DD-20).
- **BREAKING — Visibilidad del catálogo (RN-PR-03, RN-GL-02)**: un anónimo, `CLIENT` o `PEDIDOS` solo ve productos `disponible = true` y no eliminados. Ningún filtro amplía esa visibilidad: `estado`, `disponible=false` e `include_deleted` se intersectan con ella y no dan error. ADMIN y STOCK ven productos no disponibles. Solo ADMIN ve registros eliminados, tanto en productos como en ingredientes, categorías y unidades de medida. Las rutas siguen siendo públicas. Si el pedido trae un access inválido, la respuesta es 401.
- **403 sin revelar roles**: el `detail` pasa a ser «Permisos insuficientes», sin listar los roles del usuario.
- **Matriz RBAC como test**: una tabla de datos (endpoint → roles permitidos) alimenta tests parametrizados por rol simple y por combinaciones multi-rol, sobre PostgreSQL real.
- **Sin cambio de esquema**: `ck_producto_stock_no_negativo` ya existe, así que no hay migración. **Sin variables de entorno nuevas.**

**Fuera de alcance (con dueño):**

- FSM de 6 estados, `EN_CAMINO`, confirmación manual por forma de pago, actor Sistema del webhook y contenido de `TRANSICIONES`: **C-09** (y C-05 para el actor Sistema).
- Descuento de stock al confirmar: **C-10**.
- `HTTPException` en services, unicidad con 409 y que excluya eliminados, formato de errores, `GET /pedidos/{id}` e historial para el propietario: **C-11 / C-25a**.
- Autenticación y propiedad en pagos (DT-05): **C-04**.
- WebSocket (`roles[0]` en `/pedidos/cocina/ws`, autenticación del handshake) y el rol `COCINA` (DD-23): **C-26 / C-27**. `COCINA` sigue en `require_role` de `/estado` y `/cocina/pedidos`, igual que hoy.
- `GET /productos/{id}/ingredientes` y `DELETE /productos/{id}/ingredientes/{ing_id}` de la spec, que no existen en el código: se reportan como gap (OQ-5) y no se implementan acá.
- DT-25 (`Session` en routers, `core/deps.py` → `modules/`): no se amplía. Los routers que se tocan no suman imports de `Session`.

**Governance: CRÍTICO** (RBAC). El change se detiene en estos artefactos y el usuario los aprueba antes de cualquier código (regla dura 11).

## Capabilities

### New Capabilities
- `rbac-authorization`: autorización por roles del backend. Cubre la evaluación por unión de todos los roles del usuario, la fuente de autoridad de los roles (BD frente al claim), la respuesta 401/403, la matriz de permisos por endpoint (incluidos los permisos limitados de STOCK) y la evaluación multi-rol de las transiciones de pedido.
- `catalog-stock-management`: edición manual de inventario: fijar `disponible` y `stock_cantidad` de un producto (contratos, idempotencia, validación) sin dar escritura sobre el resto del producto.
- `catalog-visibility`: qué ve cada lector en las lecturas públicas del catálogo (productos, ingredientes, categorías, unidades de medida): solo lo disponible y no eliminado para el público; no disponibles y eliminados solo para lectores privilegiados.

### Modified Capabilities
Ninguna. `auth-session` ya exige el claim `roles` en el access y su actualización en el refresh. C-08 no cambia esos requisitos: define en `rbac-authorization` que el claim no autoriza.

## Impact

- **Código**: `backend/app/core/` (primitivas de permisos nuevas, `deps.py`: dependencia de roles, dependencia de lector privilegiado opcional y `require_role` refactorizada, helper de visibilidad por estado); `backend/app/modules/pedidos/{router,service}.py` (conjunto de roles, unión de transiciones); `backend/app/modules/pagos/service.py` (una línea: `{ADMIN}`); `backend/app/modules/productos/{router,service,schemas}.py` (disponibilidad con body, endpoint de stock, visibilidad); `backend/app/modules/{ingredientes,categorias,unidades_medida}/{router,service}.py` (visibilidad de eliminados).
- **API**: BREAKING en `PATCH /productos/{id}/disponibilidad` (body obligatorio) y en las lecturas públicas del catálogo (se dejan de exponer no disponibles y eliminados). Endpoint nuevo `PATCH /productos/{id}/stock`. Hoy no hay frontend (C-13+), así que no hay clientes reales que migrar.
- **Tests**: helper para emitir un Bearer de un usuario con un conjunto arbitrario de roles (sin bcrypt), tabla de matriz RBAC, tests de matriz por rol y multi-rol, y tests de pedidos multi-rol, stock, disponibilidad y visibilidad. Ningún test existente debería romperse (ver design).
- **Esquema / configuración**: sin migración (la cabeza sigue en `002`) y sin variables nuevas.
- **Documentación**: `knowledge-base/03` (matriz, fuente de autoridad, contratos de STOCK), `09` (DT-14 y DT-16 resueltas, DD-11 actualizada, decisión nueva sobre la autoridad de los roles), `10` (IN-13, IN-14, gaps de PA-09 cerrados por C-08), `02` (resumen de la API de productos) y `CHANGES.md` (puntos de partida para C-09, C-11, C-17b, C-27).
