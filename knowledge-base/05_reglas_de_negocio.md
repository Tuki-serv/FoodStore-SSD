# Reglas de Negocio

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Cada regla tiene código `RN-{DOMINIO}-{NN}`. Origen entre corchetes: `[DESC]`, `[INT]`; las reglas sin etiqueta describen comportamiento verificado en el código actual. **Ojo:** `[DESC]` e `[INT]` numeran ambas "RN-01..05" para reglas de pedidos con significados distintos; aquí se unifican bajo `RN-PE-xx` y se anota la equivalencia.

## Dominio: Autenticación (RN-AU)

- **RN-AU-01**: Doble token: *access token* JWT HS256 de **30 min** (payload: id/`sub`, roles; `[DESC]` también email) y *refresh token* de **7 días**. `[DESC,INT]`
- **RN-AU-02**: Contraseñas con bcrypt (cost >= 12); nunca en texto plano; `password_hash` nunca aparece en respuestas. `[INT]`
- **RN-AU-03**: Login con email + contraseña (mín. 8 caracteres). Credenciales inválidas o usuario con `deleted_at` → 401 "Credenciales incorrectas".
- **RN-AU-04**: El refresh token se guarda hasheado (SHA-256) en BD; el valor en claro solo se entrega una vez al cliente. `[INT]`
- **RN-AU-05**: `POST /auth/refresh` **rota** el refresh token (el anterior deja de servir) y emite un nuevo par. Objetivo: marca el anterior `revoked_at`. *Deuda DT-07:* el código actual actualiza en sitio la misma fila; expirado → se borra y 401. (IN-08)
- **RN-AU-06**: `POST /auth/logout` invalida el refresh token. Objetivo: `revoked_at`; *deuda DT-07:* el código actual **borra la fila**. El access token no se invalida explícitamente (expira solo, <= 30 min).
- **RN-AU-07**: Registro público asigna automáticamente rol `CLIENT`; email ya registrado → rechazo (objetivo 409; *deuda DT-12:* el código actual responde **403**). `[DESC,INT]` (IN-09)
- **RN-AU-08**: Rate limiting en autenticación: objetivo (slowapi) = **5 intentos fallidos por IP en 15 min** en `POST /auth/login` con 429 + `Retry-After`. *Deuda DT-10:* el código actual usa token bucket por IP, 5/min con ráfaga 5, aplicado a login, register y logout (cuenta todos los requests, no solo fallidos). (IN-10)
- **RN-AU-09**: Un usuario desactivado (`deleted_at`) no puede operar; el sistema responde 404 en vez de revelar el estado.
- **RN-AU-10**: **Objetivo (spec):** el access token viaja en `Authorization: Bearer`. *Deuda DT-11:* el código actual lo envía **solo en cookie HttpOnly** `access_token` (SameSite=lax, `secure=False`) y el Bearer está deshabilitado. (IN-07)

## Dominio: Usuarios y Roles (RN-US)

- **RN-US-01**: Existen exactamente 4 roles en la spec (`ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`); un usuario puede tener varios. `[DESC,INT]`
- **RN-US-02**: Solo `ADMIN` crea usuarios con roles arbitrarios, asigna/cambia roles, lista (paginado, filtro por rol) y desactiva usuarios. Códigos de rol inválidos → 400.
- **RN-US-03**: Eliminación de usuario = soft delete; el email puede reutilizarse (índice único parcial).
- **RN-US-04**: Un cliente solo accede a sus propios datos (perfil, direcciones, pedidos, pagos). `[DESC,INT]`
- **RN-US-05**: El email es único entre usuarios activos y se valida con `EmailStr`. `[INT]`

## Dominio: Direcciones de Entrega (RN-DI)

- **RN-DI-01**: Un usuario puede tener varias direcciones; solo **una** es principal (`es_principal`). `[DESC,INT]`
- **RN-DI-02**: La primera dirección creada se marca principal automáticamente; `PATCH /{id}/principal` desmarca la anterior y marca la nueva (idempotente si ya es principal).
- **RN-DI-03**: Un usuario no puede leer/modificar/borrar direcciones ajenas (403 "No tienes permisos para operar sobre esta dirección").
- **RN-DI-04**: `Pedido.direccion_id` puede ser NULL (retiro en local) y pasa a NULL si la dirección se elimina (`SET NULL`). `[INT]`

## Dominio: Catálogo (RN-CA)

- **RN-CA-01**: Las categorías son jerárquicas (`parent_id`), sin límite de profundidad; no se permiten ciclos ni que una categoría sea su propio padre (400).
- **RN-CA-02**: Nombre de categoría único entre activas (400 si se repite).
- **RN-CA-03**: Eliminar una categoría = soft delete **con validación** (objetivo spec). *Deuda DT-19:* el código actual re-asigna las hijas al abuelo, borra la imagen en Cloudinary y no valida productos asociados. (IN-17)
- **RN-CA-04**: `ProductoCategoria.categoria_id` es `ON DELETE RESTRICT`: no se puede borrar físicamente una categoría con productos.
- **RN-CA-05**: Un producto pertenece a varias categorías; una es la principal (`es_principal`). `[INT]`

