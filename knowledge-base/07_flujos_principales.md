# Flujos Principales

Flujos extremo a extremo.

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

El flujo descrito es el **objetivo**; los pasos marcados *deuda* son comportamiento del código actual.

## Flujo 1: Registro e inicio de sesión

**Disparador**: usuario envía el formulario de registro/login. **Actor**: Visitante/Cliente.

**Pasos**:
1. Frontend `POST /api/v1/auth/register` {nombre, apellido, email, password, celular?} → API valida (Pydantic), verifica email libre, hashea con bcrypt, crea usuario con rol CLIENT → 201 `UserResponse`.
2. Frontend `POST /api/v1/auth/login` (objetivo: JSON `{email,password}`; *deuda:* el código actual usa `application/x-www-form-urlencoded` con `username`=email). El **rate limiter** (middleware) corre antes.
3. Service verifica hash bcrypt y `deleted_at`; genera access JWT (`sub`, `roles`, `type=access`, 30 min) y refresh token aleatorio (`secrets.token_urlsafe(32)`), guarda su SHA-256 en `refresh_token` (7 días).
4. API responde `Token {access_token, refresh_token, token_type:"bearer", expires_in}` El objetivo es solo Bearer; *deuda DT-11:* el código actual agrega `Set-Cookie: access_token` (HttpOnly, SameSite=lax).
5. Frontend guarda sesión en `authStore` (Zustand; spec: persistir solo `accessToken`; al recargar, `GET /auth/me` reconstruye el usuario).

```
Cliente → Frontend → POST /auth/login → [RateLimit] → UsuarioService → UoW → Repo(usuario, refresh_token) → DB
                                                       ← Token + cookie HttpOnly
```
**Errores**: credenciales inválidas → 401; email duplicado → 409/403; exceso de intentos → 429 + `Retry-After`; validación → 422 `VALIDATION_ERROR`.

## Flujo 2: Request autenticado y renovación de token

1. Request con `Authorization: Bearer` (objetivo; el interceptor Axios lo adjunta leyendo `useAuthStore.getState()`). *Deuda DT-11:* el código actual solo acepta la cookie `access_token`.
2. `get_current_user` decodifica el JWT (firma, exp, `type=access`), carga el usuario; `require_role([...])` valida roles → 403 si no.
3. Si responde 401 por expiración, el interceptor llama `POST /auth/refresh {refresh_token}`: se valida hash, expiración y usuario activo, se **rota** el token y se emite nuevo par; se actualiza el store y se **reintenta** la petición original.
4. Logout: `POST /auth/logout {refresh_token}` invalida el token en BD (objetivo: `revoked_at`; *deuda DT-07:* el código actual borra la fila) y limpia store/cookie.

**Errores**: refresh inválido/expirado → 401 (el usuario debe re-loguearse).

## Flujo 3: Alta de catálogo (ADMIN)

1. (Opcional) `POST /uploads/imagen` (multipart, `tipo`=categoria|ingrediente|producto) → `{secure_url, public_id}`.
2. Crear unidades de medida, categorías (con `parent_id`), ingredientes (con `unidad_medida_id`, `es_alergeno`), producto (precio, stock, categorías, ingredientes con `es_removible`).
3. Todo se persiste vía UoW; el nombre único se valida contra activos.

**Errores**: nombre duplicado → 400; ciclo en categorías → 400; categoría/ingrediente inexistente → 404/400.

## Flujo 4: Compra — carrito, creación de pedido y pago (flujo central)

**Disparador**: cliente confirma el carrito. **Actor**: Cliente. **Sistemas**: Frontend, API, UoW, DB, MercadoPago.

**Pasos**:
1. El carrito vive en `cartStore` (localStorage). Cliente elige dirección (o retiro) y forma de pago.
2. Frontend `POST /api/v1/pedidos/` {items:[{producto_id, cantidad, personalizacion[]}], direccion_id?, forma_pago_codigo, notas?}.
3. Router valida el body y abre `PedidoUnitOfWork`; `PedidoService.crear_pedido` ejecuta dentro de **una transacción**:
   1. valida forma de pago (existe y habilitada) y existencia del estado PENDIENTE;
   2. rechaza líneas duplicadas (producto + personalización);
   3. por ítem: producto existe, no eliminado, `disponible`, stock suficiente (solo se **verifica**: el objetivo no descuenta al crear);
   4. congela snapshots (precio, nombre, subtotal, nombres de ingredientes removidos);
   5. total = subtotal − descuento(0) + envío(50.00);
   6. INSERT `Pedido`(PENDIENTE) + flush; INSERT `DetallePedido` × N;
   7. INSERT `HistorialEstadoPedido`(`estado_desde=NULL`, `estado_hacia=PENDIENTE`, "Pedido creado");
   8. *(deuda DT-04, solo código actual; **objetivo DD-20, lo implementa C-10**: este paso no existe, el stock se descuenta al confirmar el pedido, ver Flujo 5 y Flujo 6)* descuenta stock con bloqueo de fila (`get_for_update`) — 409 si falta;
   9. `__exit__` → commit. Cualquier excepción → rollback total.
