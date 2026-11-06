# Preguntas Abiertas

Estado: PA-02 resuelta por el usuario (DD-16); PA-19 agregada. Fuentes: `[DESC]` Descripcion.docx, `[INT]` integrador.docx v5.0. Generado en modo silencioso (sin consultar al usuario): todo lo ambiguo o contradictorio queda registrado aquí.

> **Regla de resolución (DD-16 / DD-17, confirmada por el usuario):** `integrador.docx` v5.0 es normativo frente a `Descripcion.docx`, y la **spec es el objetivo**; el código es el estado actual con deuda técnica. Por eso, en las "Resolución" de abajo, el objetivo es la spec v5.0 salvo donde se indique "abierta" (la spec calla). La tabla consolidada de deuda está en [09 — Deuda técnica](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada) (DT-01..DT-25).

## Inconsistencias detectadas

### IN-01 — Nombres de campos de auditoría y soft delete
**Documento A dice** (`[DESC]`): `eliminado_en`, `creado_en`, `actualizado_en`.
**Documento B dice** (`[INT]`): `deleted_at`, `created_at`, `updated_at`.
**Impacto**: Migraciones, schemas y frontend inconsistentes.
**Resolución (cerrada, DD-16)**: `deleted_at/created_at/updated_at` (spec v5.0; el código ya coincide).

### IN-02 — PK de roles/estados/formas de pago
**A** (`[DESC]`): `Rol` y `EstadoPedido` con id numérico estable (ADMIN=1…, PENDIENTE=1…); `FormaPago` con `nombre`, `activo`.
**B** (`[INT]`): PK semántica `codigo` (`ADMIN`, `PENDIENTE`…); `FormaPago.descripcion`, `habilitado`.
**Impacto**: FKs y payloads (`forma_pago_codigo` vs `forma_pago_id`).
**Resolución (cerrada, DD-16)**: PK semántica `codigo` (spec v5.0).

### IN-03 — Estados del pedido: `EN_CAMINO` y nombre de `EN_PREPARACIÓN`
**A** (`[DESC]`,`[INT]`): 6 estados incluyendo `EN_CAMINO` (`[DESC]` llama al tercero `EN_PREPARACIÓN`; `[INT]` `EN_PREP`).
**B** (código actual): `seed.py` solo siembra 5 estados (sin `EN_CAMINO`; `orden` ENTREGADO=5, CANCELADO=99); la FSM permite `EN_PREP → ENTREGADO`.
**Impacto**: El flujo de despacho y el seguimiento al cliente no existen; la rúbrica pide FSM de 6 estados.
**Resolución (spec = objetivo; deuda DT-03)**: Agregar `EN_CAMINO` al seed y a `TRANSICIONES` (`EN_PREP → EN_CAMINO → ENTREGADO`), usar el código `EN_PREP`.

### IN-04 — Quién puede cancelar y desde qué estados
**A** (`[DESC]`): PENDIENTE→CANCELADO por Cliente/PEDIDOS/ADMIN; CONFIRMADO→CANCELADO por PEDIDOS/ADMIN (no el cliente); EN_PREP→CANCELADO solo ADMIN.
**B** (`[INT]`): cliente propietario cancela PENDIENTE **o CONFIRMADO**; EN_PREP→CANCELADO "solo ADMIN/PEDIDOS".
**C** (código actual): CLIENT cancela PENDIENTE y CONFIRMADO; ADMIN y PEDIDOS cancelan hasta EN_PREP.
**Impacto**: Permisos y devoluciones de stock/dinero.
**Resolución (cerrada, DD-16)**: `[INT]` es normativo (cliente cancela PENDIENTE o CONFIRMADO; EN_PREP solo ADMIN/PEDIDOS). `[DESC]` no aplica.

