# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **Food Store** (React + TS + Vite + Tailwind + TanStack Query + Zustand / FastAPI + SQLModel + PostgreSQL + Alembic; MercadoPago, Cloudinary).
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.**

**Regla de la KB (DD-16/DD-17):** la spec `integrador.docx` v5.0 es el objetivo; el código actual (solo backend) es el *estado actual con deuda técnica*. La tabla consolidada DT-01..DT-26 vive en `knowledge-base/09_decisiones_y_supuestos.md`. Por eso la **Fase 0 corrige la deuda** antes de construir features (Fase 1). La Fase 2 son extras no especificados, opcionales y bloqueados.

**Decisiones del usuario (2026-11-10, DD-19..DD-23)** que fijan el alcance de este mapa:
- **PA-01 resuelta (DD-19):** el alcance incluye el frontend React completo (Fase 1 completa).
- **PA-03 resuelta (DD-20):** el stock se descuenta **al confirmarse** el pedido (pago aprobado o confirmación manual), no al crearlo; sin TTL ni auto-cancelación de pedidos impagos. Lo implementa C-10 (con C-05 y C-09 como puntos de enganche).
- **PA-05 resuelta (DD-21):** se migra a Checkout API con `CardPayment` (C-12); Checkout Pro no queda como etapa intermedia.
- **PA-06 resuelta (DD-22):** los pedidos `EFECTIVO`/`TRANSFERENCIA` los confirma a mano ADMIN o PEDIDOS; los `MERCADOPAGO` solo se confirman automáticamente.
- **PA-07 parcial (DD-23):** `EN_CAMINO` lo despachan ADMIN y PEDIDOS. El rol `COCINA`, el KDS y el WebSocket quedan para el final (C-26, C-27 en Fase 2) y no se tocan ahora.

**Leyenda de marcas**
- `[UI-MOCKUP]` = change visual: requiere mockup aprobado antes de apply (política `system-and-mockups`, design system Revision 1 aprobado en `design-system/README.md`). Registrar `## UI Mockups` en el `design.md` del change.
- `[PENDIENTE DE DECISIÓN: PA-xx]` = el orden o scope puede cambiar según una pregunta abierta que sigue abierta (hoy PA-08, PA-14); **no bloquea** el roadmap (se implementa con el supuesto indicado y se ajusta).
- `[OPCIONAL/BLOQUEADO]` = Fase 2; no iniciar hasta resolver la parte abierta de PA-07 (COCINA/KDS) y PA-19.
- Los sufijos `a`/`b` (`C-13a`, `C-13b`, `C-17a`, `C-17b`, `C-25a`, `C-25b`) parten un change en dos sin renumerar el resto.

---

## Cómo usar este documento

1. Identificá el siguiente change cuyo `Estado` es `[ ]` y cuyas **Dependencias** están todas en `[x]`.
2. Leé los archivos de **Leer antes** (y la fila de deuda DT-xx en `knowledge-base/09`); el objetivo es la columna "Objetivo (spec)".
3. Ejecutá `/opsx:propose C-NN-nombre` (si es `[UI-MOCKUP]`, generá y aprobá el mockup antes de `/opsx:apply`; respetá el nivel de **Governance**: CRITICO = solo análisis hasta aprobación humana, ALTO = proponer y esperar revisión).
4. Implementá con `/opsx:apply`, verificá con `openspec-verify` y cerrá con `/opsx:archive`.
5. Marcá el checkbox `[x]` en el `Estado` del change en este archivo.

---

## Árbol de dependencias

```
FASE 0 (backend)
C-01 ✓ baseline-backend
 ├── C-03 auth-rate-limit-slowapi
 ├── C-04 pagos-autorizacion-propietario
 │     └── C-05 pagos-webhook-firma-idempotencia ──┐
 └── C-06 ✓ datos-migraciones-alembic              │
       ├── C-02 ✓ auth-sesion-tokens-bearer-refresh┼─┬── C-08 rbac-multirol-permisos-stock
       │                                           │ └── C-13b fe-foundation-auth-data (también C-13a, C-11)
       └── C-07 datos-seed-y-catalogos             │
             └── C-09 pedidos-fsm-en-camino  (+C-08)
                   ├── C-10 pedidos-stock-descuento
                   ├── C-11 pedidos-contrato-api-y-categorias
                   └── C-12 pagos-checkout-api-cardpayment (+C-05)

FASE 1 (frontend sobre base corregida)
C-13a fe-foundation-scaffold (solo C-01; corre en paralelo con la Fase 0)
 └── C-13b fe-foundation-auth-data (C-13a, C-02, C-11)
       ├── C-14 fe-auth-cuenta
       ├── C-15 fe-direcciones
       ├── C-16 fe-catalogo-publico
       │     └── C-18 fe-carrito-personalizacion
       │           └── C-19 fe-checkout-pedido (+C-10, C-11, C-15)
       │                 ├── C-20 fe-pago-mercadopago (+C-12)
       │                 └── C-21 fe-mis-pedidos-seguimiento (+C-11)
       ├── C-17a fe-admin-categorias-ingredientes (+C-08)
       │     └── C-17b fe-admin-productos-stock (+C-08)
       ├── C-22 fe-gestion-operativa-pedidos (+C-09, C-11)
       │     └── C-24 fe-dashboard-metricas
       └── C-23 fe-admin-usuarios-roles (+C-08)
C-25a backend-capas-y-renombres (C-01..C-12; en paralelo con el frontend)
C-25b entrega-docs-video (todo lo anterior)

FASE 2 (opcional/bloqueado: COCINA/KDS de PA-07, PA-19)
C-26 rol-cocina-kds (C-09, C-08) ── C-27 websocket-tiempo-real (C-09, C-02) ── C-28 extras-cloudinary-unidades-ratelimit-global (C-17b, C-03)
```

### Paralelismo por fase