4. API responde 201 `PedidoReadFull`.
5. Frontend `POST /api/v1/pagos/crear {pedido_id}`: backend arma preferencia MP (`external_reference = pedido_id`, `back_urls`, `notification_url`), guarda `Pago(estado=pendiente, idempotency_key=uuid)` y responde `{pago_id, preference_id, init_point, public_key}`. Objetivo: el cliente paga con el formulario embebido (Checkout API + `CardPayment`). *Deuda DT-01:* el código actual redirige a `init_point` (Checkout Pro). *Deuda DT-05:* este endpoint hoy no exige autenticación.
6. Cliente paga en MP. MP redirige a `back_urls` → `GET /pagos/redirect/{pedido_id}/{status}` → 302 al frontend `/payment/feedback/{pedido_id}?status=...&...`.
7. En paralelo MP llama `POST /pagos/webhook` (ver Flujo 5).
8. Frontend muestra el estado del pedido (objetivo: polling cada 30 s; el WebSocket `pedido:{id}` es un extra del código, no especificado) y limpia el carrito.

```
Cliente → FE → POST /pedidos ──▶ Service[UoW: pedido+detalles+historial+stock] ──▶ DB (commit)
Cliente → FE → POST /pagos/crear ──▶ MP (preference) ──▶ init_point ──▶ Cliente paga en MP
MP ──▶ POST /pagos/webhook ──▶ MP GET payment ──▶ Pago.update ──▶ Pedido PENDIENTE→CONFIRMADO ──▶ WS
```

**Casos de error**: producto no disponible/sin stock al crear → 400/409 y rollback; MP sin configurar → 400; pago rechazado → pedido sigue PENDIENTE y el cliente reintenta; pago pendiente → sin cambios. **Objetivo (DD-20):** si el pago se aprueba pero ya no hay stock al confirmar, el pedido pasa a CANCELADO con motivo «sin stock» (actor Sistema) y el pago queda marcado para devolución manual. **Pedidos `EFECTIVO`/`TRANSFERENCIA` (DD-22):** no hay paso de pago online; el pedido queda PENDIENTE hasta que ADMIN/PEDIDOS lo confirmen a mano (ver Flujo 6), y ahí se descuenta el stock.

## Flujo 5: Webhook IPN de MercadoPago (Sistema)

> **Resuelto por C-05:** firma `x-signature` (DT-06), idempotencia por `mp_payment_id` (DT-20) y transacción única pago/pedido (DT-21). El actor Sistema (DT-13) lo resolvió C-09.

**Disparador**: MP notifica un cambio de pago. **Actor**: Sistema. Ruta pública: se autentica por firma, no por JWT.

1. `POST /pagos/webhook` (JSON o form-data; query `data.id`/`type`). Sin `MP_WEBHOOK_SECRET` configurado → **503** (falla cerrado en todo entorno).
2. Valida la firma `x-signature` (HMAC-SHA256 del manifest `id:<data.id de la query>;request-id:<x-request-id>;ts:<ts>;`, omitiendo los pares ausentes) con el validador del SDK de MercadoPago. Inválida o ausente → **401** genérico (el motivo solo se loguea). Sin ventana de tolerancia sobre `ts`.
3. Tópico e id: `data.id` de la query; si falta, el del cuerpo; si difieren → **400**. Tópico distinto de `payment` o sin id → 200 `ignored`. Sin `MP_ACCESS_TOKEN` → **503**.
4. Consulta `sdk.payment().get(id)` (RN-PA-03: no se confía en el payload); error del proveedor → **502** (MP reintenta). Estado no mapeado → 200 `ignored`.
5. En **una sola transacción** (UoW reentrante con savepoint, solo la externa confirma): busca el `Pago` con `SELECT ... FOR UPDATE` por `mp_payment_id` → `external_reference` (último del pedido) → `merchant_order_id`; sin pago local → 200 `ignored`. La función pura `decidir_transicion_pago` resuelve la idempotencia: `aprobado`/`a_devolver` son terminales; un `pendiente`/`rechazado` con el mismo `mp_payment_id` y estado es una reentrega → `already_processed`; un nuevo intento con otro id se procesa.
6. Si `approved`: `PedidoService.confirmar_por_pago_aprobado(pedido_id)` (C-09/C-10, actor Sistema, descuento de stock en la misma transacción). Si el Sistema no puede confirmar el pedido (`CANCELADO`, `EFECTIVO`/`TRANSFERENCIA`, ya confirmado: 409 `INVALID_TRANSITION`) o no hay stock, el pago queda `a_devolver` (devolución manual, PA-08) y se responde 200.
7. El router emite eventos WebSocket a `role:KDS` y `pedido:{id}` solo si hubo `pedido_actualizado` (background tasks, después del commit).
8. Responde 200 `{status: processed|ignored|already_processed}`.

