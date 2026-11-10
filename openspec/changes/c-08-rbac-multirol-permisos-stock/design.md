# Design — C-08 `rbac-multirol-permisos-stock`

## Context

- Motivación y alcance: ver `proposal.md` (Why / What Changes). Requisitos: `specs/rbac-authorization/spec.md`, `specs/catalog-stock-management/spec.md` y `specs/catalog-visibility/spec.md`.
- Estado del código relevante (relevado el 2026-11-10 sobre `dev`):
  - `backend/app/core/deps.py`: `get_access_claims` (claims validados del access, sin BD: `usuario_id`, `sid`, `roles`), `get_current_user` (carga el `Usuario` por `sub` en cada pedido, 401 si no existe), `get_current_active_user` (404 «Cuenta de usuario desactivada» si tiene `deleted_at`) y `require_role(allowed)`. `require_role` **ya** evalúa todos los roles de la BD con «alguno de»: el problema multi-rol no está ahí. Su 403 lista los roles del usuario. `core/deps.py` importa `UsuarioUnitOfWork`, `get_uow` y `Usuario` desde `modules/usuarios` (DT-25, existente).
  - `backend/app/modules/pedidos/router.py`: `PATCH /{id}/estado` y `PATCH /mis-pedidos/{id}/cancelar` pasan `current_user.roles[0].codigo`. El WebSocket `/cocina/ws` usa `user.roles[0].codigo` para la *room* y autentica por la cookie `access_token`, que no existe desde C-02.
  - `backend/app/modules/pedidos/service.py`: `TRANSICIONES = {ADMIN, PEDIDOS, CLIENT}` (DD-11). `_validar_transicion` indexa `self.TRANSICIONES[rol]`, lo que da `KeyError` (500) para `STOCK` o `COCINA`.
  - `backend/app/modules/pagos/service.py`: el webhook llama a `cambiar_estado_pedido(..., rol="ADMIN")`.
  - `backend/app/modules/productos/`: `PATCH /{id}/disponibilidad` llama a `toggle_disponibilidad` (sin body). No hay endpoint de stock. `GET /` acepta `estado` y `disponible` (`None` = todos) y `GET /{id}` acepta `include_deleted`, sin autenticación. El modelo ya tiene `CheckConstraint("stock_cantidad >= 0")`.
  - `ingredientes`, `categorias` y `unidades_medida`: lectura pública con `estado` e `incluir_eliminado` libres. `GET /categorias/arbol` ya filtra eliminadas en el repositorio.
  - El access lleva `roles` (C-02, spec `auth-session`). `/auth/refresh` emite un access con los roles actuales.
- Spec `[INT]` (integrador v5.0): §4.2 «STOCK: leer productos, actualizar `stock_cantidad` y `disponible`, ver ingredientes»; §5.2 define `PATCH /productos/{id}/disponibilidad` «Cambiar disponible (true/false)» para ADMIN y STOCK, y **no** define un endpoint de stock; §4.1 paso 5 dice «`require_role([Rol.ADMIN])` verifica roles **del token**» (ver OQ-1).
- Restricciones: reglas duras de `CLAUDE.md` (capas, sin lógica ni `Session` nuevas en routers, extender bases genéricas, type hints, spec por encima del código), Strict TDD en apply, governance **CRÍTICO** y el agente no lee ni escribe `.env*`.

## Goals / Non-Goals

**Goals:**
- Un único mecanismo de autorización por roles (unión), reutilizable desde dependencias y services, sin códigos de rol duplicados en lógica.
- Dejar escrita y testeada la fuente de autoridad de los roles.
- Que dejar de usar `roles[0]` no adelante la FSM de C-09: misma tabla `TRANSICIONES`, otra forma de consultarla.
- Contratos idempotentes para el inventario manual (stock y disponibilidad).
- Una tabla de matriz RBAC ejecutable que cambios posteriores (C-04, C-09, C-11) actualicen en un solo lugar.

**Non-Goals:**
- Permisos finos por acción («permission strings») o tabla de permisos en la BD: la spec define 4 roles fijos.
- Cambiar el contenido de `TRANSICIONES`, `EN_CAMINO` y la confirmación por forma de pago (C-09).
- Cortar DT-25 (C-25a) o mover `HTTPException` fuera de los services (C-11/C-25a).
- WebSocket y `COCINA` (C-26/C-27, DD-23).

## Cambio de modelo (explícito)