### IN-05 — Momento del descuento de stock
**A** (`[DESC]` RN-03/04): se decrementa al pasar a **CONFIRMADO**; se restaura al cancelar un pedido ya confirmado.
**B** (código actual): se decrementa al **crear el pedido** (PENDIENTE) y se restaura en cualquier cancelación. `[INT]` solo exige verificar `disponible`/stock al crear.
**Impacto**: Pedidos impagos "reservan" stock indefinidamente (no hay expiración de PENDIENTE); en el código actual un pedido PENDIENTE sin pagar bloquea inventario.
**Resolución (abierta, deuda DT-04)**: `[INT]` solo exige verificar `disponible`/stock al crear; el momento del descuento no está especificado (la regla de `[DESC]` no es normativa). Decidir reserva al crear (con TTL/auto-cancelación) o decremento en CONFIRMADO. Ver PA-03.

### IN-06 — Dos numeraciones "RN-01..05"
**A** (`[DESC]`): RN-01 sin saltos; RN-02 CONFIRMADO solo automático; RN-03 decremento de stock; RN-04 restauración; RN-05 terminales.
**B** (`[INT]`): RN-01 terminales; RN-02 historial inicial con `estado_desde=NULL`; RN-03 append-only; RN-04 snapshot; RN-05 motivo obligatorio al cancelar.
**Impacto**: Referencias ambiguas en rúbrica ("RN-01/02/03/05").
**Resolución**: Esta KB usa `RN-PE-xx` y mapea ambas (ver 05). Como `[INT]` es normativo, la rúbrica usa su numeración (RN-01..05 de `[INT]`).

### IN-07 — Transporte del access token y persistencia en el cliente
**A** (`[DESC]`): Bearer en header; authStore persiste access+refresh+usuario en localStorage. (`[INT]`): token en authStore, "NO en localStorage directamente"; `partialize` solo `accessToken`; `GET /auth/me` rehidrata usuario.
**B** (código actual): solo cookie HttpOnly; Bearer deshabilitado; refresh token devuelto en el body (el cliente debe guardarlo); `/auth/me` no existe (es `/usuarios/me`).
**Impacto**: El frontend de la spec (interceptor Axios con Bearer) no funciona contra el backend actual; falta definir dónde vive el refresh token.
**Resolución (spec = objetivo; deuda DT-11)**: Bearer en header + interceptor Axios, token en `authStore` (solo `accessToken` persistido), `GET /auth/me`. El backend debe volver a aceptar Bearer; la cookie HttpOnly es código actual. Ver PA-04 (dónde guardar el refresh token).

### IN-08 — Modelo de refresh token
**A** (`[DESC]`): UUID v4 opaco; al rotar, el anterior se marca `revocado_en` y se emite uno nuevo.
**B** (`[INT]`): `token_hash` SHA-256 + `revoked_at`.
**C** (código actual): login emite `token_urlsafe(32)`; `refresh` genera un **JWT** refresh y **sobrescribe** la fila (mismo registro); `logout` y expiración **borran** la fila (`revoked_at` nunca se usa). Compara `expires_at` (aware) con `datetime.utcnow()` (naive): posible `TypeError`.
**Impacto**: Inconsistencia de formato entre login y refresh; sin trazabilidad de revocación; posible error en producción.
**Resolución (spec = objetivo; deuda DT-07)**: `token_hash` SHA-256 + `revoked_at`; rotar marcando el anterior revocado; logout no borra la fila; corregir comparación aware/naive.

### IN-09 — Registro: campos y código de error por email duplicado
**A** (`[DESC]`): `nombre`, `telefono`, `password_confirmation?`; duplicado → **409**. (`[INT]`): `nombre, apellido, email, password`; duplicado en servicio (409 implícito).
**B** (código actual): `nombre, apellido, celular`; duplicado → **403**.
**Impacto**: Contratos de API y manejo de errores en frontend.
**Resolución (spec = objetivo; deuda DT-12)**: 409 Conflict; campos `nombre, apellido, email, password, celular?`. El 403 actual es deuda.

### IN-10 — Rate limiting
**A** (`[DESC]`,`[INT]`): slowapi, **5 intentos fallidos / 15 min / IP** solo en `POST /auth/login`.
**B** (código actual): middleware propio, token bucket **5 por minuto, ráfaga 5**, sobre login+register+logout (todas las peticiones, no solo fallidas) más límite por defecto 60/min (ráfaga 10) en toda la API; slowapi no está instalado; `X-RateLimit-Remaining` siempre `capacity-1`.
**Impacto**: Comportamiento distinto al evaluado por la rúbrica.
**Resolución (spec = objetivo; deuda DT-10)**: slowapi, 5 intentos fallidos / 15 min / IP solo en `POST /auth/login`. El limitador propio es código actual (el límite global es un extra no especificado).