## Dominio: Productos, Ingredientes y Stock (RN-PR)

- **RN-PR-01**: `precio_base >= 0` (validado en Python y CHECK en BD). `[INT]`
- **RN-PR-02**: `stock_cantidad >= 0`. `disponible` es un toggle manual **independiente del stock**. `[INT]`
- **RN-PR-03**: El público solo ve productos `disponible = true` y no eliminados; STOCK/ADMIN pueden ver los no disponibles. `[DESC]`
- **RN-PR-04**: Los ingredientes llevan `es_alergeno` (se muestra como badge de alérgenos); `ProductoIngrediente.es_removible` define qué se puede excluir al personalizar. `[DESC,INT]`
- **RN-PR-05**: Nombres únicos entre activos para productos, ingredientes y unidades de medida.
- **RN-PR-06**: Borrado de producto/ingrediente = soft delete; un producto con pedidos asociados no rompe integridad (`DetallePedido.producto_id RESTRICT`). `[DESC]`
- **RN-PR-07**: Imágenes: JPG/PNG/WEBP/GIF/AVIF, máx. 5 MB, subidas a Cloudinary en un paso previo (devuelve `secure_url` + `public_id`) y luego referenciadas en JSON; solo ADMIN.

## Dominio: Pedidos y FSM (RN-PE)

> **Deuda técnica (DT-03, DT-14, DT-15):** la columna "código actual" de la tabla de transiciones es estado actual, no norma. La FSM objetivo tiene 6 estados con `EN_CAMINO`.

**Estados** (spec): `PENDIENTE → CONFIRMADO → EN_PREP → EN_CAMINO → ENTREGADO`, y `CANCELADO`. Terminales: `ENTREGADO`, `CANCELADO`.

| Origen | Destino válido (**objetivo**, spec `[INT]`) | Código actual (**deuda**) |
|--------|-----------------------------------|-------------------------------------------|
| PENDIENTE | CONFIRMADO (auto, pago aprobado), CANCELADO | CONFIRMADO, CANCELADO |
| CONFIRMADO | EN_PREP, CANCELADO | EN_PREP, CANCELADO |
| EN_PREP | EN_CAMINO, CANCELADO (solo ADMIN `[DESC]` / ADMIN-PEDIDOS `[INT]`) | **ENTREGADO**, CANCELADO |
| EN_CAMINO | ENTREGADO | (estado inexistente) |
| ENTREGADO / CANCELADO | — (terminales) | — |

- **RN-PE-01** (INT RN-01 / DESC RN-01): Solo se avanza al siguiente estado de la secuencia; sin saltos ni retrocesos. Excepción: CANCELADO desde estados no terminales. Se valida en el **Service** contra un mapa de transiciones **por rol** antes de cada INSERT en historial; ningún router puede saltearlo.
- **RN-PE-02** (DESC RN-02): PENDIENTE→CONFIRMADO es **exclusivamente automática**, disparada por el webhook cuando `mp_status = "approved"`. *Deuda DT-15:* el mapa actual permite también a ADMIN/PEDIDOS confirmar manualmente por `PATCH /estado` (IN-20; ver PA-06 para efectivo/transferencia).
- **RN-PE-03** (INT RN-01 / DESC RN-05): Un estado con `es_terminal = true` no admite transiciones; intento → **409** "No se puede cambiar un pedido en estado terminal".
- **RN-PE-04** (INT RN-02): El primer registro del historial tiene `estado_desde = NULL`.
- **RN-PE-05** (INT RN-03): `HistorialEstadoPedido` es **append-only**: ninguna capa emite UPDATE ni DELETE.
- **RN-PE-06** (INT RN-04): `total`, nombre y precio en `DetallePedido` son un **snapshot inmutable** al crear el pedido.
- **RN-PE-07** (INT RN-05): El `motivo` es **obligatorio** si el nuevo estado es CANCELADO (400 en el código actual).
- **RN-PE-08**: Transición inválida por flujo/rol → 409 "No se puede cambiar de X a Y".
- **RN-PE-09**: Creación de pedido (una sola transacción UoW; el descuento de stock de este paso es comportamiento del código actual, ver RN-ST y DT-04): valida forma de pago existente y habilitada; **rechaza líneas duplicadas** (mismo producto + misma personalización → 400); por línea valida producto existente, no eliminado, `disponible` y stock suficiente; congela `precio_snapshot`, `nombre_snapshot`, `subtotal_snapshot` y nombres de ingredientes removidos; calcula `subtotal`, `descuento = 0`, `costo_envio = 50.00`, `total`; crea pedido en PENDIENTE, detalles e historial inicial; **descuenta el stock**; commit o rollback total. Mínimo 1 ítem; `cantidad >= 1`.
- **RN-PE-10**: Cancelación por el cliente: solo pedidos propios (403 si ajeno) en **PENDIENTE o CONFIRMADO** (el CLIENT no tiene transiciones desde EN_PREP).
- **RN-PE-11**: Cancelación por ADMIN/PEDIDOS: desde PENDIENTE, CONFIRMADO y EN_PREP (en spec EN_PREP→CANCELADO es solo ADMIN `[DESC]`).
- **RN-PE-12**: Solo ADMIN puede eliminar un pedido (soft delete).
- **RN-PE-13**: Listado: CLIENT ve solo los propios; ADMIN/PEDIDOS ven todos; filtros por estado/fecha y paginación `page/size` (objetivo); *deuda DT-18:* el código actual solo ofrece `offset/limit`.