| | Código actual | Spec | Modelo adoptado |
|---|---|---|---|
| **Evaluación de roles en endpoints** | `require_role`: «alguno de» sobre los roles de la BD. | `require_role([Rol.X])`, 403 si no hay rol suficiente. | Igual, pero construido sobre una primitiva pura `tiene_algun_rol` y una dependencia `get_current_roles`. El 403 no lista roles. |
| **Evaluación de roles en la FSM** | `TRANSICIONES[roles[0]]`: depende del orden y da `KeyError` para `STOCK`/`COCINA`. | Un usuario puede tener varios roles; los permisos son la unión. | Unión de `TRANSICIONES[r][estado]` para todo `r` del usuario. Un rol sin fila no aporta nada (409, no 500). |
| **Fuente de autoridad de los roles** | `require_role` usa la BD; el claim `roles` existe pero nadie lo lee; no hay regla escrita. | §4.1: «verifica roles del token». | **BD en cada pedido** (por defecto, OQ-1). El claim es informativo (UI del frontend). |
| **Disponibilidad** | `PATCH /{id}/disponibilidad` sin body: invierte el valor (toggle). | «Cambiar disponible (true/false)», ADMIN y STOCK. | Body `{"disponible": bool}`, fija el valor, idempotente. |
| **Stock** | Solo `PUT /{id}` (ADMIN, junto al resto del producto). | STOCK actualiza `stock_cantidad`; sin endpoint definido. | `PATCH /{id}/stock` con `{"stock_cantidad": int >= 0}` absoluto, ADMIN y STOCK (OQ-2). |
| **Lectura pública del catálogo** | Cualquiera ve no disponibles y eliminados con `estado`, `disponible`, `include_deleted`/`incluir_eliminado`. | Público: solo `disponible` y no eliminados; los GET filtran `deleted_at`. | Público, `CLIENT` y `PEDIDOS`: solo lo visible. ADMIN y STOCK: además no disponibles. Solo ADMIN: eliminados. Los filtros intersectan, no amplían. |

## Relevamiento de endpoints

Leyenda: **Hoy** = lo que exige el código; **Objetivo** = matriz de `knowledge-base/03` y spec `[INT]`; **C-08** = cómo queda después de este change. `=` sin cambio. «Aut.» = autenticado (cualquier rol activo). Las rutas son relativas a `/api/v1`.