```
GATE 0: C-01 ✓                                          ← FORK
  → C-04 pagos-autorizacion-propietario       [Agente B — CRITICO]
  → C-06 ✓ datos-migraciones-alembic          [Agente C]
  → C-03 auth-rate-limit-slowapi              [Agente A, en paralelo a C-06]
  → C-13a fe-foundation-scaffold              [Agente C — sin dependencia de backend; puede ir en cualquier hueco]

GATE 1: C-04 ✓ / C-06 ✓
  → C-02 ✓ auth-sesion-tokens-bearer-refresh [Agente A — CRITICO, tras C-06]
  → C-05 pagos-webhook-firma-idempotencia     [Agente B — si C-04 ✓]
  → C-07 ✓ datos-seed-y-catalogos             [Agente C — si C-06 ✓]

GATE 1b: C-02 ✓
  → C-08 ✓ rbac-multirol-permisos-stock         [Agente A — si C-02 ✓]

GATE 2: C-07 ✓ + C-08 ✓
  → C-09 pedidos-fsm-en-camino                [Agente A]

GATE 3: C-09 ✓                                          ← FORK
  → C-10 pedidos-stock-descuento              [Agente A]
  → C-11 pedidos-contrato-api-y-categorias    [Agente C]
  → C-12 pagos-checkout-api-cardpayment       [Agente B — si C-05 ✓]

GATE 4: C-13a ✓ + C-02 ✓ + C-11 ✓  (inicio del frontend con datos)
  → C-13b fe-foundation-auth-data             [Agente C]
  → C-25a backend-capas-y-renombres           [Agente A — si C-01..C-12 ✓; independiente del frontend]

GATE 5: C-13b ✓                                         ← FORK
  → C-14 fe-auth-cuenta                       [Agente C]
  → C-16 fe-catalogo-publico                  [Agente C]
  → C-15 fe-direcciones                       [Agente B]
  → C-17a fe-admin-categorias-ingredientes    [Agente A — si C-08 ✓]; luego C-17b
  → C-22 fe-gestion-operativa-pedidos         [Agente B — si C-09, C-11 ✓]
  → C-23 fe-admin-usuarios-roles              [Agente A — si C-08 ✓]

GATE 6: C-16 ✓ → C-18 ; C-18 + C-15 + C-10 ✓ → C-19 ; C-19 ✓ →
  → C-20 fe-pago-mercadopago                  [Agente B — si C-12 ✓]
  → C-21 fe-mis-pedidos-seguimiento           [Agente C]
  → C-24 fe-dashboard-metricas                [Agente A — si C-22 ✓]

GATE 7: Fase 0 y Fase 1 ✓ (incl. C-25a) → C-25b entrega-docs-video (todos)
GATE 8 (opcional, al final y solo si sobra tiempo): parte COCINA/KDS de PA-07 y PA-19 resueltas → C-26, C-27, C-28
```

### Camino crítico (11 changes — mínimo irreducible)

`C-01 → C-06 → C-07 → C-09 → C-11 → C-13b → C-16 → C-18 → C-19 → C-20* → C-25b`

\* C-20 requiere además C-12 (rama paralela `C-05 → C-12`), que también debe estar completa antes de C-20. C-13b requiere además C-13a (que corre en paralelo con la Fase 0) y C-02. Los changes de seguridad (C-02, C-04, C-05) no están en el camino crítico pero tienen **prioridad de ejecución** por regla de Fase 0.

### Plan óptimo con 3 agentes

| Paso | Agente A (Backend Core: auth/pedidos) | Agente B (Backend Aux: pagos/datos) | Agente C (Frontend / datos) |
|------|--------------------------------------|-------------------------------------|-----------------------------|
| 1 | C-01 ✓ | — | — |
| 2 | C-03 | C-04 | C-06 ✓ |
| 3 | C-02 ✓ | C-05 | C-07 ✓ |
| 4 | C-08 ✓ | — | C-13a |
| 5 | C-09 | — | — |
| 6 | C-10 | C-12 | C-11 |
| 7 | C-25a | — | C-13b |
| 8 | C-17a | C-15 | C-14 + C-16 |
| 9 | C-17b | C-22 | C-18 |
| 10 | C-23 | C-24 | C-19 |
| 11 | — | C-20 | C-21 |
| 12 | C-25b | C-25b | C-25b |

(C-03 no bloquea nada y puede moverse a cualquier hueco del Agente A. C-13a no depende del backend: puede correr en cualquier hueco del Agente C desde ya. En el paso 8, C-17a y C-15 requieren C-13b: ajustar si C-13b aún no terminó. C-25a solo exige C-01..C-12: puede adelantarse o retrasarse según huecos, siempre antes de C-25b.)

---

## FASE 0 — Corrección de deuda técnica (spec = objetivo)

> Seguridad y pagos primero. Cada change agrupa filas de la tabla DT por dominio; ninguno es un change por fila. Tras C-01 se abren C-02, C-04 y C-06 en paralelo.
>
> **Punto de partida común (lo dejaron C-06 y C-02, cerrados):** el módulo de auth es `backend/app/modules/auth` (router, service, cookies) y las sesiones/refresh viven en `backend/app/modules/refreshtokens` (`Sesion`, `RefreshToken`). Los endpoints protegidos usan `Authorization: Bearer` con las dependencias de `backend/app/core/deps.py`: `get_access_claims` (claims validados del access: `usuario_id`, `sid`, `roles`; sin BD), `get_current_user`, `get_current_active_user` y `require_role([...])`. **Migraciones:** la cabeza actual es `002`; el change que cambie esquema agrega la siguiente a la cabeza vigente (no fijar el número por change). **Tests:** helpers con Bearer en `backend/tests/conftest.py` (`admin_auth_headers`, `user_auth_headers`) y `backend/tests/support/auth_helpers.py` (`iniciar_sesion`, `bearer`, etc.).

### [C-01] `baseline-backend`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-06-c-01-baseline-backend/`)
- **Scope**:
  - Incorporar el backend FastAPI base al repo y reubicarlo en la estructura de la spec bajo `backend/` (la raíz es solo gestión; código en `backend/` y `frontend/`, D9): `backend/app/main.py`, `backend/app/db/seed.py`, módulos feature-first (DT-09 parte de layout; DD-02).
  - Alinear variables de entorno: `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`, `VITE_API_URL`, `CORS_ORIGINS` (JSON); retirar `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL` (DT-22). `backend/.env.example`.
  - Auditar los permisos de productos, ingredientes y `cloudinary/service.py` y dejar nota en el change (PA-09).
  - Arrancar suite pytest baseline y fijar estrategia de BD de pruebas (Postgres vs SQLite, PA-10).
  - Tests: arranque de app, health, config por entorno.
- **Dependencias**: ninguna
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios, §Variables de entorno
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-09, DT-22, DD-01, DD-02)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-09, PA-10, PA-15)

