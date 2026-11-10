# Decisiones y Supuestos

## Decisiones documentadas

### DD-01 — Arquitectura en capas con Unit of Work
**Decisión**: Router → Service → UoW → Repository → Model, con commit/rollback solo en el UoW.
**Contexto**: Crear un pedido toca varias tablas y debe ser atómico (CE-10, rúbrica 15 pts).
**Alternativas**: Services con `session.commit()` propio; transacciones manuales.
**Justificación**: Atomicidad garantizada, services testeables con UoW mock.
**Trade-offs**: Más boilerplate (un UoW por módulo en el código actual).

### DD-02 — Organización feature-first (backend) y FSD (frontend)
**Decisión**: Un módulo/feature por capacidad con todos sus archivos.
**Justificación**: Dónde buscar y dónde agregar código es obvio; simétrico entre front y back.
**Trade-offs**: Dependencias cruzadas entre módulos (p. ej. `pagos` importa `PedidoService`).

### DD-03 — Separación estricta Zustand (cliente) vs TanStack Query (servidor)
**Decisión**: Cuatro stores Zustand solo para estado de cliente; todo dato remoto en TanStack Query.
**Alternativas**: Redux/un único store global.
**Justificación**: Evita duplicación y desincronización de datos.

### DD-04 — Soft delete + snapshots + audit trail append-only
**Decisión**: `deleted_at` en entidades de negocio; snapshots en `DetallePedido`; historial inmutable.
**Justificación**: Integridad histórica, trazabilidad y recuperación. **Trade-off**: unicidad requiere índices parciales (`UniqueAuditableMixin`).
**Resuelto en C-06:** dos divergencias del esquema frente a la spec: todas las fechas son `TIMESTAMPTZ` en UTC (la sesión de PostgreSQL se fija en UTC) y `unidades_medida` tiene unicidad de `nombre` y `simbolo` solo entre activas (índices parciales, sin `UNIQUE` total). También se corrigieron `usuario.id` y sus FK como `BIGINT`, `categorias.parent_id` con `ON DELETE SET NULL`, el `CHECK` de stock (`ck_producto_stock_no_negativo`) y `direccion_entrega.linea1` como `TEXT`.

### DD-05 — `personalizacion` como `INTEGER[]` en lugar de tabla intermedia
**Decisión**: Guardar IDs de ingredientes removidos como array de PostgreSQL (más `personalizacion_snapshot` con nombres en).
**Justificación**: Dato inmutable que se lee siempre completo. **Trade-off**: sin integridad referencial; acopla a PostgreSQL; por eso la suite de tests corre sobre PostgreSQL real (SU-07 / C-01, PA-10 resuelta).

### DD-06 — Roles y catálogos con PK semántica
**Decisión (`[INT]`)**: `Rol.codigo`, `EstadoPedido.codigo`, `FormaPago.codigo` como PK textual.
**Alternativa (`[DESC]`)**: ids numéricos estables. **Trade-off**: FKs legibles vs. joins más pesados.

### DD-07 — Pagos con MercadoPago e idempotencia
**Decisión**: Webhook IPN + verificación contra la API de MP; `idempotency_key` UUID; tarjeta nunca toca el backend (SAQ-A).
**Deuda técnica (DT-01)** — variante implementada en el código actual: Checkout Pro (preferencia + redirect) en vez de Checkout API/Orders con tarjeta embebida. Ver [11](11_pagos_mercadopago.md).

### DD-08 — Doble token con refresh rotado y hasheado
**Decisión**: Access corto (30 min) + refresh opaco guardado como SHA-256, agrupado en una *sesión* de 7 días fijos. El refresh rota en cada renovación (historial con `revoked_at`), con período de gracia de 30 s (`REFRESH_REUSE_GRACE_SECONDS`) y detección de reuso que cierra todas las sesiones del usuario (C-02).
**Justificación**: Limita exposición si se compromete un refresh token; logout efectivo sin invalidar el access token (vive hasta 30 min).