| # | Método | Ruta | Hoy | Objetivo | C-08 | Diferencia / dueño |
|---|---|---|---|---|---|---|
| 1 | GET | `/health` (sin prefijo) | Público | Público | = | — |
| 2 | POST | `/auth/register` | Público | Público | = | — |
| 3 | POST | `/auth/login` | Público | Público (rate limit) | = | rate limit: C-03 |
| 4 | POST | `/auth/refresh` | Público (cookie) | Público | = | — |
| 5 | POST | `/auth/logout` | Bearer (claims) | Bearer | = | — |
| 6 | POST | `/auth/logout-all` | Bearer (claims) | Bearer | = | — |
| 7 | GET | `/auth/me` | Aut. | Aut. | = | — |
| 8 | GET | `/usuarios/me` | Aut. | RU todos | = | retiro: C-14/C-25a |
| 9 | PATCH | `/usuarios/me` | Aut. | RU todos | = | — |
| 10 | POST | `/admin/usuarios/createUser` | ADMIN | ADMIN | = | — |
| 11 | GET | `/admin/usuarios/` | ADMIN | ADMIN | = | — |
| 12 | PATCH | `/admin/usuarios/{id}` | ADMIN | ADMIN | = | — |
| 13 | DELETE | `/admin/usuarios/{id}` | ADMIN | ADMIN | = | — |
| 14–19 | POST/GET/GET/PATCH/PATCH/DELETE | `/direcciones/`, `/{id}`, `/{id}/principal` | Aut., solo propias | KB 03: CLIENT propias; spec: «CRUD por usuario» | = | OQ-4 |
| 20 | POST | `/categorias/` | ADMIN | ADMIN (STOCK solo lectura `[INT]`) | = | — |
| 21 | GET | `/categorias/` | Público, `estado` libre | Público R; eliminados no visibles | eliminados solo ADMIN | **cambia** (D8) |
| 22 | GET | `/categorias/arbol` | Público (solo activas) | Público R | = | — |
| 23 | GET | `/categorias/{id}` | Público, `incluir_eliminado` libre | Público R | eliminados solo ADMIN | **cambia** (D8) |
| 24 | PATCH | `/categorias/{id}` | ADMIN | ADMIN | = | — |
| 25 | DELETE | `/categorias/{id}` | ADMIN | ADMIN | = | validación: C-11 |
| 26 | GET | `/productos/` | Público, `estado`/`disponible` libres | Público: solo disponibles y no eliminados | público restringido; ADMIN/STOCK no disponibles; ADMIN eliminados | **cambia** (D8, D9) |
| 27 | GET | `/productos/{id}` | Público, `include_deleted` libre | ídem | ídem | **cambia** (D8, D9) |
| 28 | POST | `/productos/` | ADMIN | ADMIN | = | — |
| 29 | PUT | `/productos/{id}` | ADMIN | ADMIN | = | — |
| 30 | PATCH | `/productos/{id}/disponibilidad` | ADMIN, STOCK (toggle) | ADMIN, STOCK (true/false) | ADMIN, STOCK, body obligatorio | **cambia contrato** (D6) |
| 31 | DELETE | `/productos/{id}` | ADMIN | ADMIN | = | — |
| 32 | PATCH | `/productos/{id}/imagenes` | ADMIN | ADMIN (RN-PR-07) | = | — |
| 33 | POST | `/productos/{id}/ingredientes` | ADMIN | ADMIN | = | — |
| 34 | PATCH | `/productos/{id}/stock` | **no existe** | STOCK actualiza `stock_cantidad` | ADMIN, STOCK | **nuevo** (D7) |
| — | GET / DELETE | `/productos/{id}/ingredientes[/{ing_id}]` | **no existen** | Público / ADMIN (spec §5.2) | no se crean | OQ-5 |
| 35 | POST | `/ingredientes/` | ADMIN | ADMIN (STOCK R `[INT]`) | = | — |
| 36 | GET | `/ingredientes/` | Público, `estado` libre | Público R | eliminados solo ADMIN | **cambia** (D8) |
| 37 | GET | `/ingredientes/{id}` | Público, `incluir_eliminado` libre | Público R | eliminados solo ADMIN | **cambia** (D8) |
| 38 | PATCH | `/ingredientes/{id}` | ADMIN | ADMIN | = | — |
| 39 | DELETE | `/ingredientes/{id}` | ADMIN | ADMIN | = | — |
| 40 | POST | `/unidades-medida/` | ADMIN | ADMIN | = | — |
| 41 | GET | `/unidades-medida/` | Público, `estado` libre | Público R | eliminados solo ADMIN | **cambia** (D8) |
| 42 | GET | `/unidades-medida/{id}` | Público, `incluir_eliminado` libre | Público R | eliminados solo ADMIN | **cambia** (D8) |
| 43 | PATCH | `/unidades-medida/{id}` | ADMIN | ADMIN | = | — |
| 44 | DELETE | `/unidades-medida/{id}` | ADMIN | ADMIN | = | — |
| 45 | POST | `/uploads/imagen` | ADMIN | ADMIN | = | — |
| 46 | DELETE | `/uploads/imagen/{public_id}` | ADMIN | ADMIN | = | — |
| 47 | POST | `/pedidos/` | CLIENT | CLIENT | = | — |
| 48 | GET | `/pedidos/mis-pedidos` | CLIENT | CLIENT (propios) | = | contrato: C-11 |
| 49 | GET | `/pedidos/mis-pedidos/{id}` | CLIENT + propiedad | CLIENT propio | = | contrato: C-11 |
| 50 | PATCH | `/pedidos/mis-pedidos/{id}/cancelar` | CLIENT; FSM con `roles[0]` | CLIENT propio, PENDIENTE/CONFIRMADO | CLIENT; FSM con la unión | **cambia evaluación** (D4) |
| 51 | GET | `/pedidos/` | ADMIN, PEDIDOS | ADMIN, PEDIDOS (todos) | = | paginación: C-11 |
| 52 | GET | `/pedidos/{id}` | ADMIN, PEDIDOS | spec: propietario/ADMIN | = | **C-11** |
| 53 | GET | `/pedidos/{id}/historial` | ADMIN, PEDIDOS | spec: propietario/ADMIN; KB: ADMIN, PEDIDOS y propio | = | **C-11** |
| 54 | PATCH | `/pedidos/{id}/estado` | ADMIN, PEDIDOS, COCINA; FSM con `roles[0]` | ADMIN, PEDIDOS | mismos roles; FSM con la unión; COCINA 500 → 409 | **cambia evaluación** (D4); FSM: C-09; COCINA: C-26 |
| 55 | DELETE | `/pedidos/{id}` | ADMIN (soft delete) | KB: ADMIN; spec: cancelar propio | = | **C-11** |
| 56 | GET | `/pedidos/cocina/pedidos` | COCINA, ADMIN, PEDIDOS | ADMIN, PEDIDOS (+COCINA, no especificado) | = | C-26 |
| 57 | WS | `/pedidos/cocina/ws` | cookie (rota desde C-02); `roles[0]` para la room | — | = | **C-27** |
| 58 | WS | `/pedidos/{id}/ws` | cookie (rota desde C-02); propietario | — | = | C-27 |
| 59–63 | GET | `/estadisticas/{ventas,productos-top,pedidos-por-estado,ingresos,resumen}` | ADMIN | ADMIN | = | — |
| 64 | POST | `/pagos/crear` | **Público** | CLIENT propietario | = | **C-04** (DT-05) |
| 65 | POST | `/pagos/webhook` | Público | Público con firma | = | C-05 |
| 66 | GET | `/pagos/{pedido_id}` | **Público** | propietario/ADMIN | = | **C-04** (DT-05) |
| 67 | GET | `/pagos/redirect/{pedido_id}/{status}` | Público | no está en la spec | = | C-12 |

