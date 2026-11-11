# Design — C-04 `pagos-autorizacion-propietario`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/payment-api` (nuevo), `specs/backend-runtime` y `specs/rbac-authorization` (deltas).

Punto de partida en el código (`dev`, 2026-11-11):

- **Router** `pagos/router.py`: `crear_pago(data, svc)` y `consultar_pago(pedido_id, svc)` sin dependencias de auth; `get_payment_service(session)` construye `PaymentService(session)`. `webhook` y `mp_redirect` son públicos.
- **Service** `PaymentService`: `crear_pago(pedido_id)` → `self._session.get(Pedido, id)` (ignora `deleted_at`, sin UoW) → `HTTPException(404)` → `_exigir_configuracion_mp()` (503) → SDK → `PagoUnitOfWork` guarda el `Pago`. `obtener_pago(pedido_id)` lee el último pago por UoW sin verificar el pedido.
- **UoW** `PagoUnitOfWork` expone solo `pagos` (`PagoRepository`).
- **Auth (C-02/C-08)**: `core/deps.py` ofrece `get_current_active_user` (401 sin token/inválido; 404 «Cuenta de usuario desactivada» si `deleted_at`) y `get_current_roles` (roles de la BD, frozenset). `core/permissions.py::tiene_algun_rol` es la primitiva pura de RBAC.
- **Convención de acceso a un pedido (C-11)**: `PedidoService._obtener_pedido_visible` → `_obtener_pedido_o_404` (404 `HTTP_404` si no existe o `deleted_at`) y luego `AppError(403, "HTTP_403", "No tenés acceso a este pedido")` si `pedido.usuario_id != usuario_id and not tiene_algun_rol(roles, ROLES_GESTORES)`. Los routers de pedidos inyectan `CurrentUser`/`CurrentRoles` y pasan `current_user.id, roles` al service.
- **Tests**: fixtures `user_auth_headers` (dueño de `pedido_db`), `admin_auth_headers`, `usuario_con_roles(roles)`, `normal_user`; `bearer_con_roles(session, roles)` en `tests/support/auth_helpers.py`. La matriz RBAC (`tests/support/rbac_matriz.py`) exige fila o exclusión para cada ruta; las de pagos están en `EXCLUIDAS` con dueño C-04. `mercadopago.SDK` se mockea con `monkeypatch` en `app.modules.pagos.service.mercadopago.SDK`.

## Goals / Non-Goals

**Goals:** cerrar DT-05 con la misma convención 401/404/403 que pedidos, poniendo la regla de acceso en el service y sin duplicar la condición «propietario o rol privilegiado» entre pedidos y pagos.

**Non-Goals:** tocar el webhook (C-05), el redirect y el flujo Checkout Pro (C-12), los cuerpos de respuesta de pagos, ni el resto de los `HTTPException` de `PaymentService` (C-25a). No se agrega `require_role` a los endpoints de pagos (ver D2).

## Decisions

**D1 — 403 para el pedido ajeno, 404 para el inexistente (convención de C-11).**
Un pedido que existe pero no es del usuario (y el usuario no tiene `ADMIN`) responde **403** `HTTP_403` «No tenés acceso a este pedido»; uno inexistente o eliminado, **404** `HTTP_404` «Pedido no encontrado». Es exactamente lo que hace `GET /pedidos/{id}` (spec `order-api`, «Otro cliente → 403»), y el frontend ya va a tratar ese par de códigos así.
*Alternativa descartada:* 404 también para el ajeno (no revela existencia). Es más estricta, pero rompe la coherencia con pedidos, cuyos ids ya son enumerables por el mismo cliente vía `GET /pedidos/{id}` (403 vs 404). Si se quiere ocultar existencia, debe hacerse en ambos módulos a la vez (otro change). Ver OQ-3.