### DD-09 — (REEMPLAZADA por C-02) Access token en cookie HttpOnly
**Decisión**: Mitigar XSS evitando exponer el token a JavaScript.
> **Reemplazada (C-02, DT-11 resuelta)**: el access viaja solo por `Authorization: Bearer` y se guarda en `authStore`; la cookie HttpOnly pasó a ser el medio del **refresh** (`Path=/api/v1/auth`, `SameSite`/`Secure` configurables).
**Trade-offs**: Requiere CORS con credenciales, CSRF (SameSite=lax mitiga parcialmente) y `secure=True` en prod; contradice el diseño del frontend descrito en las specs (IN-07).

### DD-10 — Costo de envío fijo (50.00) y descuento 0 en v1
**Decisión**: Constantes en `PedidoService`. **Trade-off**: simple, pero sin reglas reales.

### DD-11 — FSM con permisos por rol en un único diccionario
**Decisión**: `TRANSICIONES[rol][estado_actual] = {destinos}` en `PedidoService`.
**Justificación**: Un solo lugar define qué puede hacer cada rol. **Trade-off**: simple, sin reglas por forma de pago; desde C-08 se consulta con la unión de los roles del usuario (`union_por_roles`), ya no con `roles[0]`.

### DD-12 — (CÓDIGO ACTUAL, deuda DT-10) Rate limiting propio (token bucket en memoria)
**Objetivo (spec)**: slowapi, 5 fallos/15 min/IP en login. **Código actual**: Middleware + `RateLimiter` en lugar de slowapi. **Trade-offs**: no escala a múltiples workers (requeriría Redis); semántica distinta a la spec (IN-10).

### DD-13 — (EXTRA DEL CÓDIGO, no especificado) Tiempo real vía WebSocket con rooms por rol/pedido
Ver [12](12_tiempo_real_websocket.md). Trade-off: estado en memoria (un solo proceso).

### DD-14 — (EXTRA DEL CÓDIGO, no especificado) Imágenes en Cloudinary con upload previo
CRUDs siguen aceptando JSON; el upload es un paso separado multipart; se guarda `public_id` para reemplazo/borrado.

### DD-15 — Migraciones con Alembic (vigente desde C-06)
El esquema se crea y modifica solo con migraciones (`alembic upgrade head` desde `backend/`): migración 001 con las 17 tablas, sin `create_all` en la app ni en el seed, y la suite de tests migra `foodstore_test` desde vacío en cada sesión (CE-04 cubierto por test). El contenedor `backend` migra antes de servir. Historia: antes de C-06 el `lifespan` y el seed ejecutaban `create_all` (DT-09). C-06 también resolvió las divergencias de esquema registradas en DD-04. Ver IN-18.

### DD-16 — `integrador.docx` v5.0 es la spec normativa
**Decisión (confirmada por el usuario)**: ante contradicción entre `integrador.docx` (v5.0) y `Descripcion.docx`, **prevalece `integrador.docx` v5.0**. Cierra SU-02 y PA-02.
**Consecuencias**: nombres `deleted_at/created_at/updated_at`, PK semántica `codigo`, `EN_PREP`, formas de pago `MERCADOPAGO/EFECTIVO/TRANSFERENCIA`, Bearer + interceptor, slowapi 5 fallos/15 min, Checkout API con `CardPayment`, `PATCH /{id}/estado` con `nuevo_estado`+`motivo`. Reglas exclusivas de `[DESC]` (stock en CONFIRMADO, `direccion_snapshot`, RFC 7807, `skip/limit`) **no son normativas**; quedan como referencia o como pregunta abierta donde `[INT]` calla (p. ej. momento del descuento de stock: PA-03, resuelta por DD-20).

### DD-17 — La spec es el objetivo; el código actual es deuda técnica
**Decisión (confirmada por el usuario)**: esta KB describe lo que el sistema **DEBE ser** según integrador v5.0. El comportamiento del código actual se conserva pero se etiqueta como **"deuda técnica / divergencia del código actual"** (callouts `> Deuda técnica` y la tabla consolidada de abajo), nunca como norma.
**Excepción**: lo que la spec no define (rol `COCINA`, WebSocket/KDS, módulo estadísticas más allá del dashboard, unidades de medida, Cloudinary) se documenta como **"extra del código, no especificado"** y queda como pregunta abierta (PA-07, PA-19).
**Cómo se usa**: al planificar changes, tomar la columna "Objetivo (spec)" como criterio de aceptación; la columna "Código actual" define el trabajo de migración.