### IN-11 — Paginación
**A** (`[DESC]`): `skip`/`limit`. (`[INT]`): `page`/`size` → `{items,total,page,size,pages}`.
**B** (código actual): mezcla — usuarios/categorías/ingredientes/unidades usan `page/size` + `PaginatedResponse`; pedidos usan `offset/limit` y devuelven `{data,total}`.
**Resolución (spec = objetivo; deuda DT-18)**: Estandarizar en `page/size` + `{items,total,page,size,pages}`.

### IN-12 — Rol `COCINA` no definido
**A** (`[DESC]`,`[INT]`): exactamente 4 roles.
**B** (código actual): `require_role([..."COCINA"])` en `PATCH /pedidos/{id}/estado`, `GET /cocina/pedidos` y el WebSocket de cocina; el rol no se siembra.
**Impacto**: Imposible asignar el rol vía seed; código muerto o rol faltante.
**Resolución (abierta; deuda DT-02)**: la spec define solo 4 roles; `COCINA` es un **extra del código, no especificado**. Pendiente decidir si se incorpora a la spec o se elimina. Ver PA-07.

### IN-13 — Multi-rol vs uso de `roles[0]`
**A** (spec): un usuario puede tener varios roles. **B** (código actual): `current_user.roles[0].codigo` decide permisos de transición/WS; un usuario con `CLIENT` + `ADMIN` puede actuar con el rol equivocado; `TRANSICIONES[rol]` da `KeyError` si el rol es `STOCK`/`COCINA`.
**Resolución (spec = objetivo; deuda DT-14)**: evaluar el conjunto de roles (unión de permisos), no `roles[0]`.

### IN-14 — Permisos de STOCK
**A** (`[DESC]`): crea/edita/desactiva productos, gestiona ingredientes, alérgenos y categorías. **B** (`[INT]`): solo lee productos, actualiza `stock_cantidad`/`disponible`, ve ingredientes. **C** (código actual): categorías/ingredientes/unidades solo ADMIN (productos: ver PA-09).
**Resolución (cerrada, DD-16; deuda DT-16)**: seguir `[INT]` (STOCK solo stock/`disponible`).

### IN-15 — Dirección de entrega y snapshots
**A** (`[DESC]`): `calle, numero, piso, departamento, ciudad, codigo_postal, referencia, es_predeterminada`; `Pedido.direccion_snapshot` serializado (CE-13 exige preservar direcciones).
**B** (`[INT]`): `alias, linea1, es_principal`, `direccion_id` FK `SET NULL` (NULL = retiro en local); sin snapshot. **C** (código actual): + `linea2, provincia, latitud, longitud`; sin snapshot.
**Impacto**: Editar/eliminar una dirección altera datos de pedidos históricos; incumple CE-13 de `[DESC]`.
**Resolución (abierta)**: `[INT]` no define `direccion_snapshot` (solo `[DESC]`, no normativo): el objetivo es `direccion_id` `SET NULL`. Agregar el snapshot sería una mejora opcional; ver PA-13.

### IN-16 — Forma de pago y catálogo de formas
**A** (`[DESC]`): Tarjeta de crédito/débito (+ opcional Efectivo). **B** (`[INT]`): `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA`. **C** (código actual): `EFECTIVO`, `MERCADOPAGO`, `TARJETA`.
**Resolución (spec = objetivo; deuda DT-23)**: catálogo `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA`; flujo de cobro de EFECTIVO/TRANSFERENCIA abierto (PA-06).

### IN-17 — Eliminación de categorías
**A** (`[INT]`): "soft delete con validación" (`ON DELETE SET NULL` en `parent_id`). **B** (código actual): re-asigna las hijas al padre de la eliminada, sin validar productos asociados.
**Resolución (spec = objetivo; deuda DT-19)**: soft delete **con validación**; definir el detalle (bloquear con productos/hijas).