**Resumen**: 66 endpoints existentes (64 HTTP + 2 WebSocket) y 1 nuevo. C-08 cambia **12**: 1 nuevo (`PATCH /productos/{id}/stock`), 1 contrato (`PATCH /disponibilidad`), 8 lecturas públicas por visibilidad (filas 21, 23, 26, 27, 36, 37, 41, 42) y 2 evaluaciones de la FSM (filas 50, 54). Las escrituras de categorías, ingredientes y unidades **ya** cumplen la matriz `[INT]` (solo ADMIN), así que DT-16 se reduce al stock. Quedan diferencias con dueño en otro change: 52, 53, 55 (C-11), 64 y 66 (C-04), 56–58 (C-26/C-27) y 14–19 (OQ-4).

## Decisions

### D1. Fuente de autoridad de los roles: la BD en cada pedido (valor por defecto, OQ-1)

| | A. Roles de la BD en cada pedido (recomendada) | B. Claim `roles` del access |
|---|---|---|
| Quitar un rol | Efecto inmediato en el pedido siguiente. | El rol sigue vigente hasta 30 min (vida del access). No hay lista negra (C-02, RN-AU-06). Para cortarlo antes habría que revocar sesiones al cambiar roles. |
| Agregar un rol | Inmediato. | Recién después del próximo `/auth/refresh`. |
| Costo | Toda ruta con rol ya pasa por `get_current_active_user`, que carga el `Usuario` en cada pedido (C-02 D1 lo mantuvo para «roles y estado»). Suma una sola consulta chica (la relación `roles`). | Ahorra esa consulta, pero no la carga del usuario: igual hay que verificar `deleted_at` en la BD. |
| Coherencia con C-02 | C-02 hizo **sin estado la sesión** (no se consulta `sesion` por pedido), no al usuario. A no cambia eso. | Consistente con el texto de §4.1 paso 5. |
| Riesgo | Ninguno nuevo. | Escalada de privilegios temporal tras quitar un rol (por ejemplo, un ADMIN despedido). |

**Recomendación: A.** El costo marginal es una consulta sobre un usuario que ya se carga, y la seguridad al quitar un rol es inmediata. El claim queda como dato de UI: el frontend (C-13b) lo puede usar para mostrar menús, pero la fuente para la UI debería ser `GET /auth/me`, que lee la BD. Regla escrita: **ninguna dependencia ni service decide permisos con `AccessClaims.roles`**. Hoy `get_access_claims` solo lo usan logout y logout-all, que no autorizan por rol. Un test fija la regla: un access con claim `ADMIN` de un usuario que solo tiene `CLIENT` en la BD recibe 403.
- *Alternativa descartada (B)*: ver tabla. Si el usuario la elige, cambian el requisito «Los roles guardados en la base son la autoridad» y las tareas 2.4–2.5. El resto del diseño no cambia, porque las primitivas de D2 reciben un conjunto de códigos sin importar de dónde sale.

### D2. Un único mecanismo de autorización
- `backend/app/core/permissions.py` (nuevo, puro, sin imports de `modules/` ni de FastAPI):
  - `tiene_algun_rol(roles: AbstractSet[str], permitidos: Iterable[str]) -> bool`.
  - `union_por_roles(mapa: Mapping[str, Mapping[K, AbstractSet[V]]], roles: AbstractSet[str], clave: K) -> frozenset[V]`: une `mapa[r][clave]` de cada rol. Un rol ausente del mapa o una clave ausente aportan el conjunto vacío (nunca `KeyError`). Genérica (`TypeVar` K, V), así sirve para `TRANSICIONES` y para cualquier mapa futuro por rol.
- `backend/app/core/deps.py`:
  - `get_current_roles(user = Depends(get_current_active_user)) -> frozenset[str]`: el único lugar que convierte `user.roles` en códigos (fuente D1).
  - `require_role(allowed)` pasa a depender de `get_current_roles` y de `tiene_algun_rol`. Sigue devolviendo el `Usuario` (compatibilidad con los usos actuales, que la declaran en `dependencies=[...]`).
  - `lector_privilegiado(roles: list[str])`: fábrica de dependencias para lecturas públicas (D8).