### [C-02] `auth-sesion-tokens-bearer-refresh`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-10-c-02-auth-sesion-tokens-bearer-refresh/`)
- **Scope**:
  - Cubre DT-07, DT-11, DT-12.
  - Transporte del access token por `Authorization: Bearer`; la cookie HttpOnly pasa a ser el medio del refresh (PA-04 resuelta; `secure`/`samesite` configurables).
  - `GET /auth/me` (reemplaza `/usuarios/me` como contrato de sesión).
  - `POST /auth/refresh`: rotación del refresh token, hash SHA-256, uso de `revoked_at`; comparación de fechas aware vs naive corregida.
  - `POST /auth/logout`: revoca (marca `revoked_at`), no borra la fila; 204.
  - Registro con email duplicado devuelve 409 (no 403).
  - Tests: login/refresh/rotación, reuso de refresh revocado, logout efectivo, expiración, 409.
  - Renombrar los módulos `auth` y `refreshtokens` a los nombres de la estructura de la spec (se reescriben en este change).
  - Su migración es la siguiente después de la 001 de C-06 (`alembic revision --autogenerate --rev-id 002`). Toda FK nueva hacia `usuario.id` (por ejemplo `sesion.usuario_id`) es `BIGINT` (`sa_type=BigInteger`); el test de metadata de C-06 lo exige.
- **Dependencias**: `C-01, C-06`
- **Governance**: CRITICO
- **Nota para C-13b/C-14**: el frontend debe usar `withCredentials` hacia `/api/v1/auth` (el refresh viaja en cookie HttpOnly).
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Autenticación (RN-AU)
  - `knowledge-base/03_actores_y_roles.md`
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-08, DD-09, DT-07, DT-11, DT-12)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-04)

### [C-03] `auth-rate-limit-slowapi`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-10. Reemplazar middleware token-bucket propio por slowapi: 5 fallos / 15 min / IP únicamente en `POST /auth/login`; 429 con `Retry-After`.
  - Quitar límite en register/logout y el límite global de 60/min (el rate limit global queda como extra en C-28).
  - Punto de partida (C-02): el rate limit actual matchea por prefijo y alcanza a rutas de `/auth` nuevas (`/auth/logout-all`, `/auth/refresh`); con slowapi solo se limitan los **fallos** de `POST /auth/login`, y `/auth/refresh`, `/auth/logout`, `/auth/logout-all` y `/auth/me` quedan sin límite.
  - Tests: umbral de 5 fallos, ventana, reset tras login correcto, otras rutas sin límite (incluidas las de `/auth` nuevas).
- **Dependencias**: `C-01`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-12, DT-10)
  - `knowledge-base/05_reglas_de_negocio.md` §Autenticación (RN-AU-08)
  - `knowledge-base/08_arquitectura_propuesta.md` §Seguridad

### [C-04] `pagos-autorizacion-propietario`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-05. `POST /pagos/crear` y `GET /pagos/{pedido_id}` requieren autenticación y verifican propiedad del pedido (propietario o ADMIN); 401/403/404 según corresponda.
  - El webhook se mantiene público (se endurece en C-05).
  - Punto de partida (C-02): autenticar con Bearer vía `get_current_active_user` (`backend/app/core/deps.py`); tests con `user_auth_headers`/`admin_auth_headers`.
  - Tests: sin token, token de otro usuario, ADMIN, propietario.
- **Dependencias**: `C-01`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md` §Riesgos conocidos
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos (RN-PA)
  - `knowledge-base/03_actores_y_roles.md` §Rutas públicas
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-05)

### [C-05] `pagos-webhook-firma-idempotencia`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-06, DT-20, DT-21, DT-13.
  - Validar firma `x-signature` (+ `x-request-id`) del webhook de MercadoPago; rechazo si es inválida.
  - Idempotencia real por `idempotency_key` / id de pago MP (no solo `pago.estado != "pendiente"`).
  - Consistencia transaccional pago/pedido vía UoW: pago `aprobado` implica pedido CONFIRMADO; si falla no queda pago aprobado con pedido PENDIENTE y el webhook responde para que MP reintente.
  - Historial: la confirmación automática registra `usuario_id = NULL` (Sistema), no el dueño con rol ADMIN.
  - La confirmación automática pasa por la transición de la FSM (PENDIENTE→CONFIRMADO, DD-20): C-05 deja el **punto de extensión** para que el descuento de stock que define C-10 ocurra dentro de esa misma transacción. Una falla de negocio conocida (p. ej. «sin stock al confirmar») no hace reintentar a MP (el webhook responde 200); solo las fallas inesperadas o de consistencia provocan el reintento. El caso «pago aprobado sin stock» lo define C-10.
  - Tests: firma válida/inválida, reentrega duplicada, fallo a mitad de transacción, actor Sistema, falla de negocio conocida sin reintento.
- **Dependencias**: `C-04`
- **Governance**: CRITICO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-08]` reembolso / cancelación ante pago `cancelled` (fuera de este scope).
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md` (todo)
  - `knowledge-base/07_flujos_principales.md` §Webhook
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos (RN-PA-02..04), RN-PE-02, §Stock (RN-ST)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-07, DD-20, DT-06, DT-13, DT-20, DT-21)

### [C-06] `datos-migraciones-alembic`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-09-c-06-datos-migraciones-alembic/`)
- **Scope**:
  - Cubre DT-09 (parte datos). Inicializar `backend/alembic/`; migración 001 con el esquema completo actual (PK semántica `codigo`, `deleted_at/created_at/updated_at`, índices parciales `UniqueAuditableMixin`, `INTEGER[]` de personalización).
  - Quitar `SQLModel.metadata.create_all` del `lifespan` y del seed (los tests ya corren sobre PostgreSQL real desde C-01, PA-10 resuelta).
  - Verificar `alembic upgrade head` sobre BD vacía (CE-04).
  - Tests: upgrade/downgrade, esquema == modelos.
  - La fixture de tests (`backend/tests/conftest.py`, hoy `drop_all` + `create_all` sobre `foodstore_test`) debe pasar a `alembic upgrade head`.
  - Nota de cierre de scope (implementado): además de lo anterior, C-06 corrigió el esquema a la spec antes de generar la 001: fechas `TIMESTAMPTZ` en UTC (sesión fijada en UTC), unicidad parcial en `unidades_medida`, `usuario.id` y sus FK `BIGINT`, `categorias.parent_id` `ON DELETE SET NULL`, `ck_producto_stock_no_negativo` y `direccion_entrega.linea1` `TEXT`. `pagos.external_reference` queda para C-12 (DT-26).