### IN-18 — Migraciones y estructura del proyecto
**A** (spec): Alembic obligatorio (CE-04 `alembic upgrade head`), `backend/app/main.py`, `python -m app.db.seed` (desde `backend/`). **B** (código actual): sin carpeta `alembic/`, `create_all` en `lifespan`, `main.py` y `seed.py` en la raíz, `uvicorn main:app`; README sin los endpoints reales (documenta `PUT`, `routers.py`, puerto DB 5432 vs compose 5433; solo variables mínimas).
**Resolución (spec = objetivo; deuda DT-09)**: Alembic, `backend/app/main.py`, `backend/app/db/seed.py`; alinear estructura y README antes de entregar.

### IN-19 — Formato de errores
**A** (`[DESC]`): RFC 7807 (`type, title, status, detail, instance`). **B** (`[INT]`): `{detail, code, field}` (mencionado como RFC 7807 pero es otro formato); el rate limit devuelve `{"error": {...}}` con otra forma.
**Resolución (spec = objetivo; deuda DT-18)**: formato `{detail, code, field}` de `[INT]` en toda la API (incluido el rate limit); RFC 7807 de `[DESC]` no es normativo.

### IN-20 — CONFIRMADO "solo automático" vs transición manual
**A** (`[DESC]` RN-02): nadie puede confirmar manualmente. **B** (código actual): ADMIN y PEDIDOS tienen `PENDIENTE→CONFIRMADO` en `TRANSICIONES` (útil para pagos en efectivo, pero rompe la regla).
**Resolución (spec = objetivo; deuda DT-15)**: CONFIRMADO automático por pago; la confirmación manual del código actual es deuda salvo que PA-06 la habilite para efectivo/transferencia.

### IN-21 — Actor del historial en transiciones automáticas
**A** (`[DESC]`,`[INT]`): `usuario_id` NULL cuando es el Sistema. **B** (código actual): el webhook registra como actor al **dueño del pedido** y usa `rol="ADMIN"` para saltear permisos.
**Impacto**: Auditoría engañosa (parece que el cliente confirmó su pedido).
**Resolución (spec = objetivo; deuda DT-13)**: `usuario_id = NULL` para el Sistema.

### IN-22 — Inconsistencia pago aprobado / pedido no confirmado
**Detalle** (código actual): dentro del webhook el pago se marca `aprobado` y luego se intenta cambiar el pedido; si falla (p. ej. stock insuficiente ya descontado/estado distinto), se registra un warning y el pago queda `aprobado` con el pedido en PENDIENTE; el webhook siempre responde 200 (MP no reintenta).
**Resolución (spec = objetivo; deuda DT-21)**: transacción única o reintento/cola; alertar.

### IN-23 — Nombres de variables de entorno
**A** (`[DESC]`): `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `VITE_API_BASE_URL`, `VITE_MERCADOPAGO_PUBLIC_KEY`. **B** (`[INT]`): `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `VITE_API_URL`, `VITE_MP_PUBLIC_KEY`, `CORS_ORIGINS` como JSON array. **C** (código actual): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`, `CLOUDINARY_*`, `CORS_ORIGINS` separado por comas.
**Resolución (spec = objetivo; deuda DT-22)**: adoptar los nombres de `[INT]` (`ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `VITE_API_URL`, `VITE_MP_PUBLIC_KEY`, `CORS_ORIGINS` JSON array) y documentarlos en `.env.example` (CE-03). Los nombres del código (`MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL`) son estado actual.

### IN-24 — Endpoints de pedidos y cuerpos de request
**A** (`[DESC]`): `PATCH /pedidos/{id}/avanzar` y `/cancelar`, body `observacion` (<= 500). **B** (`[INT]`): `PATCH /{id}/estado` {`nuevo_estado`, `motivo`}; `DELETE /{id}` cancela el propio; `GET /{id}/historial`. **C** (código actual): `PATCH /{id}/estado` {`estado_hacia`, `motivo`}; `PATCH /mis-pedidos/{id}/cancelar`; `DELETE /{id}` (ADMIN, soft delete); `GET /mis-pedidos`. Además `[INT]` pide `GET /pedidos/{id}` para el propietario (en el código actual el cliente usa `/mis-pedidos/{id}`).
**Resolución (spec = objetivo; deuda DT-17)**: `PATCH /{id}/estado {nuevo_estado, motivo}`, `DELETE /{id}` (cancela el propio), `GET /{id}/historial`, `GET /{id}` para el propietario. Los endpoints `/mis-pedidos/...` y `estado_hacia` son código actual.