- Los routers declaran **qué roles** (configuración declarativa, como hoy) y nunca **cómo** se evalúan. Los services reciben un `AbstractSet[str]` de roles (pedidos) o un `bool` (visibilidad), nunca un `Usuario`.
- *Alternativa descartada*: un `Enum` de roles en `core/enums.py` usado en todos los routers. Mejora el tipado, pero obliga a tocar todos los routers sin cambiar comportamiento. Queda como mejora para C-25a.
- *Alternativa descartada*: permisos por acción (`"productos:stock:write"`) con un mapa rol → permisos. Es más flexible, pero sobra con 4 roles fijos y duplicaría la matriz de la spec.

### D3. 403 neutral
El `detail` del 403 de `require_role` pasa a «Permisos insuficientes», sin roles propios ni requeridos (no revela la configuración RBAC). El formato unificado (`code` `HTTP_403`) ya lo da el handler global. **Cambia** el texto actual.

### D4. Pedidos: ajuste mínimo para dejar `roles[0]`
- Router: `PATCH /{id}/estado` y `PATCH /mis-pedidos/{id}/cancelar` reciben `roles: Annotated[frozenset[str], Depends(get_current_roles)]` y lo pasan al service. No hay lógica nueva en el router.
- `PedidoService.cambiar_estado_pedido(..., roles: AbstractSet[str], ...)`, `cancelar_pedido_propio(..., roles, ...)` y `_validar_transicion(..., roles)` usan `union_por_roles(self.TRANSICIONES, roles, estado_actual)`. El log de auditoría muestra los roles ordenados. **`TRANSICIONES` no cambia** (C-09).
- La cancelación propia usa la misma unión (un solo mecanismo). Consecuencia: un usuario `CLIENT + ADMIN` puede cancelar su propio pedido en `EN_PREP` por `/mis-pedidos`. Es lo mismo que ya puede hacer por `/estado`, porque los permisos son del usuario y no del endpoint (ver OQ-7).
- `pagos/service.py`: `rol="ADMIN"` pasa a `roles=frozenset({"ADMIN"})`. El actor Sistema y `usuario_id` NULL son de C-05/C-09.
- **Cambia** el comportamiento: los multi-rol se evalúan por unión, y `STOCK`/`COCINA` (o cualquier rol sin fila) reciben 409 en lugar de 500.

### D5. Qué queda para C-09
- Contenido de `TRANSICIONES` (6 estados, `EN_CAMINO`, quitar `EN_PREP→ENTREGADO`), confirmación manual solo para `EFECTIVO`/`TRANSFERENCIA`, punto único de entrada a CONFIRMADO y actor Sistema. C-09 parte de la firma con `roles: AbstractSet[str]` y de `union_por_roles`, sin volver a tocar la autorización.
- Quitar `COCINA` de `require_role` en `/estado` y `/cocina/pedidos` es de C-26 (DD-23). Mientras tanto, un `COCINA` recibe 409 en `/estado`.
- El WebSocket (`roles[0]` para la room, cookie rota) es de C-27. Es el **único** `roles[0]` que queda, y se documenta en `CHANGES.md` [C-27].

### D6. Disponibilidad: fijar el valor
- Schema `ProductoDisponibilidadUpdate(disponible: bool)` (obligatorio, `extra="forbid"`). `ProductoService.fijar_disponibilidad(producto_id, disponible)` reemplaza a `toggle_disponibilidad`. Responde 200 `ProductoReadFull`, 404 si el producto no existe o está eliminado (`_get_or_404` existente) y 422 sin body.
- Es idempotente por construcción (asignación, no inversión). **BREAKING**: hoy no hay clientes (el frontend llega en C-13) y ningún test usa el endpoint.

### D7. Stock: endpoint propio con seteo absoluto (OQ-2)
- `PATCH /productos/{id}/stock`, body `ProductoStockUpdate(stock_cantidad: int = Field(ge=0))`, `extra="forbid"`. Roles: `ADMIN`, `STOCK`. 200 `ProductoReadFull`; 422 si el valor es negativo, falta o vienen campos extra; 404 si el producto no existe o está eliminado.
- Seteo absoluto: es idempotente (un reintento de red no duplica) y refleja un conteo de inventario. El CHECK de la BD es la segunda barrera.
- No toca `disponible` (RN-PR-02 `[INT]`: «toggle manual independiente del stock»). PA-12 (auto-deshabilitar con stock 0) sigue abierta y no se adelanta.
- DRY: `fijar_disponibilidad` y `fijar_stock` comparten un helper privado del service que aplica un cambio parcial sobre un producto no eliminado, reutilizando `_get_or_404` y `_apply_update_fields` de `base_service`.
- `PUT /productos/{id}` (ADMIN) sigue pudiendo cambiar stock y disponibilidad junto al resto.
- *Alternativa descartada*: delta (`+N`/`-N`), como sugiere US-021 de `docs/Historias de Usuario.md` (`[DESC]`, `{cantidad}`). No es idempotente y obliga a un `UPDATE ... SET stock = stock + :n` con chequeo de no negativo. Se deja como pregunta (OQ-2).
- *Alternativa descartada*: abrir `PUT /productos/{id}` a STOCK con un schema recortado. Mezcla dos contratos en un endpoint y obliga a lógica de roles en el service.