- **Dependencias**: `C-01`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` (ERD y entidades)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-04, DD-05, DD-06, DD-15, DT-09)
  - `knowledge-base/13_rubrica_y_entrega.md` (CE-04)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-10, PA-15)

### [C-07] `datos-seed-y-catalogos`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-10-c-07-datos-seed-y-catalogos/`)
- **Scope**:
  - Cubre DT-23 y la parte de seed de DT-03. `backend/app/db/seed.py` idempotente: Roles (ADMIN, STOCK, PEDIDOS, CLIENT), EstadoPedido con 6 estados incl. `EN_CAMINO` y orden correcto (`CANCELADO` sin `orden=99`), FormaPago `MERCADOPAGO/EFECTIVO/TRANSFERENCIA` (no `TARJETA`), admin con `Admin1234!`.
  - Si hay cambios de catálogo/órdenes que requieran esquema, migración nueva: la siguiente a la cabeza vigente (hoy `002`; no fijar el número en el change).
  - Punto de partida (C-06): el seed ya no usa `create_all` (el esquema sale solo de migraciones); los tests corren sobre PostgreSQL real con `alembic upgrade head`.
  - Tests: seed idempotente (2 corridas), contenido exacto de catálogos.
- **Dependencias**: `C-06`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Seed data inicial
  - `knowledge-base/05_reglas_de_negocio.md` §FSM (RN-PE)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-03, DT-23)
  - `knowledge-base/06_funcionalidades.md` (US-029)

### [C-08] `rbac-multirol-permisos-stock`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-10-c-08-rbac-multirol-permisos-stock/`)
- **Scope**:
  - Cubre DT-14, DT-16. Autorización multi-rol: evaluar todos los roles del usuario (no `roles[0]`); eliminar `KeyError` para STOCK.
  - Además de `roles[0]`, revisar las dependencias de roles sobre los claims del access: `require_role` (en `backend/app/core/deps.py`) evalúa los roles cargados de la BD, mientras que el access lleva el claim `roles` (puede quedar desactualizado hasta 30 min); dejar escrito cuál es la fuente de autoridad y que ambas rutas sean coherentes.
  - Permisos STOCK: solo `stock`/`disponible` (`PATCH /productos/{id}/disponibilidad`) y lectura de ingredientes; categorías/ingredientes de escritura según matriz RBAC; auditar router de productos (PA-09).
  - Tests: matriz RBAC por rol y combinaciones multi-rol (helpers con Bearer de `conftest.py`/`auth_helpers.py`).
  - `COCINA` no se toca (Fase 2).
  - Insumo (auditoría PA-09 hecha en C-01, ver su `design.md`): STOCK no puede actualizar `stock_cantidad` (solo `PUT` ADMIN); `PATCH /{id}/disponibilidad` es un toggle sin body (no idempotente) en lugar de fijar el valor; la lectura pública de productos/ingredientes acepta `estado`/`include_deleted` y expone eliminados (RN-PR-03).