### IN-25 — Modalidad de integración con MercadoPago
**A** (`[DESC]`,`[INT]`): Checkout API con Orders, token de tarjeta del navegador, `POST /pagos/crear` con token, `idempotency_key` verificado en el webhook; `[DESC]` además `crear-preferencia`. **B** (código actual): Checkout Pro (preferencia + `init_point` + redirect, `back_urls` vía ngrok), `POST /pagos/crear {pedido_id}`, `idempotency_key` solo se genera (no se usa para deduplicar); sin validación de firma; sin autenticación.
**Resolución (spec = objetivo; deuda DT-01, DT-05, DT-06, DT-20)**: Checkout API/Orders con token de tarjeta, `idempotency_key` verificado, firma del webhook validada y endpoints autenticados (rúbrica: "SDK con idempotency_key UUID; webhook topic=payment que avanza pedido; tabla Pago completa"). Checkout Pro es el código actual.

### IN-26 — Tarjetas de prueba con vencimiento en el pasado
**Detalle** (`[INT]` §8.3): vencimiento `11/25`; la fecha actual del proyecto es posterior (hoy 2026-11). Las tarjetas sandbox de MP aceptan "cualquier fecha futura".
**Resolución**: Actualizar la guía de test (usar vencimiento futuro).

### IN-27 — Estadísticas: nombres vs semántica
**Detalle** (código actual): `ResumenResponse.ventas_hoy` e `ingresos_mes` reciben el mismo valor (total del rango `desde-hasta`); no se aclara si cuentan pedidos CANCELADO/PENDIENTE como ventas. `[DESC]`/`[INT]` solo mencionan "métricas/dashboard con KPIs".
**Resolución**: Definir qué pedidos computan como venta (¿solo CONFIRMADO o posteriores?).

## Preguntas abiertas (priorizadas)