### DD-18 — Convención de configuración explícita
**Decisión (confirmada por el usuario, C-01)**: tres reglas para la configuración del backend (`Settings`).
1. **Toda variable es explícita**: vive en `.env` / `.env.example` y se declara en `Settings`. Ningún valor efectivo se deriva de otra variable (sin propiedades calculadas; se elimina incluso la construcción de `DATABASE_URL` desde `POSTGRES_*`).
2. **Sin valores por defecto ocultos**: una variable es obligatoria (sin default, fail-fast con un error que la nombra) cuando la app la necesita para funcionar. Las de integraciones opcionales (MercadoPago, Cloudinary) se declaran `Optional = None`, que significa «no configurada»; no son necesarias para arrancar ni para correr los tests, y la funcionalidad falla con un error específico (503, formato uniforme) solo al usarse. **Motivo**: accesibilidad para probar el CRUD sin cuentas externas. `DATABASE_URL` es la única variable de BD del backend; `POSTGRES_*` y `PGADMIN_*` son solo de docker-compose, con consistencia manual con `DATABASE_URL`.
3. **Desviación deliberada de la spec**: DT-22 retira `VITE_FRONTEND_URL` sin prever una variable de backend equivalente, por lo que se agregan `FRONTEND_URL` y `BACKEND_PUBLIC_URL` (opcionales, grupo pagos, removibles en C-12). Pendiente de reflejar en una futura actualización de la spec.
**Consecuencias**: `CORS_ORIGINS` pasa a array JSON; `SQL_ECHO` reemplaza al `echo=True` fijo; `settings` sigue siendo un singleton de módulo.

### DD-19 — El alcance incluye el frontend React completo (PA-01)
**Decisión (confirmada por el usuario, 2026-11-10)**: la entrega incluye el frontend React completo; se hacen todos los changes de Fase 1. Cierra PA-01 y valida SU-01.
**Consecuencias**: el roadmap parte `C-13` en `C-13a` (scaffold) y `C-13b` (auth y datos) y `C-17` en `C-17a`/`C-17b` para que cada change quepa en una sesión; `C-25` se parte en `C-25a` (capas y renombres del backend) y `C-25b` (entrega, docs y video).

### DD-20 — Stock: se verifica al crear, se descuenta al confirmar (PA-03)
**Decisión (confirmada por el usuario, 2026-11-10)**: el stock se descuenta **al confirmarse** el pedido (pago aprobado por MercadoPago o confirmación manual), no al crearlo.
- Crear el pedido solo verifica `disponible` y stock suficiente (errores claros); no descuenta.
- La transición a CONFIRMADO (automática o manual) descuenta de forma atómica dentro de la misma transacción.
- Cancelar un PENDIENTE no devuelve stock (nunca se descontó); cancelar un CONFIRMADO o posterior lo devuelve.
- Sin TTL ni auto-cancelación de pedidos impagos.
- «Pago aprobado sin stock» (dos pedidos pagan el último producto): el segundo pedido pasa a CANCELADO con motivo «sin stock» (actor Sistema, `usuario_id` NULL), el pago queda marcado para devolución manual (la devolución automática sigue fuera de alcance: PA-08 abierta) y el webhook responde 200.
- Confirmación manual (`EFECTIVO`/`TRANSFERENCIA`) sin stock: se rechaza con error claro y el pedido sigue PENDIENTE.
**Justificación**: los pedidos impagos no bloquean inventario. **Trade-off**: un cliente puede pagar y recibir una cancelación por falta de stock (devolución manual). **Es el objetivo**: lo implementa C-10 (con puntos de enganche en C-05 y C-09); el código actual todavía descuenta al crear (DT-04). Ver RN-ST-01..06 en [05](05_reglas_de_negocio.md).

### DD-21 — Migración directa a Checkout API con `CardPayment` (PA-05)
**Decisión (confirmada por el usuario, 2026-11-10)**: se migra a Checkout API con `CardPayment`; C-12 se hace como está planeado. Checkout Pro no queda como etapa intermedia ni como alternativa de redirect en el frontend (C-20). Ver DT-01.

