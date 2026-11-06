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
**Decisión**: Access corto (30 min) + refresh largo (7 d) guardado como SHA-256.
**Justificación**: Limita exposición si se compromete un refresh token; logout efectivo sin invalidar el access token.

### DD-09 — (CÓDIGO ACTUAL, deuda DT-11) Access token en cookie HttpOnly
**Decisión**: Mitigar XSS evitando exponer el token a JavaScript.
> **Deuda técnica (DT-11)**: esto describe el código actual, no el objetivo. **Objetivo (spec, normativo)**: Bearer en header gestionado por interceptor Axios, access token en `authStore`.
**Trade-offs**: Requiere CORS con credenciales, CSRF (SameSite=lax mitiga parcialmente) y `secure=True` en prod; contradice el diseño del frontend descrito en las specs (IN-07).

### DD-10 — Costo de envío fijo (50.00) y descuento 0 en v1
**Decisión**: Constantes en `PedidoService`. **Trade-off**: simple, pero sin reglas reales.

### DD-11 — FSM con permisos por rol en un único diccionario
**Decisión**: `TRANSICIONES[rol][estado_actual] = {destinos}` en `PedidoService`.
**Justificación**: Un solo lugar define qué puede hacer cada rol. **Trade-off**: usa solo `roles[0]` del usuario.

### DD-12 — (CÓDIGO ACTUAL, deuda DT-10) Rate limiting propio (token bucket en memoria)
**Objetivo (spec)**: slowapi, 5 fallos/15 min/IP en login. **Código actual**: Middleware + `RateLimiter` en lugar de slowapi. **Trade-offs**: no escala a múltiples workers (requeriría Redis); semántica distinta a la spec (IN-10).

### DD-13 — (EXTRA DEL CÓDIGO, no especificado) Tiempo real vía WebSocket con rooms por rol/pedido
Ver [12](12_tiempo_real_websocket.md). Trade-off: estado en memoria (un solo proceso).

### DD-14 — (EXTRA DEL CÓDIGO, no especificado) Imágenes en Cloudinary con upload previo
CRUDs siguen aceptando JSON; el upload es un paso separado multipart; se guarda `public_id` para reemplazo/borrado.

### DD-15 — Migraciones: Alembic es el objetivo; `create_all` es deuda (DT-09)
`lifespan` ejecuta `SQLModel.metadata.create_all` salvo `ENVIRONMENT=test`; el seed también lo hace. Alembic figura en `requirements.txt` pero no hay migraciones (CE-04 lo exige). Ver IN-18.

### DD-16 — `integrador.docx` v5.0 es la spec normativa
**Decisión (confirmada por el usuario)**: ante contradicción entre `integrador.docx` (v5.0) y `Descripcion.docx`, **prevalece `integrador.docx` v5.0**. Cierra SU-02 y PA-02.
**Consecuencias**: nombres `deleted_at/created_at/updated_at`, PK semántica `codigo`, `EN_PREP`, formas de pago `MERCADOPAGO/EFECTIVO/TRANSFERENCIA`, Bearer + interceptor, slowapi 5 fallos/15 min, Checkout API con `CardPayment`, `PATCH /{id}/estado` con `nuevo_estado`+`motivo`. Reglas exclusivas de `[DESC]` (stock en CONFIRMADO, `direccion_snapshot`, RFC 7807, `skip/limit`) **no son normativas**; quedan como referencia o como pregunta abierta donde `[INT]` calla (p. ej. momento del descuento de stock: PA-03).

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

## Deuda técnica / divergencias código vs spec (tabla consolidada)

Objetivo = integrador v5.0 (normativo, DD-16). Código actual =. Detalle de cada inconsistencia en [10](10_preguntas_abiertas.md).