**D2 — Autenticación en el router, propiedad en el service.**
- Router: `crear_pago` y `consultar_pago` reciben `current_user: Annotated[Usuario, Depends(get_current_active_user)]` y `roles: Annotated[frozenset[str], Depends(get_current_roles)]` (mismos alias `CurrentUser`/`CurrentRoles` que pedidos) y llaman a `svc.crear_pago(data.pedido_id, current_user.id, roles)` / `svc.obtener_pago(pedido_id, current_user.id, roles)`. Sin lógica en el router (regla dura 2).
- **Sin `require_role`**: el acceso no depende de un rol sino del pedido; cualquier usuario activo autenticado pasa el router y el service decide (D3). En la matriz las filas quedan `AUTENTICADO` (con `ID_INEXISTENTE` cada perfil autenticado obtiene 404, ni 401 ni 403).
*Alternativa descartada:* `require_role(["CLIENT", "ADMIN"])` además del chequeo de propiedad. Agrega un 403 por rol que no aporta (un no-CLIENT nunca es dueño de un pedido, porque solo `CLIENT` crea pedidos) y obliga a pensar qué pasa si a un dueño se le quita `CLIENT`; la regla de la KB es de **propiedad**, no de rol.

**D3 — Primitiva pura compartida `puede_acceder_a_propio`.**
En `core/permissions.py`:
```python
def puede_acceder_a_propio(propietario_id: int, usuario_id: int, roles: AbstractSet[str], privilegiados: Iterable[str]) -> bool:
    """True si el usuario es el dueño del recurso o tiene alguno de los roles `privilegiados`."""
```
`PedidoService._obtener_pedido_visible` pasa a usarla con `ROLES_GESTORES` (refactor sin cambio de comportamiento, cubierto por `test_pedidos_contrato.py`) y `PaymentService` con `ROLES_PRIVILEGIADOS_PAGOS = frozenset({"ADMIN"})`. Una sola definición de la regla (reglas duras 3 y 5).
*Alternativa descartada:* que `PaymentService` llame a `PedidoService._obtener_pedido_visible`: es privado, usa otro conjunto de roles (`PEDIDOS` sí ve pedidos pero no pagos) y acoplaría pagos al service de pedidos más de lo que ya está.

**D4 — Lectura del pedido por la Unit of Work.**
`PagoUnitOfWork.__enter__` expone además `self.pedidos = PedidoRepository(self._session)` (pagos ya depende de `pedidos.models`; no hay ciclo). `PaymentService` gana `_obtener_pedido_autorizado(uow, pedido_id, usuario_id, roles) -> Pedido`: 404 si `None` o `deleted_at` → 403 si `not puede_acceder_a_propio(...)`, ambos con `AppError` (`core/errors.py`, sin FastAPI). Se elimina el `self._session.get(Pedido, ...)` y el `HTTPException(404)` de `crear_pago`.
- `crear_pago(pedido_id, usuario_id, roles)`: abre la UoW, `_obtener_pedido_autorizado`, lee `total` → **después** `_exigir_configuracion_mp()` (503) → SDK → guarda el `Pago` (como hoy).
- `obtener_pago(pedido_id, usuario_id, roles)`: misma UoW, `_obtener_pedido_autorizado`, luego `get_ultimo_by_pedido` (200 con `estado` nulo si no hay pagos).
- El 404 y el 403 se lanzan antes de cualquier efecto (no hay `add` previo), así que el rollback de la UoW no tiene nada que deshacer.

**D5 — Orden 401 → 404 → 403 → 503 → MP.**
401 lo resuelven las dependencias antes del cuerpo del endpoint (y antes de la validación del body: un anónimo con body inválido recibe 401). 404 antes de 403 por la convención de C-11. La configuración de MP se evalúa recién con el pedido autorizado: un tercero no puede usar el endpoint para saber si MP está configurado ni para disparar llamadas al SDK.

**D6 — Usuario dado de baja.** Hereda la convención de `get_current_active_user`: 404 «Cuenta de usuario desactivada» (no 401/403). No se redefine acá.