### DD-22 — Confirmación manual de pedidos `EFECTIVO`/`TRANSFERENCIA` (PA-06)
**Decisión (confirmada por el usuario, 2026-11-10)**: los pedidos con `EFECTIVO` o `TRANSFERENCIA` los confirma a mano un usuario ADMIN o PEDIDOS (transición manual PENDIENTE→CONFIRMADO permitida solo para esas formas de pago); los de `MERCADOPAGO` solo se confirman automáticamente por el webhook. Resuelve SU-06. Lo implementa C-09; la confirmación descuenta el stock (DD-20).

### DD-23 — Despacho `EN_CAMINO` por ADMIN/PEDIDOS; `COCINA`/KDS/WebSocket al final (PA-07 parcial)
**Decisión (confirmada por el usuario, 2026-11-10)**: `EN_CAMINO` lo despachan ADMIN y PEDIDOS. El rol `COCINA`, el KDS y el WebSocket quedan para el final: se decide si sobra tiempo y no se tocan ni se eliminan ahora. C-26 y C-27 siguen en Fase 2 opcional; PA-19 sigue abierta.

### DD-24 — Autoridad de los roles: la BD en cada pedido; el claim `roles` es informativo (C-08, OQ-1)
**Decisión (confirmada por el usuario, 2026-11-10)**: `require_role` y los services deciden con los roles leídos de la BD en cada pedido (`get_current_roles`); el claim `roles` del access solo informa a la UI y nunca autoriza. Quitar o agregar un rol tiene efecto en el pedido siguiente. **Contradice** el texto de la spec §4.1 paso 5 («verifica roles del token»); manda la seguridad (sin escalada de privilegios hasta 30 min tras quitar un rol) y el costo es nulo porque el usuario ya se carga en cada pedido. El 403 es neutral («Permisos insuficientes»). Ver `openspec/changes/c-08-rbac-multirol-permisos-stock/design.md` (D1, D3).

## Deuda técnica / divergencias código vs spec (tabla consolidada)

Objetivo = integrador v5.0 (normativo, DD-16). Código actual =. Detalle de cada inconsistencia en [10](10_preguntas_abiertas.md).