- **Dependencias**: `C-02`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/03_actores_y_roles.md` §Matriz RBAC
  - `knowledge-base/05_reglas_de_negocio.md` §Usuarios y Roles (RN-US), RN-PR
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-11, DT-14, DT-16)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-09)

### [C-09] `pedidos-fsm-en-camino`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-03 (FSM) y DT-15.
  - FSM de 6 estados: PENDIENTE→CONFIRMADO→EN_PREP→EN_CAMINO→ENTREGADO + CANCELADO; eliminar el atajo EN_PREP→ENTREGADO; `TRANSICIONES[rol][estado]` usando todos los roles del usuario (depende de C-08).
  - Historial append-only por cada transición (`created_at ASC`).
  - Confirmación (PA-06 resuelta, DD-22): CONFIRMADO automático por pago aprobado (actor Sistema) para `MERCADOPAGO`; la transición manual PENDIENTE→CONFIRMADO la pueden hacer **solo ADMIN o PEDIDOS** y **solo** para pedidos `EFECTIVO`/`TRANSFERENCIA`; un pedido `MERCADOPAGO` no se confirma a mano.
  - Despacho (PA-07, parte resuelta, DD-23): `EN_PREP→EN_CAMINO` y `EN_CAMINO→ENTREGADO` los hacen ADMIN y PEDIDOS. `COCINA` no se toca (Fase 2).
  - Toda transición a CONFIRMADO (automática o manual) pasa por un único punto de entrada de la FSM, para que C-10 enganche ahí el descuento atómico de stock.
  - Tests: cada transición válida/inválida por rol y forma de pago, historial, cancelación solo en PENDIENTE/CONFIRMADO con motivo.
  - Punto de partida (C-02): roles evaluados desde `get_current_active_user`/`require_role`; helpers de test con Bearer.
  - Punto de partida (C-07): el catálogo ya tiene `EN_CAMINO`(4) y `CANCELADO`(6); la fixture de tests usa `seed_catalogos`; `PATCH /estado` a `EN_CAMINO` responde 409 hasta que C-09 agregue las transiciones.
  - Punto de partida (C-08): `PedidoService.cambiar_estado_pedido`, `cancelar_pedido_propio` y `_validar_transicion` reciben `roles: AbstractSet[str]` y consultan `TRANSICIONES` con `union_por_roles` (`backend/app/core/permissions.py`); el contenido de `TRANSICIONES` quedó **intacto** (sigue ADMIN/PEDIDOS/CLIENT con 5 estados). Un rol sin fila (`COCINA`, `STOCK`) da 409, no 500. El webhook llama con `roles=frozenset({"ADMIN"})`. Tests: `tests/integration/test_pedidos_multirol.py` y la matriz `tests/support/rbac_matriz.py` (actualizar ahí las filas de pedidos).
- **Dependencias**: `C-07, C-08`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Pedidos y FSM (RN-PE)
  - `knowledge-base/07_flujos_principales.md` §Ciclo operativo
  - `knowledge-base/04_modelo_de_datos.md` (EstadoPedido, HistorialEstadoPedido)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-11, DD-22, DD-23, DT-03, DT-15)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-06, PA-07)

### [C-10] `pedidos-stock-descuento`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-04. Implementa el modelo de stock de PA-03 (DD-20): **verificar al crear, descontar al confirmar, devolver solo al cancelar un CONFIRMADO o posterior**.
  - Crear el pedido: solo verifica `disponible` y stock suficiente (errores claros: no disponible, sin stock); **no descuenta**.
  - Transición a CONFIRMADO (automática por webhook o manual de ADMIN/PEDIDOS): descuenta el stock de forma atómica dentro de la misma transacción de la transición.
  - Cancelar un PENDIENTE: no hay stock que devolver. Cancelar un CONFIRMADO o posterior: devuelve el stock. Sin TTL ni auto-cancelación de pedidos impagos.
  - Caso «pago aprobado sin stock» (dos pedidos pagan el último producto): el segundo pedido pasa a CANCELADO con motivo «sin stock» (actor Sistema, `usuario_id` NULL) y el pago queda marcado para devolución manual; la devolución automática sigue fuera de alcance (PA-08). El webhook responde 200 en ese caso (no es un error a reintentar).
  - Confirmación manual de un pedido `EFECTIVO`/`TRANSFERENCIA` sin stock suficiente: la transición se rechaza con error claro y el pedido sigue PENDIENTE.
  - Encapsulado en un único método/servicio de stock (`StockService`) invocado desde la transición de la FSM (el punto de entrada que deja C-09), de modo que ni el router ni el webhook toquen el stock directamente.
  - Tests: descuento al confirmar (auto y manual), no descuento al crear ni al cancelar PENDIENTE, devolución al cancelar CONFIRMADO+, «pago aprobado sin stock», rechazo de confirmación manual sin stock, **concurrencia** (dos pedidos sobre el último stock), atomicidad en UoW.
  - Punto de partida (C-08): `PATCH /productos/{id}/stock` (`{"stock_cantidad": n}`, seteo **absoluto**, ADMIN/STOCK) no bloquea la fila: al introducir el descuento atómico, decidir si el seteo manual usa `get_for_update` para no pisar un descuento concurrente (o si se pasa a delta).
- **Dependencias**: `C-09`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Stock (RN-ST), RN-PE-06, RN-PE-10
  - `knowledge-base/07_flujos_principales.md` §Compra y §Cancelación
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-20, DT-04, DD-16)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-08, PA-12)

### [C-11] `pedidos-contrato-api-y-categorias`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-17, DT-18, DT-19.
  - Contrato de pedidos: `PATCH /pedidos/{id}/estado` body `{nuevo_estado, motivo}`; `GET /pedidos/{id}` propietario/roles; `DELETE /pedidos/{id}` cancela el propio pedido (no soft delete solo-ADMIN); retirar `/mis-pedidos/...` y `estado_hacia` (o alias deprecado).
  - Paginación `page/size` → `{items,total,page,size,pages}` en todos los listados; errores `{detail, code, field}` en toda la API incl. 429.
  - Borrado de categoría: soft delete validando productos asociados e hijas (no re-asignar al abuelo sin validar).
  - Migración nueva (la siguiente a la cabeza vigente, hoy `002`) solo si cambia el esquema.
  - Punto de partida (C-02): `GET /auth/me` es el contrato de sesión; `GET`/`PATCH /usuarios/me` quedan como perfil (el `GET` duplicado se retira en C-14/C-25a).
  - Tests: contrato por endpoint, paginación, forma de errores, borrado con productos.
  - Punto de partida (C-08): las unicidades, el 409 y los `HTTPException` en services siguen pendientes (C-08 no los tocó); `GET /productos/{id}/ingredientes` y `DELETE /productos/{id}/ingredientes/{ing_id}` (spec §5.2, OQ-5) tienen a C-11 como dueño; actualizar en la matriz `tests/support/rbac_matriz.py` las filas con dueño C-11 (`GET /pedidos/{id}`, historial, `DELETE`).
- **Dependencias**: `C-09`
- **Governance**: MEDIO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-14]` estandarización de contrato (se asume la spec v5.0).
- **Leer antes**:
  - `knowledge-base/07_flujos_principales.md`
  - `knowledge-base/02_descripcion_general.md` §Resumen de API REST
  - `knowledge-base/05_reglas_de_negocio.md` §API y Datos transversales (RN-GL), RN-CA
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-17, DT-18, DT-19)

### [C-12] `pagos-checkout-api-cardpayment`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-01. Migrar de Checkout Pro (preferencia + `init_point`) a Checkout API/Orders con token de tarjeta (`CardPayment` brick): `POST /pagos/crear` recibe `token`, `payment_method_id`, `installments`, `issuer_id`; la tarjeta nunca toca el backend (SAQ-A); `X-Idempotency-Key`. PA-05 resuelta (DD-21): se hace como está planeado, sin Checkout Pro como etapa intermedia ni alternativa de redirect.
  - Reintento tras rechazo; `GET /pagos/{pedido_id}` con `mp_status_detail`.
  - Cubre DT-26: `pagos.external_reference` como UUID único y obligatorio (generado por el backend), con su migración (la siguiente a la cabeza vigente, hoy `002`).
  - Mantener el webhook de C-05 como confirmación.
  - Punto de partida (C-07): `TARJETA` quedó deshabilitada en el catálogo de formas de pago (no se siembra); la tarjeta es un medio dentro de `MERCADOPAGO`.
  - Tests con sandbox mockeado: aprobado, rechazado, pendiente, reintento.
  - Al retirar el redirect de Checkout Pro se eliminan `FRONTEND_URL` y `BACKEND_PUBLIC_URL` (opcionales, introducidas en C-01). El chequeo «MercadoPago no configurado» (503, formato uniforme `{detail, code, field}`) debe conservarse en el flujo nuevo.
- **Dependencias**: `C-05, C-09`
- **Governance**: CRITICO
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md` §Modalidades, §Flujo de cobro, §Sandbox
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos (RN-PA)
  - `knowledge-base/07_flujos_principales.md` §Compra
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-07, DD-21, DT-01)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-05)

---

## FASE 1 — Features por épica (sobre base corregida)

> El alcance incluye el frontend completo (PA-01 resuelta, DD-19; DT-24, SU-01). Los changes visuales deben tener mockup aprobado (Revision 1 del design system) antes de apply. El frontend consume el backend ya corregido en la Fase 0: autenticación por Bearer con refresh por cookie HttpOnly (`withCredentials` hacia `/api/v1/auth`).

### [C-13a] `fe-foundation-scaffold`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Proyecto Vite + React + TS (`strict`, sin `any`) + Tailwind en estructura FSD bajo `frontend/`; `VITE_API_URL`; importar `design-system/tokens.css`.
  - Router (sin guards todavía), layout base / shell y navegación, página de error/404.
  - Se agrega el servicio `frontend` al `docker-compose.yml` de la raíz si corresponde (hoy hay un comentario «se agrega en C-13a»).
  - Tests: arranque del shell y rutas básicas (Vitest + React Testing Library).
  - No depende del backend salvo C-01: puede correr en paralelo con la Fase 0.
- **Dependencias**: `C-01`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` layout/shell y navegación.
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios, §Estado del cliente (Zustand)
  - `knowledge-base/02_descripcion_general.md`
  - `knowledge-base/13_rubrica_y_entrega.md`
  - `design-system/README.md`