| ID | Tema | Objetivo (spec v5.0) | Código actual (deuda) | Ref. | Detalle en |
|----|------|----------------------|-----------------------|------|-----------|
| DT-01 | Integración MP | Checkout API/Orders, token de tarjeta (`CardPayment`), sin salir del sitio | Checkout Pro (preferencia + redirect `init_point`) | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-02 | Rol `COCINA` | Solo 4 roles: ADMIN, STOCK, PEDIDOS, CLIENT | `COCINA` usado en `require_role`/WS, no sembrado | IN-12 | [03](03_actores_y_roles.md), [12](12_tiempo_real_websocket.md) |
| DT-03 | Estado `EN_CAMINO` | 6 estados: PENDIENTE→CONFIRMADO→EN_PREP→EN_CAMINO→ENTREGADO + CANCELADO | Seed sin `EN_CAMINO`; FSM permite EN_PREP→ENTREGADO; `CANCELADO.orden=99` | IN-03 | [04](04_modelo_de_datos.md), [05](05_reglas_de_negocio.md) |
| DT-04 | Stock | Verificar `disponible`/stock al crear; momento del descuento: spec silente (PA-03) | Se descuenta al crear pedido PENDIENTE; restaura en toda cancelación | IN-05, PA-03 | [05](05_reglas_de_negocio.md) |
| DT-05 | Auth de pagos | `/pagos/crear` y `/pagos/{id}` autenticados, solo propietario/ADMIN | Endpoints sin autenticación ni chequeo de propiedad | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-06 | Firma del webhook | Webhook público pero con validación de firma | Sin validación de firma `x-signature` | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-07 | Logout / refresh | Refresh hasheado SHA-256, rotación, `revoked_at` | Logout y expiración borran la fila; `revoked_at` no se usa; refresh emite JWT y sobrescribe; comparación aware vs naive | IN-08 | [05](05_reglas_de_negocio.md) |
| DT-08 | WebSocket disconnect | (extra, no especificado) | `await manager.disconnect(...)` sobre método síncrono | — | [12](12_tiempo_real_websocket.md) |
| DT-09 | Migraciones | Alembic obligatorio (`alembic upgrade head`, CE-04), `backend/app/main.py`, `backend/app/db/seed.py` | `create_all` en lifespan, sin carpeta `alembic/`, `main.py`/`seed.py` en raíz | IN-18, DD-15 | [08](08_arquitectura_propuesta.md) |
| DT-10 | Rate limiting | slowapi, 5 fallos/15 min/IP solo en `POST /auth/login` | Middleware propio, token bucket 5/min en login+register+logout y 60/min global | IN-10, DD-12 | [08](08_arquitectura_propuesta.md) |
| DT-11 | Transporte del access token | Bearer en header (interceptor Axios), token en `authStore` (solo `accessToken` persistido), `GET /auth/me` | Solo cookie HttpOnly, Bearer deshabilitado, `/usuarios/me`, `secure=False` | IN-07, DD-09 | [08](08_arquitectura_propuesta.md) |
| DT-12 | Email duplicado | 409 Conflict | 403 | IN-09 | [05](05_reglas_de_negocio.md) |
| DT-13 | Actor del historial | `usuario_id` NULL = Sistema | Webhook registra al dueño del pedido con `rol="ADMIN"` | IN-21 | [05](05_reglas_de_negocio.md), [07](07_flujos_principales.md) |
| DT-14 | Multi-rol | Un usuario puede tener varios roles | Permisos de FSM/WS con `roles[0]` (`KeyError` para STOCK/COCINA) | IN-13 | [05](05_reglas_de_negocio.md) |
| DT-15 | Confirmación manual | CONFIRMADO automático por pago | ADMIN/PEDIDOS pueden `PENDIENTE→CONFIRMADO` manualmente | IN-20, PA-06 | [05](05_reglas_de_negocio.md) |
| DT-16 | Permisos STOCK | Solo stock/`disponible` y lectura de ingredientes | Categorías/ingredientes/unidades solo ADMIN; productos sin verificar (ver PA-09) | IN-14 | [03](03_actores_y_roles.md) |
| DT-17 | Contrato de pedidos | `PATCH /{id}/estado {nuevo_estado, motivo}`, `GET /{id}` propietario, `DELETE /{id}` cancela el propio | `estado_hacia`, `/mis-pedidos/...`, `DELETE` solo ADMIN soft delete | IN-24 | [07](07_flujos_principales.md) |
| DT-18 | Paginación y errores | `page/size` → `{items,total,page,size,pages}` en todo; errores `{detail, code, field}` | Pedidos usan `offset/limit` y `{data,total}`; rate limit con `{"error":{}}` | IN-11, IN-19 | [02](02_descripcion_general.md) |
| DT-19 | Borrado de categoría | Soft delete con validación | Re-asigna hijas al abuelo sin validar productos | IN-17 | [05](05_reglas_de_negocio.md) |
| DT-20 | Idempotencia de pagos | `idempotency_key` verificado en el webhook | Se genera pero la dedupe real es `pago.estado != "pendiente"` | IN-25 | [11](11_pagos_mercadopago.md) |
| DT-21 | Consistencia pago/pedido | Pago aprobado implica pedido confirmado (transaccional) | Pago `aprobado` con pedido PENDIENTE si falla el cambio de estado; webhook siempre 200 | IN-22 | [11](11_pagos_mercadopago.md) |
| DT-22 | Variables de entorno | `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `VITE_API_URL`, `CORS_ORIGINS` JSON | `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`, CORS por comas | IN-23 | [08](08_arquitectura_propuesta.md) |
| DT-23 | Seed | Admin `Admin1234!`; FormaPago MERCADOPAGO/EFECTIVO/TRANSFERENCIA | `admin123`; `TARJETA` en lugar de `TRANSFERENCIA` | IN-16 | [04](04_modelo_de_datos.md) |
| DT-24 | Frontend | React completo (alcance de la rúbrica) | No existe en el código actual | PA-01 | [13](13_rubrica_y_entrega.md) |
| DT-25 | Capas del backend | Router → Service → UoW → Repository → Model: los routers no usan `Session` ni consultas, y `core/` no depende de `modules/` (reglas duras 1–2) | Los routers de `categorias`, `ingredientes`, `pagos`, `pedidos` y `productos` importan `Session`/`get_session`; `core/deps.py` importa desde `modules/` | Verificación C-01 | [08](08_arquitectura_propuesta.md) |

Extras del código **no especificados** (se conservan, decisión pendiente): rol `COCINA` + KDS, WebSocket por rooms, módulo estadísticas, unidades de medida, uploads a Cloudinary, rate limit global (PA-07, PA-19).

## Supuestos inferidos

### SU-01 — El proyecto objetivo es full-stack; el código actual cubre solo el backend
**Supuesto**: La carpeta de trabajo debe terminar con backend + frontend según `[INT]`; el código actual cubre solo backend y sirve de base.
**Origen**: El código actual no contiene frontend; las specs lo exigen.
**Riesgo si es falso**: Se planifica trabajo de frontend innecesario (o se omite el requerido).
**Validar**: Confirmar con el equipo/docente el alcance de esta entrega (ver PA-01).

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
**Validar**: PA-06.

### SU-07 — Tests de la rúbrica se ejecutan con pytest y BD descartable
**Origen**: `.env.test` y bonus +10.
**Resuelto en C-01 (PA-10)**: los tests corren sobre **PostgreSQL 15 real**, base `foodstore_test` (la crea la suite; `backend/tests/.env.test` no se versiona, sí `backend/tests/.env.test.example`). `ARRAY` y `postgresql_where` se soportan de forma nativa; sin parches ni fallback SQLite. Guardia: la suite aborta si la base no termina en `_test`. Aislamiento por test con transacción externa + savepoint.