| ID | Tema | Objetivo (spec v5.0) | Código actual (deuda) | Ref. | Detalle en |
|----|------|----------------------|-----------------------|------|-----------|
| DT-01 | Integración MP | Checkout API/Orders, token de tarjeta (`CardPayment`), sin salir del sitio (PA-05 resuelta, DD-21: sin etapa intermedia) | Checkout Pro (preferencia + redirect `init_point`) | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-02 | Rol `COCINA` | Solo 4 roles: ADMIN, STOCK, PEDIDOS, CLIENT | `COCINA` usado en `require_role`/WS, no sembrado | IN-12 | [03](03_actores_y_roles.md), [12](12_tiempo_real_websocket.md) |
| DT-03 | Estado `EN_CAMINO` | 6 estados: PENDIENTE→CONFIRMADO→EN_PREP→EN_CAMINO→ENTREGADO + CANCELADO | Seed sin `EN_CAMINO`; FSM permite EN_PREP→ENTREGADO; `CANCELADO.orden=99`. **Parte de seed resuelta en C-07** (catálogo de 6 estados, `CANCELADO.orden=6`); la FSM sigue pendiente de C-09 | IN-03 | [04](04_modelo_de_datos.md), [05](05_reglas_de_negocio.md) |
| DT-04 | Stock | Verificar `disponible`/stock al crear; descontar **al confirmarse** el pedido (pago aprobado o confirmación manual) en la misma transacción; devolver solo al cancelar CONFIRMADO o posterior; sin TTL; caso «pago aprobado sin stock» (DD-20, PA-03 resuelta). Dueño: C-10 | Se descuenta al crear pedido PENDIENTE; restaura en toda cancelación | IN-05, PA-03 | [05](05_reglas_de_negocio.md) |
| DT-05 | Auth de pagos | `/pagos/crear` y `/pagos/{id}` autenticados, solo propietario/ADMIN | Endpoints sin autenticación ni chequeo de propiedad | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-06 | Firma del webhook | Webhook público pero con validación de firma | Sin validación de firma `x-signature` | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-07 (resuelta por C-02) | Logout / refresh | Refresh hasheado SHA-256, rotación, `revoked_at` | Logout y expiración borran la fila; `revoked_at` no se usa; refresh emite JWT y sobrescribe; comparación aware vs naive | IN-08 | [05](05_reglas_de_negocio.md) |
| DT-08 | WebSocket disconnect | (extra, no especificado) | `await manager.disconnect(...)` sobre método síncrono | — | [12](12_tiempo_real_websocket.md) |
| DT-09 | Migraciones | Alembic obligatorio (`alembic upgrade head`, CE-04), `backend/app/main.py`, `backend/app/db/seed.py` | **Resuelta en C-06:** Alembic con migración 001, sin `create_all` (antes: `create_all` en lifespan, sin carpeta `alembic/`) | IN-18, DD-15 | [08](08_arquitectura_propuesta.md) |
| DT-10 | Rate limiting | slowapi, 5 fallos/15 min/IP solo en `POST /auth/login` | Middleware propio, token bucket 5/min en login+register+logout y 60/min global | IN-10, DD-12 | [08](08_arquitectura_propuesta.md) |
| DT-11 (resuelta por C-02) | Transporte del access token | Bearer en header (interceptor Axios), token en `authStore` (solo `accessToken` persistido), `GET /auth/me` | Solo cookie HttpOnly, Bearer deshabilitado, `/usuarios/me`, `secure=False` | IN-07, DD-09 | [08](08_arquitectura_propuesta.md) |
| DT-12 (resuelta por C-02) | Email duplicado | 409 Conflict | 403 | IN-09 | [05](05_reglas_de_negocio.md) |
| DT-13 | Actor del historial | `usuario_id` NULL = Sistema | Webhook registra al dueño del pedido con `rol="ADMIN"` | IN-21 | [05](05_reglas_de_negocio.md), [07](07_flujos_principales.md) |
| DT-14 | Multi-rol | Un usuario puede tener varios roles | **Resuelta por C-08**: FSM y `/mis-pedidos/.../cancelar` evalúan la unión de roles (`union_por_roles`). Único `roles[0]` restante: el handler WebSocket `/cocina/ws` (C-27) | IN-13 | [05](05_reglas_de_negocio.md) |
| DT-15 | Confirmación manual | CONFIRMADO automático por pago en `MERCADOPAGO`; manual solo ADMIN/PEDIDOS y solo para `EFECTIVO`/`TRANSFERENCIA` (DD-22, PA-06 resuelta). Dueño: C-09 | ADMIN/PEDIDOS pueden `PENDIENTE→CONFIRMADO` manualmente para cualquier forma de pago | IN-20, PA-06 | [05](05_reglas_de_negocio.md) |
| DT-16 | Permisos STOCK | Solo stock/`disponible` y lectura de ingredientes | **Resuelta por C-08**: `PATCH /productos/{id}/stock` y `PATCH /productos/{id}/disponibilidad` para ADMIN/STOCK; la escritura de categorías/ingredientes/unidades ya era solo ADMIN | IN-14 | [03](03_actores_y_roles.md) |
| DT-17 | Contrato de pedidos | `PATCH /{id}/estado {nuevo_estado, motivo}`, `GET /{id}` propietario, `DELETE /{id}` cancela el propio | `estado_hacia`, `/mis-pedidos/...`, `DELETE` solo ADMIN soft delete | IN-24 | [07](07_flujos_principales.md) |
| DT-18 | Paginación y errores | `page/size` → `{items,total,page,size,pages}` en todo; errores `{detail, code, field}` | Pedidos usan `offset/limit` y `{data,total}`; rate limit con `{"error":{}}` | IN-11, IN-19 | [02](02_descripcion_general.md) |
| DT-19 | Borrado de categoría | Soft delete con validación | Re-asigna hijas al abuelo sin validar productos | IN-17 | [05](05_reglas_de_negocio.md) |
| DT-20 | Idempotencia de pagos | `idempotency_key` verificado en el webhook | Se genera pero la dedupe real es `pago.estado != "pendiente"` | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-21 | Consistencia pago/pedido | Pago aprobado implica pedido confirmado (transaccional) | Pago `aprobado` con pedido PENDIENTE si falla el cambio de estado; webhook siempre 200 | IN-22 | [11](11_pagos_mercadopago.md) |
| DT-22 | Variables de entorno | `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `VITE_API_URL`, `CORS_ORIGINS` JSON | `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`, CORS por comas | IN-23 | [08](08_arquitectura_propuesta.md) |
| DT-23 | Seed | Admin `Admin1234!`; FormaPago MERCADOPAGO/EFECTIVO/TRANSFERENCIA | `admin123`; `TARJETA` en lugar de `TRANSFERENCIA`. **Resuelta en C-07** (admin `Admin1234!`, `TRANSFERENCIA`, `TARJETA` deshabilitada en bases viejas) | IN-16 | [04](04_modelo_de_datos.md) |
| DT-24 | Frontend | React completo (alcance de la rúbrica; PA-01 resuelta, DD-19) | No existe en el código actual | PA-01 | [13](13_rubrica_y_entrega.md) |
| DT-25 | Capas del backend | Router → Service → UoW → Repository → Model: los routers no usan `Session` ni consultas, y `core/` no depende de `modules/` (reglas duras 1–2) | Los routers de `categorias`, `ingredientes`, `pagos`, `pedidos` y `productos` importan `Session`/`get_session`; `core/deps.py` importa desde `modules/` | Verificación C-01 (dueño: C-25a) | [08](08_arquitectura_propuesta.md) |
| DT-26 | Pagos: `external_reference` | UUID único y obligatorio, generado por el backend | Id numérico del pedido, nullable, sin unicidad (dueño: **C-12**, con su migración) | Verificación C-06 | [11](11_pagos_mercadopago.md) |

Extras del código **no especificados** (se conservan, decisión pendiente): rol `COCINA` + KDS, WebSocket por rooms, módulo estadísticas, unidades de medida, uploads a Cloudinary, rate limit global (PA-07, PA-19).

## Supuestos inferidos

### SU-01 — El proyecto objetivo es full-stack; el código actual cubre solo el backend
**Supuesto**: La carpeta de trabajo debe terminar con backend + frontend según `[INT]`; el código actual cubre solo backend y sirve de base.
**Origen**: El código actual no contiene frontend; las specs lo exigen.
**Riesgo si es falso**: Se planifica trabajo de frontend innecesario (o se omite el requerido).
**Validado (2026-11-10)**: el usuario confirmó el frontend completo (PA-01 resuelta, DD-19).

### SU-02 — (RESUELTO) `integrador.docx` v5.0 prevalece sobre `Descripcion.docx`
Promovido a decisión confirmada por el usuario: ver DD-16. Se conserva el identificador solo como referencia histórica.

### SU-03 — (REEMPLAZADO) Tratamiento de spec vs. código
Reemplazado por DD-17: la spec es el objetivo y el código se documenta como estado actual con deuda técnica.

### SU-04 — Moneda ARS; mercado Argentina
**Origen**: `currency_id: "ARS"`, Rapipago/Pago Fácil, MercadoPago AR, textos en voseo ("tenés") y teléfono con prefijo local.
**Riesgo**: Soporte a otras monedas/mercados queda fuera.

### SU-05 — Despliegue local con Docker Compose para BD; deploy opcional (bonus)
**Origen**: `docker-compose.yml`, bonus +10 por deploy en Railway/Render/Fly.io.
**Riesgo**: Para el webhook en local se necesita ngrok; en producción deben cambiar `secure` de cookie, CORS y URLs.

### SU-06 — Un pedido tiene un único medio de pago "lógico" (`forma_pago_codigo`) y el cobro online solo aplica a MERCADOPAGO/TARJETA
**Origen**: No se documenta qué ocurre con `EFECTIVO`/`TRANSFERENCIA` (¿se confirma manualmente?).
**Riesgo**: Pedidos en efectivo quedarían siempre PENDIENTE si CONFIRMADO es solo automático (RN-PE-02).
**Resuelto (2026-11-10)**: PA-06, DD-22: ADMIN/PEDIDOS confirman a mano los pedidos `EFECTIVO`/`TRANSFERENCIA`.

### SU-07 — Tests de la rúbrica se ejecutan con pytest y BD descartable
**Origen**: `.env.test` y bonus +10.
**Resuelto en C-01 (PA-10)**: los tests corren sobre **PostgreSQL 15 real**, base `foodstore_test` (la crea la suite; `backend/tests/.env.test` no se versiona, sí `backend/tests/.env.test.example`). `ARRAY` y `postgresql_where` se soportan de forma nativa; sin parches ni fallback SQLite. Guardia: la suite aborta si la base no termina en `_test`. Aislamiento por test con transacción externa + savepoint.