### [C-13b] `fe-foundation-auth-data`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cliente Axios con interceptor: `Authorization: Bearer`, ante 401 llama `POST /auth/refresh` con `withCredentials` (la cookie HttpOnly `refresh_token` viaja sola hacia `/api/v1/auth`), actualiza `authStore` y reintenta la petición original (US-003). El refresh nunca se lee ni se guarda desde JS.
  - 4 stores Zustand (`authStore`, `cartStore`, etc.); provider de TanStack Query; guards de rutas por rol; manejo de errores `{detail, code, field}`.
  - Rehidratación de sesión con `GET /auth/me` (contrato de sesión de C-02).
  - Tests: interceptor (refresh + reintento, un solo refresh concurrente), guards de ruta.
  - **Decisión a tomar en el propose**: la spec `[INT]` pide que `authStore` persista solo `accessToken`, mientras que C-02 (D3/PA-04) dejó escrito que el access vive solo en memoria. Hay que elegir y, si cambia, actualizar la KB (`knowledge-base/05` RN-AU-10, `08` §Seguridad, `10` IN-07).
  - Punto de partida (C-08): los roles para la UI se toman de `GET /auth/me` (el claim `roles` del access es informativo y no autoriza); las lecturas públicas (`GET /productos`, `/categorias`, `/ingredientes`, `/unidades-medida`) con un access inválido responden 401, así que el interceptor renueva y reintenta.
- **Dependencias**: `C-13a, C-02, C-11`
- **Governance**: ALTO
- **UI**: sin mockup propio (usa el shell aprobado de C-13a).
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (Zustand), §Seguridad
  - `knowledge-base/05_reglas_de_negocio.md` §Autenticación (RN-AU-05, RN-AU-10)
  - `knowledge-base/06_funcionalidades.md` (US-003)
  - `knowledge-base/10_preguntas_abiertas.md` (IN-07, PA-04)
  - `openspec/changes/archive/2026-11-10-c-02-auth-sesion-tokens-bearer-refresh/design.md` (D1, D3, D6)

### [C-14] `fe-auth-cuenta`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-001 registro, US-002 login (mensajes 401/409/429), US-004 logout, US-005 perfil propio (`GET/PATCH` perfil sin tocar roles).
  - Páginas `Login`, `Register`, `Perfil`; validación con TanStack Form.
  - Punto de partida (C-02): login por `POST /auth/login` (form OAuth2) que devuelve el access en el body y setea la cookie del refresh (requiere `withCredentials`); logout por `POST /auth/logout` y «cerrar todas las sesiones» por `POST /auth/logout-all` (Bearer, sin body, 204); usuario por `GET /auth/me`.
  - Tests: formularios y flujos de error.
- **Dependencias**: `C-13b`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` login, registro, perfil.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 1
  - `knowledge-base/05_reglas_de_negocio.md` §Autenticación, §Usuarios
  - `knowledge-base/07_flujos_principales.md` §Auth

### [C-15] `fe-direcciones`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-006: CRUD de direcciones propias, marcar principal (la primera queda principal) con TanStack Query.
  - Páginas y selector reutilizable para checkout.
  - Tests: CRUD, principal.
- **Dependencias**: `C-13b`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` listado/formulario de direcciones.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 2
  - `knowledge-base/05_reglas_de_negocio.md` §Direcciones (RN-DI)
  - `knowledge-base/04_modelo_de_datos.md` (DireccionEntrega)

### [C-16] `fe-catalogo-publico`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-007 explorar catálogo: filtros (categoría, nombre con debounce, precio, disponibilidad), paginación `page/size`, detalle con ingredientes/alérgenos y stock; skeleton y estados vacíos.
  - US-008 árbol de categorías (`GET /categorias/arbol`).
  - Tests: filtros, estados vacíos.
- **Dependencias**: `C-13b`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` catálogo, detalle de producto, navegación por categorías.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-007, US-008)
  - `knowledge-base/05_reglas_de_negocio.md` §Productos (RN-PR-03, RN-PR-04), RN-CA
  - `knowledge-base/07_flujos_principales.md` §Catálogo

### [C-17a] `fe-admin-categorias-ingredientes`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-009 categorías (nombre único, anti-ciclos), US-011 ingredientes y alérgenos (`es_alergeno`, `es_removible`).
  - Vistas condicionadas por rol (RBAC alineado con C-08).
  - Tests: permisos por rol en UI, CRUDs.
- **Dependencias**: `C-13b, C-08`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` pantallas de administración de categorías e ingredientes.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-009, US-011)
  - `knowledge-base/03_actores_y_roles.md` §Matriz RBAC
  - `knowledge-base/05_reglas_de_negocio.md` RN-CA, RN-PR
  - `knowledge-base/04_modelo_de_datos.md` (Categoria, Ingrediente)

### [C-17b] `fe-admin-productos-stock`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-010 productos (ADMIN/STOCK; `disponible` por PATCH), US-012 stock (rol STOCK limitado a stock/disponibilidad).
  - Vistas condicionadas por rol (RBAC alineado con C-08).
  - Imágenes y unidades de medida (US-013, US-014) quedan en C-28.
  - Tests: permisos por rol en UI, CRUD de productos, actualización de stock/disponibilidad.
  - Punto de partida (C-08): contratos de inventario: `PATCH /productos/{id}/disponibilidad` con body `{"disponible": bool}` (idempotente) y `PATCH /productos/{id}/stock` con `{"stock_cantidad": int>=0}` (absoluto), ambos ADMIN/STOCK; STOCK ve productos no disponibles pero no eliminados.