### D8. Visibilidad pública: lector privilegiado opcional e intersección de filtros
- Dependencia `lector_privilegiado(roles)` en `core/deps.py`: usa un `OAuth2PasswordBearer(..., auto_error=False)`. Sin header, devuelve `False` (anónimo). Con header, valida el access con la misma lógica de `get_access_claims` (extraída a una función compartida, DRY): si es inválido, vencido o no tiene `sid`, responde **401**. Después carga el usuario con el mismo `get_uow` ya importado (sin imports nuevos hacia `modules/`), aplica la regla de usuario activo existente y devuelve `tiene_algun_rol(roles_bd, roles)`.
- El router pasa `solo_publicos = not privilegiado` al service. Sin lógica de roles en el router.
- Regla en el service (intersección, nunca error): un helper en `core/enums.py`, `restringir_estado(estado, solo_publicos) -> EstadoFiltro | None`, devuelve `ACTIVO` para `ACTIVO`/`TODOS` y `None` (resultado vacío) para `ELIMINADO` cuando `solo_publicos`. `include_deleted`/`incluir_eliminado` se ignoran si `solo_publicos`. En productos, además, `disponible` se fuerza a `True`: `disponible=false` da una página vacía y el detalle de un no disponible da 404.
- La lectura sigue siendo pública: no cambia ningún contrato de entrada, solo lo que se devuelve.
- *Alternativa descartada*: responder 403 cuando el público pide `estado=ELIMINADO`. Es más explícito, pero rompe clientes que mandan el filtro por defecto y revela que el filtro existe. La spec dice «los GET filtran `deleted_at`», no «rechazan».
- *Alternativa descartada*: tratar un access inválido como anónimo. Es más tolerante, pero oculta errores del cliente y le muestra a un ADMIN con el access vencido un catálogo recortado sin avisar. Con 401, el interceptor del frontend renueva y reintenta (OQ-8).

### D9. Lectores privilegiados por recurso
- Productos no disponibles: `ADMIN`, `STOCK` (RN-PR-03).
- Registros eliminados (productos, ingredientes, categorías, unidades): solo `ADMIN` (RN-GL-02: «los endpoints admin pueden incluirlos»). STOCK gestiona inventario de productos vivos y no necesita ver bajas.
- Los roles se declaran en el router: `lector_privilegiado(["ADMIN", "STOCK"])` para disponibilidad de productos y `lector_privilegiado(["ADMIN"])` para eliminados. Productos usa las dos dependencias.

### D10. Capas y DT-25
- `core/permissions.py` no importa de `modules/`. `core/deps.py` no suma imports hacia `modules/`: reutiliza `UsuarioUnitOfWork`, `get_uow` y `Usuario`, que ya importa (DT-25 no se amplía).
- Los routers tocados no suman `Session` ni consultas. Las fábricas `get_*_service(session=Depends(get_session))` existentes quedan como están (su corrección es de C-25a).
- Los services no dependen de FastAPI más de lo que ya dependen: el corte de `HTTPException` es de C-11/C-25a.

### D11. Corte de la auditoría PA-09
| Gap PA-09 | Entra en C-08 | Destino |
|---|---|---|
| (1) STOCK no puede actualizar `stock_cantidad` | **Sí** (D7) | — |
| (2) Disponibilidad como toggle no idempotente | **Sí** (D6) | — |
| (3) Lectura pública de productos con no disponibles y eliminados | **Sí** (D8, D9) | — |
| (8) Lectura pública de ingredientes con eliminados | **Sí** (D8, D9); se extiende a categorías y unidades por RN-GL-02 | — |
| (4)(9) `HTTPException` en services | No | C-11 / C-25a |
| (5)(9) Unicidad que incluye eliminados y responde 400 en vez de 409 | No | C-11 |
| Formato de errores `{detail, code, field}` en toda la API | No | C-11 |