| ID | Prioridad | Pregunta | Bloquea | Decisor |
|----|-----------|----------|---------|---------|
| PA-01 | Alta | ¿El alcance de esta entrega incluye el frontend React completo (el código actual solo trae backend) o solo se completa/audita el backend? | Planificación de changes | Equipo / docente |
| PA-02 | **RESUELTA** | ¿Qué documento es normativo? **Respuesta del usuario: `integrador.docx` v5.0 prevalece** → DD-16 (cierra SU-02) | — | Usuario |
| PA-03 | Alta | ¿Descontar stock al crear el pedido (con expiración de PENDIENTE) o al confirmarse el pago? ¿Hay TTL para pedidos impagos? | Change de pedidos/stock | Product Owner / Tech Lead |
| PA-04 | Alta | Objetivo spec: Bearer en header. Queda abierto **dónde guarda el frontend el refresh token** (la spec solo persiste `accessToken`) y si se admite cookie como complemento | Auth frontend + backend | Tech Lead |
| PA-05 | Media | Objetivo spec: Checkout API/Orders con `CardPayment`, firma de webhook validada, endpoints de pago autenticados (DT-01/05/06). Abierto: ¿se acepta Checkout Pro como etapa intermedia hasta migrar? | Change de pagos | Tech Lead |
| PA-06 | Alta | ¿Cómo se confirman pedidos con `EFECTIVO`/`TRANSFERENCIA` si CONFIRMADO es solo automático por pago MP? ¿Quién marca el cobro? | FSM y pagos | Product Owner |
| PA-07 | Alta | `EN_CAMINO` entra al seed/FSM (spec, DT-03); abierto: ¿quién despacha (ADMIN/PEDIDOS)? El rol `COCINA` y el KDS son **extras del código, no especificados**: ¿se incorporan a la spec o se eliminan? (IN-12, DT-02) | Change de pedidos | Product Owner |
| PA-08 | Media | ¿Se reembolsa automáticamente un pago aprobado si el pedido se cancela (CONFIRMADO)? ¿Se cancela el pedido si el pago es `cancelled`? | Pagos / cancelación | Product Owner |
| PA-09 | **RESUELTA** | Auditoría de productos, ingredientes y Cloudinary en C-01. Auditoría (`openspec/changes/archive/2026-11-06-c-01-baseline-backend/design.md`): escritura ADMIN correcta; **gaps** (no corregidos en C-01): STOCK no puede actualizar `stock_cantidad` (solo `PUT` ADMIN); `PATCH /{id}/disponibilidad` es un toggle sin body, no idempotente; la lectura pública acepta `estado`/`include_deleted` y expone eliminados (viola RN-PR-03); `HTTPException` en services; unicidad incluye eliminados y responde 400 en vez de 409. Insumo de C-08/C-11; Cloudinary perezoso/opcional resuelto en C-01 (D8), `HTTPException` en core → C-28 | Auditoría de catálogo | Equipo técnico |
| PA-10 | **RESUELTA** | Los tests no usan SQLite: corren sobre **PostgreSQL 15 real** (`foodstore_test`, mismo contenedor de desarrollo, puerto 5433) con guardia `_test`, transacción externa + savepoint por test y `create_all` por sesión (C-06 lo cambia por Alembic). Ver DD-18 / SU-07 | Estrategia de pruebas / bonus | Equipo técnico |
| PA-11 | Media | ¿Qué reglas definen el costo de envío y el campo `descuento` (v1 fijo 50.00 / 0)? | Cálculo de totales | Product Owner |
| PA-12 | Media | ¿Se debe auto-marcar `disponible=false` cuando el stock llega a 0? | Catálogo | Product Owner |
| PA-13 | Media | ¿`direccion_id` NULL (retiro en local) cobra envío? ¿Se agrega `direccion_snapshot`? (IN-15) | Totales y trazabilidad | Product Owner |
| PA-14 | Media | ¿Estandarizar paginación, formato de errores y nombres de endpoints según IN-11/IN-19/IN-24? | Contrato de API | Tech Lead |
| PA-15 | Media | ¿Se implementan las migraciones Alembic (CE-04) y se alinea la estructura de directorios con la spec (IN-18)? | Entrega | Equipo técnico |
| PA-16 | Baja | ¿Cobertura mínima de tests (>60% para bonus) y alcance (`test_pedidos`, `test_pagos`, `test_auth`)? | Bonus | Equipo |
| PA-17 | Baja | ¿Se hará deploy (Railway/Render/Fly.io) para el bonus? Requiere cookies `secure=True`, CORS y `NGROK_URL` reemplazada | Bonus | Equipo |
| PA-18 | Baja | Metadatos faltantes en `integrador.docx`: **Materia** y **Carrera** están vacíos; nombre del equipo/docente desconocido | Documentación de entrega | Equipo |
| PA-19 | Media | Extras del código no especificados (WebSocket/KDS, `COCINA`, estadísticas, unidades de medida, Cloudinary, rate limit global, `GET /pedidos/cocina/pedidos`): ¿se formalizan en la spec o se descartan? | Alcance | Product Owner / docente |

## Incertidumbres del campo `kb.discovery` (inferencia Mode A)

- **[DISCOVERY] `system_type`**: inferido como `web_app` (SPA React + API REST FastAPI, con WebSocket). Confianza **alta**; el código actual contiene solo la API, pero las specs describen una web app full-stack.
- **[DISCOVERY] `scale`**: inferido como `public_multi_user` (tienda pública con registro abierto y 4 roles). Confianza **media**: las fuentes no indican volumen de usuarios ni tráfico esperado; es un TPI académico (el rate limiter y WebSocket en memoria asumen un único proceso). Por favor confirmar: ¿el sistema se desplegará públicamente o solo corre local para la evaluación?
- **[DISCOVERY] `needs_infra`**: `true` (PostgreSQL, Docker Compose, ngrok para webhook, Cloudinary, MercadoPago). Confianza alta.