**Códigos**: 200 procesado/ignorado/ya procesado; 401 firma inválida; 400 ids inconsistentes; 502 falla la consulta a MP; 503 falta `MP_WEBHOOK_SECRET`/`MP_ACCESS_TOKEN`; 500 falla inesperada (todo revertido, MP reintenta).

## Flujo 6: Ciclo operativo del pedido (PEDIDOS/ADMIN)

1. Gestor lista `GET /pedidos/` (todos; paginado, con filtros `estado`/`desde`/`hasta`) o `/pedidos/cocina/pedidos` (CONFIRMADO/EN_PREP, más viejos primero).
2. `PATCH /pedidos/{id}/estado {nuevo_estado, motivo?}` (C-11; responde 200 con el detalle del pedido; 409 `INVALID_TRANSITION` o `INSUFFICIENT_STOCK`; 422 con `field` `motivo` si CANCELADO sin motivo) → Service valida: pedido existe y no eliminado, estado actual y destino existen, no terminal (409), transición permitida para el **rol** (objetivo: conjunto de roles; *deuda DT-14:* hoy `roles[0]`) (409), motivo si CANCELADO (400).
3. Actualiza `Pedido.estado_codigo`; inserta historial (actor = usuario). **Objetivo (DD-20):** al pasar a CONFIRMADO descuenta el stock (en la misma transacción; sin stock suficiente la transición se rechaza con error claro y el pedido sigue PENDIENTE); al pasar a CANCELADO desde CONFIRMADO o posterior devuelve el stock, y desde PENDIENTE no hay nada que devolver. *Deuda DT-04, código actual:* si CANCELADO restaura stock en toda cancelación.
   - **Confirmación manual (DD-22):** PENDIENTE→CONFIRMADO la hace un usuario ADMIN o PEDIDOS solo para pedidos `EFECTIVO`/`TRANSFERENCIA`; los `MERCADOPAGO` solo se confirman automáticamente por el webhook.
   - **Despacho (DD-23):** `EN_PREP→EN_CAMINO` y `EN_CAMINO→ENTREGADO` los hacen ADMIN y PEDIDOS.
4. Tras commit, emite WS (`PEDIDO_CONFIRMADO`, `PEDIDO_EN_PREPARACION`, `PEDIDO_CANCELADO` o `ESTADO_ACTUALIZADO`) a `role:KDS` y `pedido:{id}`.
5. Secuencia (spec, C-09): PENDIENTE→CONFIRMADO→EN_PREP→EN_CAMINO→ENTREGADO, sin atajos.

## Flujo 7: Cancelación por el cliente

`DELETE /pedidos/{id}` (C-11; body opcional `{motivo}`, por defecto «Cancelado por el cliente») cancela el pedido propio → verifica propiedad (403) → valida transición CLIENT (solo desde PENDIENTE/CONFIRMADO; 409 `INVALID_TRANSITION` si no) → estado CANCELADO, historial; el pedido nunca se borra y sigue visible; **objetivo (DD-20):** devuelve el stock solo si el pedido estaba CONFIRMADO (un PENDIENTE no descontó nada); *código actual:* restaura stock en toda cancelación. Si ya había un pago aprobado, **no hay reembolso automático documentado** (pregunta abierta).

## Flujo 8: Tiempo real (KDS y seguimiento) — extra del código, no especificado

Ver [12_tiempo_real_websocket.md](12_tiempo_real_websocket.md).

## Flujo 9: Dashboard de métricas (ADMIN)

`GET /estadisticas/{ventas|productos-top|pedidos-por-estado|ingresos|resumen}?desde&hasta[&agrupacion=day&limit=5]` → agregaciones SQL sobre pedidos/detalles; el frontend las grafica con recharts. Todos requieren `ADMIN`.