### D12. Sin migración ni variables nuevas
- Sin cambio de esquema: `stock_cantidad >= 0` ya está garantizado por `ck_producto_stock_no_negativo` y no hay tablas ni columnas nuevas. La cabeza sigue en `002`.
- Sin variables de entorno nuevas: no hace falta `todoAMd/env-templates-C-08.md` ni checkpoint de `.env*`.

### D13. Tests (Strict TDD en apply)
- **Helper de identidad sin bcrypt**: `tests/support/auth_helpers.py::bearer_con_roles(session, roles, *, claims_roles=None)` crea un `Usuario` con los roles en el **orden dado** y `password_hash = DUMMY_PASSWORD_HASH` (ya calculado en `core/security.py`), y emite el access con `create_access_token(sub, roles=claims_roles or roles, sid=uuid4())`. El access es sin estado (C-02 D1), así que no hace falta una fila de sesión ni pagar bcrypt por cada caso. `claims_roles` permite fabricar claims desfasados para D1. Fixture de fábrica en `tests/conftest.py`.
- **Matriz como datos**: `tests/support/rbac_matriz.py` con una fila por endpoint del relevamiento (método, ruta con ids de ejemplo, body mínimo, roles permitidos o `PUBLICO`/`AUTENTICADO`, dueño si la fila es provisoria). Excluye pagos (C-04 los cambia) y WebSocket (C-27).
- **Test de matriz** (`tests/integration/test_rbac_matriz.py`): parametrizado por (fila × perfil). Perfiles simples: anónimo, `CLIENT`, `STOCK`, `PEDIDOS`, `ADMIN`. Perfiles multi-rol: `CLIENT+STOCK`, `STOCK+PEDIDOS`, `CLIENT+ADMIN`, `PEDIDOS+CLIENT`, `STOCK+CLIENT+PEDIDOS`. Asserts: permitido ⇒ la respuesta no es 401 ni 403 (puede ser 404 o 422, porque la autorización se resuelve antes de validar el body y de buscar el recurso); denegado ⇒ 403; anónimo en ruta protegida ⇒ 401. Los ids son inexistentes (`999999`) en las escrituras para no producir efectos.
- **Tests de comportamiento**: pedidos multi-rol, disponibilidad, stock y visibilidad, con datos reales y asserts sobre el estado releído de la BD. Uno de punta a punta con el usuario `stock@foodstore.com` del seed logueado por `/auth/login`, para cubrir el camino real.
- **Tests existentes**: ninguno debería romperse. No hay tests de `/disponibilidad`; las lecturas públicas que se prueban hoy usan productos disponibles y activos; los 403 existentes (`test_categoria`, `test_ingrediente`, `test_unidad_medida`, `test_estadisticas`, `test_pedidos`, `test_exception_handlers`) solo afirman el código y `code`, no el `detail`. Si alguno falla, es una regresión: frenar y analizar, no relajar el assert.

### D14. Documentación
`knowledge-base/03` (matriz sin el `*` de STOCK, contratos de stock y disponibilidad, fuente de autoridad, visibilidad; la nota de «Rutas públicas» que mezcla categorías e ingredientes con DT-05), `09` (DT-14 y DT-16 resueltas; DD-11 sin el trade-off de `roles[0]`; decisión nueva DD-24 «Autoridad de los roles: la BD»), `10` (IN-13 e IN-14 cerradas; gaps 1, 2, 3 y 8 de PA-09 cerrados por C-08), `02` (resumen de API de productos), `06` (US-010 y US-012 alineadas a `[INT]`) y `CHANGES.md` (puntos de partida de C-08 en C-09, C-11, C-17b, C-26 y C-27).

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-10
- Mockups: N/A

## Risks / Trade-offs