- **Dependencias**: `C-17a, C-08`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` pantallas de administración de productos y stock.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-010, US-012)
  - `knowledge-base/03_actores_y_roles.md` §Matriz RBAC
  - `knowledge-base/05_reglas_de_negocio.md` RN-PR, §Stock (RN-ST)
  - `knowledge-base/04_modelo_de_datos.md` (Producto)

### [C-18] `fe-carrito-personalizacion`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-015 carrito persistente en localStorage (sobrevive refresh, cierre y logout/login, CE-14), suscripción por slice a `cartStore`.
  - US-016 personalizar producto: excluir ingredientes removibles (`personalizacion` = IDs).
  - Tests: persistencia, personalización, totales.
- **Dependencias**: `C-16`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` drawer/página de carrito y selector de personalización.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 4 (US-015, US-016)
  - `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (Zustand)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-03, DD-05)

### [C-19] `fe-checkout-pedido`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-017: elegir dirección (o retiro en local) y forma de pago; crear pedido PENDIENTE en una transacción; manejo de errores (no disponible, sin stock, forma de pago deshabilitada, líneas duplicadas).
  - Mensajes de stock según DD-20: al crear solo se **verifica** disponibilidad y stock (el stock se descuenta recién al confirmarse el pedido); si el producto se agota antes de pagar, el cliente lo ve al intentar pagar o al cancelarse el pedido por «sin stock».
  - Pasos para `EFECTIVO`/`TRANSFERENCIA` (DD-22): el pedido queda PENDIENTE hasta que ADMIN/PEDIDOS lo confirmen a mano; la pantalla debe explicar al cliente que la confirmación es manual y no mostrar el formulario de tarjeta.
  - Costo de envío / descuento según DD-10 (50.00 / 0) hasta resolver PA-11/PA-13.
  - Tests: éxito, cada error, EFECTIVO/TRANSFERENCIA.
- **Dependencias**: `C-18, C-15, C-10, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` flujo de checkout.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-017
  - `knowledge-base/07_flujos_principales.md` §Compra
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-06, RN-PE-09, RN-ST
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-06, PA-11, PA-13)

### [C-20] `fe-pago-mercadopago`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-024 pago con `CardPayment` brick (PA-05 resuelta, DD-21: sin alternativa de redirect a Checkout Pro), reintento tras rechazo; US-025 reflejo de la confirmación por webhook (polling del estado); US-026 estado de pago con `mp_status_detail`.
  - Pantallas de éxito/pendiente/rechazo; incluir el caso «pago aprobado pero pedido cancelado por falta de stock» (DD-20).
  - Tests: aprobado, rechazado, reintento (MP mockeado).
- **Dependencias**: `C-19, C-12`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` pantalla de pago y resultados.
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md`
  - `knowledge-base/06_funcionalidades.md` Épica 6
  - `knowledge-base/07_flujos_principales.md` §Webhook
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos

### [C-21] `fe-mis-pedidos-seguimiento`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-018 listado paginado y detalle propio (snapshots, totales), timeline de estados con polling 30 s (WebSocket queda en C-27).
  - US-019 cancelar mi pedido (solo PENDIENTE/CONFIRMADO, motivo obligatorio).
  - Tests: timeline, cancelación.
- **Dependencias**: `C-19, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` mis pedidos, detalle y timeline.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-018, US-019
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-07, RN-PE-10, RN-ST-02
  - `knowledge-base/07_flujos_principales.md` §Cancelación

### [C-22] `fe-gestion-operativa-pedidos`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-020 avanzar estado (PEDIDOS/ADMIN) con motivo/observación, incluye EN_CAMINO (despachado por ADMIN/PEDIDOS, DD-23); US-021 todos los pedidos con filtros estado/fecha e historial; US-022 cancelar/eliminar (ADMIN/PEDIDOS).
  - Confirmación manual PENDIENTE→CONFIRMADO visible solo para pedidos `EFECTIVO`/`TRANSFERENCIA` (DD-22), con el error de «sin stock» si el backend la rechaza (DD-20).
  - Acciones visibles según FSM, rol y forma de pago.
  - Tests: botones según estado/rol/forma de pago, historial.
- **Dependencias**: `C-13b, C-09, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` tablero de gestión de pedidos.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 5 (US-020..US-022)
  - `knowledge-base/05_reglas_de_negocio.md` §Pedidos y FSM (RN-PE)
  - `knowledge-base/07_flujos_principales.md` §Ciclo operativo

### [C-23] `fe-admin-usuarios-roles`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-027 ADMIN: crear usuario con roles (multi-rol), listar paginado con filtro por rol, actualizar roles, desactivar (soft delete).
  - Tests: asignación multi-rol, filtros.
- **Dependencias**: `C-13b, C-08`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` administración de usuarios.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-027
  - `knowledge-base/05_reglas_de_negocio.md` §Usuarios y Roles (RN-US-01..03)
  - `knowledge-base/03_actores_y_roles.md`

### [C-24] `fe-dashboard-metricas`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-028 (ADMIN): KPIs (ventas, ticket promedio, pedidos activos, ingresos), ventas por período, top productos, pedidos por estado, ingresos por forma de pago con recharts.
  - Verificar endpoints de estadísticas actuales y ajustarlos al contrato (page/size, errores).
  - Tests: endpoints de métricas y render de gráficos.