## Dominio: Stock (RN-ST)

- **RN-ST-00 (objetivo, spec `[INT]`)**: al crear el pedido se valida que el producto esté `disponible` y con stock suficiente. La spec **no define cuándo se descuenta** el stock: pregunta abierta PA-03.
- **RN-ST-01** (`[DESC]` RN-03, **no normativa**, opción candidata a PA-03): decrementar atómicamente `stock_cantidad` al llegar a CONFIRMADO; si falla, revertir y dejar PENDIENTE.
- **RN-ST-01-real** (*deuda DT-04, código actual*): el stock se **descuenta al crear el pedido (PENDIENTE)**, con `get_for_update` y 409 si falta. Los pedidos impagos reservan stock sin TTL. (IN-05)
- **RN-ST-02** (`[DESC]` RN-04, no normativa): restaurar el stock al cancelar (solo si ya estaba descontado). *Código actual:* se restaura en **toda** cancelación (PENDIENTE incluida), saltando productos eliminados.
- **RN-ST-03**: Los decrementos/incrementos deben ser transaccionales y atómicos.

## Dominio: Pagos (RN-PA)

- **RN-PA-01**: Los datos de tarjeta **nunca** pasan por el backend (PCI DSS SAQ-A): se tokenizan en el navegador con MercadoPago.js / `CardPayment` (objetivo, Checkout API). *Deuda DT-01:* el código actual delega en el sitio de MP (Checkout Pro).
- **RN-PA-02**: Cada pago lleva un `idempotency_key` UUID único generado por el backend; un mismo evento no debe procesarse dos veces. *Deuda DT-20:* en el código actual la deduplicación efectiva es `pago.estado != "pendiente"` → `already_processed`; el `idempotency_key` no se verifica.
- **RN-PA-03**: El webhook **no confía** en el payload: consulta la API de MP (`payment.get`) para obtener el estado real y busca el pedido por `external_reference`; responde 200 rápido para evitar reintentos.
- **RN-PA-04**: Mapeo de estados MP → acción:

| `mp_status` | Estado local | Acción sobre el pedido |
|-------------|----------------------|------------------------|
| `approved` | `aprobado` | PENDIENTE→CONFIRMADO automático (y stock según RN-ST) |
| `pending` / `in_process` / `authorized` | `pendiente` | Sin cambios; permanece PENDIENTE |
| `rejected` | `rechazado` | Sin cambios; el cliente puede reintentar con otro método |
| `cancelled` / `refunded` / `charged_back` | `rechazado` | Sin cambios (spec: "se podría considerar" cancelar el pedido si no hay otros pagos) |

- **RN-PA-05**: Un pedido admite múltiples intentos de pago (1:N); se consulta el último (`get_ultimo_by_pedido`).
- **RN-PA-06**: Solo se procesan notificaciones `topic/type = payment`; el resto se ignora.

## Dominio: API y Datos transversales (RN-GL)

- **RN-GL-01**: Todas las rutas bajo `/api/v1`; errores en formato `{detail, code, field}` en toda la API (*deuda DT-18:* el rate limit devuelve otra forma); validación Pydantic → 422 `VALIDATION_ERROR`.
- **RN-GL-02**: Los listados excluyen registros con `deleted_at` (los endpoints admin pueden incluirlos vía filtro `EstadoFiltro`: `ACTIVO|ELIMINADO|TODOS`).
- **RN-GL-03**: Nunca se expone el modelo SQLModel como respuesta; schemas separados Create/Update/Read. Ningún `service` hace `session.commit()` directo (lo hace el UoW) — CE-10.
- **RN-GL-04**: Precios y totales en `Decimal` (NUMERIC(10,2)), nunca float (excepto al enviar a MP: `float(monto)`).

## Dominio: Excepciones globales

- Una transición de pedido registra siempre historial con `usuario_id` del actor (objetivo: NULL para el Sistema; *deuda DT-13:* el webhook actual usa el id del dueño del pedido como actor — IN-21).
- Confirmación manual de PENDIENTE→CONFIRMADO por rol humano contradice RN-PE-02 (deuda DT-15, IN-20).
- Si el stock cae a 0 el producto **no** se marca `disponible=false` automáticamente (no hay regla; ver pregunta abierta).