- [Seteo absoluto de stock concurrente con el descuento de C-10: un STOCK que fija 10 justo después de que un pedido descontó 1 pisa el descuento] → Es inherente al conteo manual y no hay descuento automático hasta C-10. C-10 debe decidir si el seteo manual bloquea la fila (`get_for_update`) como el descuento. Anotado en `CHANGES.md` [C-10] (OQ-2 abre la alternativa delta).
- [El frontend que lee roles del claim puede mostrar acciones que el backend rechaza durante hasta 30 min tras un cambio de roles] → La autoridad es la BD (D1): el peor caso es un 403 en la UI, nunca una acción no autorizada. C-13b debería tomar los roles de `GET /auth/me`.
- [Una consulta más por pedido protegido (roles)] → Es despreciable frente a la carga del usuario, que ya existe. Si hiciera falta, `selectinload` de `roles` en `get_by_id` del repositorio de usuarios.
- [BREAKING en lecturas públicas: un consumidor que dependía de ver no disponibles o eliminados sin autenticarse deja de verlos] → No hay consumidores (C-13+). El panel admin (C-17a/C-17b) se autentica como ADMIN o STOCK.
- [Un access inválido en una lectura pública ahora da 401] → Es el comportamiento buscado (D8, OQ-8). El interceptor del frontend renueva y reintenta.
- [La matriz es grande (≈50 filas × 10 perfiles ≈ 500 casos) y puede alargar la suite] → El helper evita bcrypt y login por caso. Cada caso es un pedido HTTP sobre una transacción revertida. Si supera un umbral razonable, se marca `slow` sin dejar de correrla por defecto.
- [`COCINA` sigue habilitado por `require_role` en `/estado` y recibe 409] → Mejor que el 500 actual. Se resuelve en C-26 (DD-23).
- [La matriz de tests codifica permisos que otros changes cambiarán (C-11: `GET /pedidos/{id}`, historial, `DELETE`)] → Las filas llevan su dueño. El change dueño actualiza la fila en el mismo PR (un solo lugar).

## Migration Plan

1. Sin migración de esquema ni variables nuevas.
2. Clientes de la API: `PATCH /productos/{id}/disponibilidad` pasa a requerir `{"disponible": bool}`; el inventario manual usa `PATCH /productos/{id}/stock` con `{"stock_cantidad": n}`; para ver no disponibles o eliminados hay que autenticarse como STOCK o ADMIN (eliminados: solo ADMIN).
3. Rollback: revertir el código. No hay datos que migrar.

## Open Questions

Decisiones del usuario con el valor por defecto que aplican specs y tasks (si cambian, se ajustan con `/opsx:update` antes de apply):

- **OQ-1 — Fuente de autoridad de los roles** (contradicción spec ↔ código): la spec §4.1 paso 5 dice «`require_role` verifica roles **del token**»; el código usa la BD. **Por defecto: BD (D1)**, porque quitar un rol tiene efecto inmediato. Si se elige el claim, cambian el requisito «Los roles guardados en la base son la autoridad» y las tareas 2.4–2.5.
- **OQ-2 — Contrato de stock** (la spec `[INT]` no lo define): `PATCH /productos/{id}/stock` con `{"stock_cantidad": n}` **absoluto** (por defecto) frente a `{cantidad}` con delta `+N/-N` (US-021, `[DESC]`, no normativo).
- **OQ-3 — Alcance de la visibilidad**: por defecto, la restricción de eliminados se aplica también a categorías y unidades de medida (RN-GL-02), además de productos e ingredientes (PA-09), y STOCK ve productos **no disponibles** pero no **eliminados**. Alternativa: limitar C-08 a productos e ingredientes.
- **OQ-4 — Direcciones** (contradicción KB ↔ spec ↔ código): la matriz de `knowledge-base/03` restringe direcciones a CLIENT (ADMIN «— (propias)», STOCK/PEDIDOS «—»); la spec dice «CRUD por usuario» sin rol; el código permite a cualquier autenticado sus propias direcciones. **Por defecto: sin cambio** (no es una escalada: cada uno solo ve las suyas). Se corrige la nota de la KB.
- **OQ-5 — Endpoints de la spec que no existen**: `GET /productos/{id}/ingredientes` (público) y `DELETE /productos/{id}/ingredientes/{ing_id}` (ADMIN). No son de permisos: **por defecto se asignan a C-11** (contrato de API). Hay que confirmar el dueño.
- **OQ-6 — PA-12** (auto-deshabilitar con stock 0): sigue abierta. C-08 mantiene `disponible` independiente del stock (RN-PR-02 `[INT]`).
- **OQ-7 — Cancelación propia multi-rol**: por defecto se usa la unión de roles (un `CLIENT + ADMIN` puede cancelar su pedido `EN_PREP` por `/mis-pedidos`). Alternativa: evaluar `/mis-pedidos/.../cancelar` solo con la fila `CLIENT`.
- **OQ-8 — Access inválido en lectura pública**: por defecto 401 (D8). Alternativa: tratarlo como anónimo.

Contradicciones de documentación detectadas (se corrigen en el grupo de docs, sin decisión pendiente):
- `knowledge-base/06` US-010 dice «Gestión de productos (ADMIN/STOCK)» y `docs/Historias de Usuario.md` da a STOCK el CRUD de productos, categorías e ingredientes (`[DESC]`). IN-14 ya resolvió que manda `[INT]`; se alinea el título de US-010.
- `knowledge-base/03` §Rutas públicas lista `GET /categorias`, `/ingredientes` y `/unidades-medida` como «riesgo» bajo DT-05, pero la matriz los marca «Público R». Se mantiene público y se corrige la nota.
