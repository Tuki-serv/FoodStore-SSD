# Proposal — C-04 `pagos-autorizacion-propietario`

## Why

`POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}` son hoy **públicos**: cualquiera, sin token, puede generar una preferencia de MercadoPago para cualquier `pedido_id` o consultar el estado del pago de un pedido ajeno (DT-05, IN-25; KB 11 §Riesgos conocidos, KB 03 §Rutas públicas). La spec `[INT]` dice que crear y consultar un pago son operaciones del **propietario** del pedido (KB 03, matriz: «Pagos — crear / consultar: C/R propios»), y la KB fija el objetivo «autenticados, solo propietario/ADMIN». Es un change de seguridad de Fase 0 (gobernanza CRÍTICA) y C-05 (webhook) y C-12 (Checkout API) se apoyan en él.

Observado en el código (`dev`, 2026-11-11):

- `pagos/router.py`: `crear_pago` y `consultar_pago` no tienen ninguna dependencia de autenticación; `PaymentService(session)` recibe solo el `pedido_id`.
- `PaymentService.crear_pago` busca el pedido con `self._session.get(Pedido, ...)` (sin UoW, sin mirar `deleted_at`) y lanza `HTTPException(404)`; luego valida la configuración de MP (503) y llama al SDK.
- `PaymentService.obtener_pago` no verifica que el pedido exista: para cualquier id responde 200 con `estado: null`.
- La convención de acceso a un pedido ya está fijada por C-11 (`PedidoService._obtener_pedido_visible`): **404 si no existe o está eliminado; 403 `HTTP_403` «No tenés acceso a este pedido» si existe y no es propio ni el lector tiene un rol privilegiado**.
- `tests/support/rbac_matriz.py` deja `POST /pagos/crear` y `GET /pagos/{pedido_id}` en `EXCLUIDAS` con dueño C-04.
- Los tests de `test_optional_integrations.py` (503 sin MP configurado) llaman a `/pagos/crear` sin token.

## What Changes

- **BREAKING — Autenticación obligatoria:** `POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}` exigen un access token Bearer válido de un usuario activo (C-02); sin token o con token inválido responden **401**.
- **BREAKING — Propiedad del pedido:** solo el **propietario** del pedido o un usuario con rol **`ADMIN`** (unión de roles, leídos de la BD, C-08) pueden crear o consultar el pago. Otro usuario autenticado recibe **403** `HTTP_403`; un pedido inexistente o eliminado, **404** `HTTP_404` (misma convención que `GET /pedidos/{id}` de C-11).
- **Orden de verificación:** 401 → 404 → 403 → 503 (MP no configurado) → llamada a MercadoPago. Un no-propietario nunca llega a contactar a MP ni a conocer el estado de la configuración.
- `GET /api/v1/pagos/{pedido_id}` de un pedido inexistente pasa de 200 `estado: null` a **404**; para el propietario de un pedido sin pagos sigue respondiendo 200 con `estado: null`.
- El chequeo vive en el **service** (`PaymentService`), leyendo el pedido por la Unit of Work; el router solo inyecta el usuario y sus roles. La condición «propietario o rol privilegiado» se extrae a una primitiva pura en `core/permissions.py` que también usa `PedidoService` (sin duplicar la regla).
- Sin cambios: `POST /pagos/webhook` sigue público (firma e idempotencia: C-05); `GET /pagos/redirect/{pedido_id}/{status}` sigue público (lo inicia el navegador desde MercadoPago y no expone datos; se retira en C-12); el flujo Checkout Pro y los cuerpos de respuesta no cambian (C-12).
- **Sin migración** ni variables de entorno nuevas.

**Fuera de alcance (con dueño):** firma `x-signature` e idempotencia del webhook (C-05); Checkout API con `CardPayment` y retiro del redirect (C-12, DT-01); `float(monto)` → `Decimal` (C-12); sacar los `HTTPException` restantes de `PaymentService` y la `Session` del router (C-25a; acá solo se migra lo que se toca).

## Capabilities

### New Capabilities
- `payment-api`: superficie HTTP de pagos — quién puede crear y consultar el pago de un pedido (autenticación, propiedad, privilegio de `ADMIN`), códigos 401/403/404 y orden de las verificaciones; el webhook y el redirect quedan declarados como públicos.

### Modified Capabilities
- `backend-runtime`: el requisito «Pagos sin MercadoPago configurado» precisa que el 503 lo recibe quien ya pasó la autorización (propietario o `ADMIN`); un usuario sin acceso recibe 401/403/404 antes de que se evalúe la configuración.
- `rbac-authorization`: la matriz incorpora crear/consultar pagos — `CLIENT` solo sobre sus pedidos, `ADMIN` sobre cualquiera, `PEDIDOS` y `STOCK` sin acceso a pagos ajenos.

## Impact

- **Código**: `core/permissions.py` (primitiva pura propietario-o-rol); `pagos/router.py` (dependencias `get_current_active_user` + `get_current_roles`); `pagos/service.py` (`crear_pago` y `obtener_pago` reciben `usuario_id` y `roles`; verificación con `AppError`); `pagos/unit_of_work.py` (expone `pedidos`); `pedidos/service.py` (`_obtener_pedido_visible` usa la primitiva, sin cambio de comportamiento).
- **API**: cambios incompatibles listados arriba; OpenAPI marca ambos endpoints con seguridad Bearer.
- **Tests**: `tests/integration/test_pago_autorizacion.py` (nuevo: sin token, otro usuario, ADMIN, propietario, inexistente, PEDIDOS/STOCK); `tests/integration/test_optional_integrations.py` (los 503 pasan a llamar con el token del propietario); `tests/support/rbac_matriz.py` (las dos filas salen de `EXCLUIDAS` y entran a la matriz como `AUTENTICADO`); `tests/unit/test_permissions.py` (primitiva).
- **Datos**: sin migración (cabeza sin cambios) ni variables nuevas.
- **Docs**: `knowledge-base/03` (§Rutas públicas y matriz: DT-05 resuelta), `09` (DT-05 resuelta por C-04), `11` (§Riesgos conocidos), `CHANGES.md` (C-04 `[x]` al archivar).