**D7 — Webhook y redirect intactos.** No se tocan ni se les agregan dependencias. El redirect queda público (lo abre el navegador al volver de MercadoPago, sin `Authorization`; solo reenvía query params al frontend y no lee la BD). La spec `payment-api` lo declara público hasta que C-12 lo retire.

**D8 — Matriz RBAC.** En `tests/support/rbac_matriz.py`: se quitan de `EXCLUIDAS` `("POST", "/api/v1/pagos/crear")` y `("GET", "/api/v1/pagos/{pedido_id}")` y se agregan a `FILAS` como `Fila("POST", f"{P}/pagos/crear", AUTENTICADO, {"pedido_id": ID_INEXISTENTE})` y `Fila("GET", f"{P}/pagos/{{pedido_id}}", AUTENTICADO)`. Webhook y redirect siguen excluidos (C-05/C-12). La matriz solo prueba 401 vs. no-401/403; la propiedad se prueba en `test_pago_autorizacion.py` con pedidos reales.

**D9 — Sin migración.** No cambia el esquema ni hay variables nuevas.

## Risks / Trade-offs

- [Cambio incompatible: los clientes sin token dejan de poder crear/consultar pagos] → no hay frontend todavía (C-13b/C-20 vienen después); los tests propios que llamaban sin token (`test_optional_integrations.py`) se ajustan en el mismo grupo de tareas.
- [403 vs 404 permite a un usuario autenticado saber si un `pedido_id` existe] → mismo comportamiento que `GET /pedidos/{id}` (C-11); los ids ya son secuenciales y el riesgo es bajo. Se deja OQ-3 para revisarlo en ambos módulos juntos.
- [`ADMIN` puede crear una preferencia de MP para el pedido de un cliente] → la KB (DT-05, CHANGES) lo pide explícitamente; el pago queda asociado al pedido y el dinero lo cobra la tienda, no hay escalada. Ver OQ-1.
- [`PaymentService` sigue mezclando `HTTPException` (400/503) con `AppError` (403/404)] → ambos salen por el formato único `{detail, code, field}`; la migración total es de C-25a.
- [Un dueño al que se le quitó `CLIENT` sigue operando sus pagos] → coherente con la regla de propiedad (D2); pedidos tiene el mismo caso cubierto por rol en el router, aceptado como diferencia menor.

## Migration Plan

Sin migración Alembic ni variables nuevas. Rollback = revertir el commit. No hay consumidores externos del contrato viejo.

## Open Questions

> Gobernanza CRÍTICA: **RESUELTAS** — el usuario aprobó C-04 el 2026-11-11 aceptando los valores por defecto de OQ-1, OQ-2 y OQ-3.

- **OQ-1 [RESUELTA 2026-11-11, por el usuario: sí] — ¿`ADMIN` puede también *crear* el pago de un pedido ajeno?** Por defecto: **sí** (DT-05 y CHANGES: «propietario o ADMIN» para ambos endpoints). Alternativa: `ADMIN` solo consulta; crear queda para el dueño (la matriz de la KB 03 marca «C/R propios» solo en `CLIENT`).
- **OQ-2 [RESUELTA 2026-11-11, por el usuario: no] — ¿`PEDIDOS` puede *consultar* el pago de cualquier pedido?** Por defecto: **no** (el alcance pide solo propietario/ADMIN). Alternativa: permitir lectura a `PEDIDOS`, que ya ve todos los pedidos y gestiona la confirmación manual de `EFECTIVO`/`TRANSFERENCIA` (DD-22); bastaría con cambiar `ROLES_PRIVILEGIADOS_PAGOS` en lectura.
- **OQ-3 [RESUELTA 2026-11-11, por el usuario: 403] — ¿403 o 404 para el pedido ajeno?** Por defecto: **403** (D1, coherente con C-11). Alternativa: 404 en pagos **y** pedidos (otro change).

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-11