- **Dependencias**: `C-22`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` dashboard.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-028
  - `knowledge-base/07_flujos_principales.md` §Dashboard
  - `knowledge-base/02_descripcion_general.md`

### [C-25a] `backend-capas-y-renombres`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - DT-25 (capas): sacar `Session`/`get_session` de los routers de `categorias`, `ingredientes`, `pagos`, `pedidos` y `productos` (delegar al service) y cortar la dependencia `core/deps.py` → `modules/`; si un change anterior toca alguno de esos routers, lo corrige ahí.
  - Incluye la sugerencia pendiente del verify de C-02: mover `UsuarioServiceDep` fuera de `usuarios/router.py`.
  - Renombrar `direcciones_entrega` → `direcciones`, `admin`, `core/unit_of_work.py` → `core/uow.py` y el resto de los módulos a la estructura objetivo de la spec (`knowledge-base/08` §Estructura).
  - Cobertura pytest > 60% (auth, pedidos, pagos, categorías, direcciones, ingredientes, productos, estadísticas); prueba end-to-end del flujo compra→pago→entrega a nivel API.
  - Es solo backend: puede correr en paralelo con el frontend; se cierra antes de `C-25b`.
- **Dependencias**: `C-01 a C-12`
- **Governance**: MEDIO
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estructura de directorios, §Testing
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-25)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-10, PA-16)

### [C-25b] `entrega-docs-video`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-029 seed/arranque reproducible (`alembic upgrade head` + seed + dev), US-030 Swagger `/docs`, README con setup, `.env.example` final, `docker-compose` para BD y frontend.
  - Prueba end-to-end del flujo completo (frontend incluido): compra→pago→entrega.
  - Checklist de entrega de la rúbrica de 200 pts; capturas de las 10 pantallas; video de la entrega; metadatos faltantes (PA-18); deploy opcional (PA-17).
  - Verificación visual contra mockups aprobados.
- **Dependencias**: `C-01 a C-24, C-25a`
- **Governance**: MEDIO
- **Decisión pendiente**: PA-16, PA-17, PA-18
- **Leer antes**:
  - `knowledge-base/13_rubrica_y_entrega.md`
  - `knowledge-base/06_funcionalidades.md` Épica 8
  - `knowledge-base/10_preguntas_abiertas.md` (PA-16, PA-17, PA-18)

---

## FASE 2 — Extras fuera de la spec `[OPCIONAL/BLOQUEADO]`

> Quedan para el final (se decide si sobra tiempo). No iniciar hasta resolver la parte abierta de **PA-07** (rol COCINA/KDS: ¿se incorpora a la spec o se elimina?; el despacho de `EN_CAMINO` ya está resuelto: ADMIN/PEDIDOS) y **PA-19** (extras del código: ¿formalizar o descartar?). Si se descartan, estos changes pasan a "eliminar el extra del código" en lugar de construirse. Mientras tanto no se tocan ni se eliminan `COCINA`, el KDS ni el WebSocket.

### [C-26] `rol-cocina-kds`
- **Estado**: `[ ]` pendiente `[OPCIONAL/BLOQUEADO: PA-07, PA-19]`
- **Scope**:
  - Cubre DT-02 y US-023. Según decisión: (a) formalizar rol `COCINA` (seed, `require_role`, permisos de FSM CONFIRMADO→EN_PREP, `GET /pedidos/cocina/pedidos`) y pantalla KDS; o (b) retirar `COCINA` del código y reasignar.
  - Tests según la opción elegida.
  - Punto de partida (C-08): `COCINA` sigue habilitado en `require_role` de `PATCH /pedidos/{id}/estado` y `GET /pedidos/cocina/pedidos`; como `TRANSICIONES` no tiene fila `COCINA`, hoy recibe 409 en `/estado`.
- **Dependencias**: `C-09, C-08` (y `C-27` para vista en vivo)
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` pantalla KDS (solo opción a).
- **Leer antes**:
  - `knowledge-base/12_tiempo_real_websocket.md`
  - `knowledge-base/03_actores_y_roles.md`
  - `knowledge-base/06_funcionalidades.md` US-023
  - `knowledge-base/10_preguntas_abiertas.md` (PA-07, PA-19)

### [C-27] `websocket-tiempo-real`
- **Estado**: `[ ]` pendiente `[OPCIONAL/BLOQUEADO: PA-19]`
- **Scope**:
  - Cubre DT-08. Corregir `await manager.disconnect(...)` sobre método síncrono; rooms por rol/pedido; autenticación del handshake; notificación de cambios de estado.
  - Reemplazar el polling de 30 s en C-21/C-22 si se aprueba.
  - Autenticar el handshake con el access (Bearer/`sid`): los endpoints WS de `pedidos/router.py` leen la cookie `access_token`, que C-02 dejó de emitir, así que hoy no se pueden autenticar (roto desde C-02).
  - Tests: conexión, disconnect, rooms, autorización.
  - Punto de partida (C-08): el único `roles[0]` que queda en el backend es el handler WebSocket `websocket_endpoint` (`/cocina/ws`) de `pedidos/router.py`; los permisos del resto se evalúan con la unión de roles.
- **Dependencias**: `C-09, C-02`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/12_tiempo_real_websocket.md`
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-13, DT-08)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-19)

### [C-28] `extras-cloudinary-unidades-ratelimit-global`
- **Estado**: `[ ]` pendiente `[OPCIONAL/BLOQUEADO: PA-19]`
- **Scope**:
  - US-013 subida/eliminación de imágenes en Cloudinary (`imagen_url` + `public_id`), US-014 CRUD de unidades de medida, US-031 rate limit general (token bucket, `X-RateLimit-*`), módulo de estadísticas extendido.
  - Solo si PA-19 los formaliza; si no, retirar del código.
  - Tests: upload mock, CRUD unidades, headers de rate limit.
  - La configuración perezosa y opcional de Cloudinary ya se resolvió en C-01 (D8: sin `CLOUDINARY_*` la app arranca, subir = 503, borrar = no-op). Queda pendiente sacar el `HTTPException` del servicio core (auditoría PA-09, punto 7).
- **Dependencias**: `C-17b, C-03`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` carga de imágenes y gestión de unidades (frontend).
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-013, US-014, US-031
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-12, DD-14)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-19)

---

## Resumen

| Fase | Changes | Rango | Notas |
|------|---------|-------|-------|
| 0 — Deuda técnica | 12 | C-01..C-12 | Cubre DT-01, 03..07, 09..23, 26 (DT-02 y DT-08 en Fase 2; DT-24 en Fase 1; DT-25 en C-25a) |
| 1 — Features | 16 | C-13a, C-13b, C-14..C-16, C-17a, C-17b, C-18..C-24, C-25a, C-25b | Frontend completo (PA-01 resuelta); changes `[UI-MOCKUP]` (13): C-13a, C-14, C-15, C-16, C-17a, C-17b, C-18..C-24 |
| 2 — Extras | 3 | C-26..C-28 | Opcional/bloqueado por la parte COCINA/KDS de PA-07 y por PA-19; al final |

**Total: 31 changes** (28 originales; C-13, C-17 y C-25 partidos en dos). **Cerrados: 5** (C-01, C-02, C-06, C-07, C-08). **Pendientes obligatorios: 23** (7 de Fase 0 + 16 de Fase 1) y 3 opcionales de Fase 2.

Governance CRITICO: C-02, C-04, C-05, C-08, C-12, C-14, C-20, C-23. ALTO: C-03, C-06, C-07, C-09, C-10, C-13b, C-27.

**Primer change recomendado**: `C-01` (`baseline-backend`) ✓ → siguiente: C-09 `pedidos-fsm-en-camino` (desbloqueado por C-07 ✓ y C-08 ✓), en paralelo con C-04, C-03 y C-13a; C-05 después de C-04.
