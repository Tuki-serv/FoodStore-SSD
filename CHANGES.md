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
- `[UI-MOCKUP]` = change visual: requiere mockup aprobado antes de apply (política `system-and-mockups`, design system Revision 2 aprobado en `design-system/README.md`). Registrar `## UI Mockups` en el `design.md` del change.
- `[PENDIENTE DE DECISIÓN: PA-xx]` = el orden o scope puede cambiar según una pregunta abierta que sigue abierta (hoy PA-08, PA-14); **no bloquea** el roadmap (se implementa con el supuesto indicado y se ajusta).
- `[OPCIONAL/BLOQUEADO]` = Fase 2; no iniciar hasta resolver la parte abierta de PA-07 (COCINA/KDS) y PA-19.
- Los sufijos `a`/`b` (`C-13a`, `C-13b`, `C-16a`, `C-16b`, `C-17a`, `C-17b`, `C-20a`, `C-20b`, `C-25a`, `C-25b`) parten un change en dos sin renumerar el resto.

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
 ├── C-03 ✓ auth-rate-limit-slowapi
 ├── C-04 ✓ pagos-autorizacion-propietario
 │     └── C-05 ✓ pagos-webhook-firma-idempotencia ──┐
 └── C-06 ✓ datos-migraciones-alembic              │
       ├── C-02 ✓ auth-sesion-tokens-bearer-refresh┼─┬── C-08 ✓ rbac-multirol-permisos-stock
       │                                           │ └── C-13b ✓ fe-foundation-auth-data (también C-13a, C-11)
       └── C-07 ✓ datos-seed-y-catalogos           │
             └── C-09 ✓ pedidos-fsm-en-camino  (+C-08)
                   ├── C-10 ✓ pedidos-stock-descuento
                   ├── C-11 ✓ pedidos-contrato-api-y-categorias
                   └── C-12 ✓ pagos-checkout-api-cardpayment (+C-05)

FASE 1 (frontend sobre base corregida)
C-13a ✓ fe-foundation-scaffold (solo C-01; corre en paralelo con la Fase 0)
 └── C-13b ✓ fe-foundation-auth-data (C-13a, C-02, C-11)
       ├── C-14 ✓ fe-auth-cuenta
       ├── C-15 ✓ fe-direcciones
       ├── C-16b ✓ fe-catalogo-publico (+C-16a)
       │     └── C-18 ✓ fe-carrito-personalizacion
       │           └── C-19 ✓ fe-checkout-pedido (+C-10, C-11, C-15)
       │                 ├── C-20a ✓ fe-pago-tarjeta (+C-12)
       │                 │     └── C-20b ✓ fe-pago-seguimiento
       │                 └── C-21 ✓ fe-mis-pedidos-seguimiento (+C-11)
       ├── C-17a ✓ fe-admin-categorias-ingredientes (+C-08)
       │     └── C-17b ✓ fe-admin-productos-stock (+C-08)
       ├── C-22 ✓ fe-gestion-operativa-pedidos (+C-09, C-11)
       │     └── C-24 ✓ fe-dashboard-metricas
       └── C-23 ✓ fe-admin-usuarios-roles (+C-08)
C-25a ✓ backend-capas-y-renombres (C-01..C-12; en paralelo con el frontend)
 └── C-16a ✓ backend-catalogo-filtros (C-08, C-11, C-25a; backend, en paralelo con el frontend; antes de C-16b)
C-25b entrega-docs-video (todo lo anterior)

FASE 2 (opcional/bloqueado: COCINA/KDS de PA-07, PA-19)
C-26 rol-cocina-kds (C-09, C-08) ── C-27 websocket-tiempo-real (C-09, C-02) ── C-28 extras-cloudinary-unidades-ratelimit-global (C-17b, C-03)
```

### Paralelismo por fase

```
GATE 0: C-01 ✓                                          ← FORK
  → C-04 ✓ pagos-autorizacion-propietario    [Agente B — CRITICO]
  → C-06 ✓ datos-migraciones-alembic          [Agente C]
  → C-03 ✓ auth-rate-limit-slowapi           [Agente A, en paralelo a C-06]
  → C-13a ✓ fe-foundation-scaffold            [Agente C — sin dependencia de backend; puede ir en cualquier hueco]

GATE 1: C-04 ✓ / C-06 ✓
  → C-02 ✓ auth-sesion-tokens-bearer-refresh [Agente A — CRITICO, tras C-06]
  → C-05 ✓ pagos-webhook-firma-idempotencia   [Agente B — si C-04 ✓]
  → C-07 ✓ datos-seed-y-catalogos             [Agente C — si C-06 ✓]

GATE 1b: C-02 ✓
  → C-08 ✓ rbac-multirol-permisos-stock         [Agente A — si C-02 ✓]

GATE 2: C-07 ✓ + C-08 ✓
  → C-09 ✓ pedidos-fsm-en-camino                [Agente A]

GATE 3: C-09 ✓                                          ← FORK
  → C-10 ✓ pedidos-stock-descuento              [Agente A]
  → C-11 ✓ pedidos-contrato-api-y-categorias    [Agente C]
  → C-12 ✓ pagos-checkout-api-cardpayment     [Agente B — si C-05 ✓]

GATE 4: C-13a ✓ + C-02 ✓ + C-11 ✓  (inicio del frontend con datos)
  → C-13b ✓ fe-foundation-auth-data           [Agente C]
  → C-25a ✓ backend-capas-y-renombres        [Agente A — si C-01..C-12 ✓; independiente del frontend]
  → C-16a ✓ backend-catalogo-filtros          [Agente A — si C-11 ✓ y C-25a ✓ (ya desbloqueado); independiente de C-13b]

GATE 5: C-13b ✓                                         ← FORK
  → C-14 ✓ fe-auth-cuenta                     [Agente C]
  → C-16b ✓ fe-catalogo-publico               [Agente C — si C-16a ✓]
  → C-15 ✓ fe-direcciones                     [Agente B]
  → C-17a ✓ fe-admin-categorias-ingredientes    [Agente A — si C-08 ✓]; luego C-17b ✓
  → C-22 ✓ fe-gestion-operativa-pedidos         [Agente B — si C-09, C-11 ✓]
  → C-23 ✓ fe-admin-usuarios-roles           [Agente A — si C-08 ✓]

GATE 6: C-16b ✓ → C-18 ; C-18 + C-15 + C-10 ✓ → C-19 ; C-19 ✓ →
  → C-20a ✓ fe-pago-tarjeta                     [Agente B — si C-12 ✓]; luego C-20b ✓ fe-pago-seguimiento
  → C-21 ✓ fe-mis-pedidos-seguimiento           [Agente C]
  → C-24 ✓ fe-dashboard-metricas               [Agente A — si C-22 ✓]

GATE 7: Fase 0 y Fase 1 ✓ (incl. C-25a) → C-25b entrega-docs-video (todos)
GATE 8 (opcional, al final y solo si sobra tiempo): parte COCINA/KDS de PA-07 y PA-19 resueltas → C-26, C-27, C-28
```

### Camino crítico (12 changes — mínimo irreducible)

`C-01 → C-06 → C-07 → C-09 → C-11 → C-13b → C-16b → C-18 → C-19 → C-20a* → C-20b → C-25b`

\* C-20a requiere además C-12 (rama paralela `C-05 → C-12`), que también debe estar completa antes de C-20a; C-20b depende solo de C-20a. C-13b requiere además C-13a (que corre en paralelo con la Fase 0) y C-02. C-16b requiere además C-16a (backend de filtros del catálogo; depende de C-11 y C-25a y corre en paralelo con C-13b/C-14/C-15). Los changes de seguridad (C-02, C-04, C-05) no están en el camino crítico pero tienen **prioridad de ejecución** por regla de Fase 0.

### Plan óptimo con 3 agentes

| Paso | Agente A (Backend Core: auth/pedidos) | Agente B (Backend Aux: pagos/datos) | Agente C (Frontend / datos) |
|------|--------------------------------------|-------------------------------------|-----------------------------|
| 1 | C-01 ✓ | — | — |
| 2 | C-03 ✓ | C-04 ✓ | C-06 ✓ |
| 3 | C-02 ✓ | C-05 ✓ | C-07 ✓ |
| 4 | C-08 ✓ | — | C-13a ✓ |
| 5 | C-09 ✓ | — | — |
| 6 | C-10 ✓ | C-12 ✓ | C-11 ✓ |
| 7 | C-25a ✓ | — | C-13b ✓ |
| 8 | C-16a ✓ → C-17a ✓ | C-15 ✓ | C-14 ✓ + C-16b ✓ |
| 9 | C-17b ✓ | C-22 ✓ | C-18 ✓ |
| 10 | C-23 ✓ | C-24 ✓ | C-19 ✓ |
| 11 | — | C-20a ✓ → C-20b ✓ | C-21 ✓ |
| 12 | C-25b | C-25b | C-25b |

(C-03 no bloquea nada y puede moverse a cualquier hueco del Agente A. C-13a no depende del backend: puede correr en cualquier hueco del Agente C desde ya. En el paso 8, C-17a y C-15 requieren C-13b: ajustar si C-13b aún no terminó. C-16b requiere C-16a: el Agente A hace C-16a primero en el paso 8 (es corto, solo backend) y el Agente C arranca C-14 mientras tanto. C-25a solo exige C-01..C-12: puede adelantarse o retrasarse según huecos, siempre antes de C-25b.)

---

## FASE 0 — Corrección de deuda técnica (spec = objetivo)

> Seguridad y pagos primero. Cada change agrupa filas de la tabla DT por dominio; ninguno es un change por fila. Tras C-01 se abren C-02, C-04 y C-06 en paralelo.
>
> **Punto de partida común (lo dejaron C-06 y C-02, cerrados):** el módulo de auth es `backend/app/modules/auth` (router, service, cookies) y las sesiones/refresh viven en `backend/app/modules/refreshtokens` (`Sesion`, `RefreshToken`). Los endpoints protegidos usan `Authorization: Bearer` con las dependencias de `backend/app/core/deps.py`: `get_access_claims` (claims validados del access: `usuario_id`, `sid`, `roles`; sin BD), `get_current_user`, `get_current_active_user` y `require_role([...])`. **Migraciones:** la cabeza actual es `002`; el change que cambie esquema agrega la siguiente a la cabeza vigente (no fijar el número por change). **Tests:** helpers con Bearer en `backend/tests/conftest.py` (`admin_auth_headers`, `user_auth_headers`) y `backend/tests/support/auth_helpers.py` (`iniciar_sesion`, `bearer`, etc.).

### [C-01] `baseline-backend`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-06-c-01-baseline-backend/`)
- **Scope**:
  - Incorporar el backend FastAPI base al repo y reubicarlo en la estructura de la spec bajo `backend/` (la raíz es solo gestión; código en `backend/` y `frontend/`, D9): `backend/app/main.py`, `backend/app/db/seed.py`, módulos feature-first (DT-09 parte de layout; DD-02).
  - Alinear variables de entorno: `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL` (retirada después por C-12, revisión Orders), `VITE_API_URL`, `CORS_ORIGINS` (JSON); retirar `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL` (DT-22). `backend/.env.example`.
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
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-03-auth-rate-limit-slowapi/`)
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
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-04-pagos-autorizacion-propietario/`)
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
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-05-pagos-webhook-firma-idempotencia/`)
- **Scope**:
  - Cubre DT-06, DT-20, DT-21, DT-13.
  - Validar firma `x-signature` (+ `x-request-id`) del webhook de MercadoPago; rechazo si es inválida.
  - Idempotencia real por `idempotency_key` / id de pago MP (no solo `pago.estado != "pendiente"`).
  - Consistencia transaccional pago/pedido vía UoW: pago `aprobado` implica pedido CONFIRMADO; si falla no queda pago aprobado con pedido PENDIENTE y el webhook responde para que MP reintente.
  - Historial: la confirmación automática registra `usuario_id = NULL` (Sistema), no el dueño con rol ADMIN.
  - La confirmación automática pasa por la transición de la FSM (PENDIENTE→CONFIRMADO, DD-20): C-05 deja el **punto de extensión** para que el descuento de stock que define C-10 ocurra dentro de esa misma transacción. Una falla de negocio conocida (p. ej. «sin stock al confirmar») no hace reintentar a MP (el webhook responde 200); solo las fallas inesperadas o de consistencia provocan el reintento. El caso «pago aprobado sin stock» lo define C-10.
  - Tests: firma válida/inválida, reentrega duplicada, fallo a mitad de transacción, actor Sistema, falla de negocio conocida sin reintento.
  - Punto de partida (C-09): el actor Sistema ya está implementado (`PedidoService.confirmar_por_pago_aprobado`, `usuario_id` NULL, solo `MERCADOPAGO` en `PENDIENTE`; DT-13 resuelta en su parte de actor). Quedan firma, idempotencia y consistencia transaccional; el webhook sigue tragando el 409 de la FSM.
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
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-09-pedidos-fsm-en-camino/`)
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
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-10-pedidos-stock-descuento/`)
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
  - Punto de partida (C-09): `PedidoService(uow, al_confirmar=...)` con `PasoConfirmacion = Callable[[PedidoUnitOfWork, Pedido], None]` se invoca dentro del mismo UoW de la transición, antes del historial; conectarlo en `construir_pedido_service(session)` (`pedidos/service.py`). La restauración de stock al cancelar sigue en `PedidoService._transicionar` y la reemplaza C-10.
- **Dependencias**: `C-09`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Stock (RN-ST), RN-PE-06, RN-PE-10
  - `knowledge-base/07_flujos_principales.md` §Compra y §Cancelación
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-20, DT-04, DD-16)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-08, PA-12)

### [C-11] `pedidos-contrato-api-y-categorias`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-11-c-11-pedidos-contrato-api-y-categorias/`)
- **Scope**:
  - Cubre DT-17, DT-18, DT-19.
  - Contrato de pedidos: `PATCH /pedidos/{id}/estado` body `{nuevo_estado, motivo}`; `GET /pedidos/{id}` propietario/roles; `DELETE /pedidos/{id}` cancela el propio pedido (no soft delete solo-ADMIN); retirar `/mis-pedidos/...` y `estado_hacia` (o alias deprecado).
  - Paginación `page/size` → `{items,total,page,size,pages}` en todos los listados; errores `{detail, code, field}` en toda la API incl. 429.
  - Borrado de categoría: soft delete validando productos asociados e hijas (no re-asignar al abuelo sin validar).
  - Migración nueva (la siguiente a la cabeza vigente, hoy `002`) solo si cambia el esquema.
  - Punto de partida (C-02): `GET /auth/me` es el contrato de sesión; `GET`/`PATCH /usuarios/me` quedan como perfil (el `GET` duplicado se retiró en C-14: hoy solo existe el `PATCH`).
  - Tests: contrato por endpoint, paginación, forma de errores, borrado con productos.
  - Punto de partida (C-08): las unicidades, el 409 y los `HTTPException` en services siguen pendientes (C-08 no los tocó); `GET /productos/{id}/ingredientes` y `DELETE /productos/{id}/ingredientes/{ing_id}` (spec §5.2, OQ-5) tienen a C-11 como dueño; actualizar en la matriz `tests/support/rbac_matriz.py` las filas con dueño C-11 (`GET /pedidos/{id}`, historial, `DELETE`).
  - Punto de partida (C-09): el contrato `{nuevo_estado}` y el `DELETE` propio deben delegar en los mismos métodos del service (`cambiar_estado_pedido`/`cancelar_pedido_propio` → `_transicionar`); no reimplementar la FSM en el router.
- **Dependencias**: `C-09`
- **Governance**: MEDIO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-14]` estandarización de contrato (se asume la spec v5.0).
- **Leer antes**:
  - `knowledge-base/07_flujos_principales.md`
  - `knowledge-base/02_descripcion_general.md` §Resumen de API REST
  - `knowledge-base/05_reglas_de_negocio.md` §API y Datos transversales (RN-GL), RN-CA
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-17, DT-18, DT-19)

### [C-12] `pagos-checkout-api-cardpayment`
- **Estado**: `[x]` cerrado (2026-11-17). Implementado sobre la Orders API de MercadoPago (DD-26) tras comprobar en sandbox que `/v1/payments` responde 401 con las credenciales de prueba. Verify: PASS WITH FINDINGS, sin blocker ni major; los menores se derivaron a C-20 y C-25a (ver «Heredado de C-12»). Sandbox manual: aprobado, fondos insuficientes, reintento y webhook firmado comprobados; `OTHE`, `CONT` y clave de idempotencia repetida (OQ-14) no se ejecutaron.
- **Scope**:
  - Cubre DT-01. Migrar de Checkout Pro (preferencia + `init_point`) a Checkout API con token de tarjeta (`CardPayment` brick), implementada sobre la **Orders API** (`POST /v1/orders`, `sdk.order()`; revisión 2026-11-15, DD-26): `POST /pagos/crear` recibe `token`, `payment_method_id`, `payment_type_id`, `installments`, `issuer_id` (aceptado, no reenviado); la tarjeta nunca toca el backend (SAQ-A); `X-Idempotency-Key`; credenciales rechazadas por MercadoPago → 503. PA-05 resuelta (DD-21): se hace como está planeado, sin Checkout Pro como etapa intermedia ni alternativa de redirect.
  - Reintento tras rechazo; `GET /pagos/{pedido_id}` con `mp_status_detail`.
  - Cubre DT-26: `pagos.external_reference` como UUID único y obligatorio (generado por el backend), con su migración (la siguiente a la cabeza vigente, hoy `002`; la revisión Orders suma la `004`: `mp_order_id`, `mp_payment_id` como texto, sin `mp_merchant_order_id`).
  - Mantener el webhook de C-05 como confirmación, ahora por el tópico `order` (evento «Order (Mercado Pago)») con consulta `GET /v1/orders/{id}`; se retira `MP_NOTIFICATION_URL` (la URL del webhook se configura solo en el panel de MercadoPago).
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

> El alcance incluye el frontend completo (PA-01 resuelta, DD-19; DT-24, SU-01). Los changes visuales deben tener mockup aprobado (Revision 2 del design system, con panel lateral DD-25) antes de apply. El frontend consume el backend ya corregido en la Fase 0: autenticación por Bearer con refresh por cookie HttpOnly (`withCredentials` hacia `/api/v1/auth`).

### [C-13a] `fe-foundation-scaffold`
- **Estado**: `[x]` cerrado (2026-11-15). Verify: PASS WITH FINDINGS; las 3 de prioridad major se corrigieron en el mismo change, las menores se derivaron a C-13b, C-18 y C-25b (ver «Heredado de C-13a» en cada uno). Los mockups se aplicaron sin revisión previa (a pedido del usuario) y el usuario los aprobó después, el 2026-11-15. Las secciones del rol `STOCK` en el panel (OQ-2) las confirmó el usuario el 2026-11-15 (DD-25).
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
- **Estado**: `[x]` cerrado (2026-11-17). Verify: PASS WITH FINDINGS; los 4 menores (race de renovación tras logout, test sin rastro en storage, casos de open-redirect, nota de logout con backend caído) se corrigieron en el mismo change. Verify visual: passed con el backend real (capturas en el change archivado, `mockups/verify/`).
- **Scope**:
  - Cliente Axios con interceptor: `Authorization: Bearer`, ante 401 llama `POST /auth/refresh` con `withCredentials` (la cookie HttpOnly `refresh_token` viaja sola hacia `/api/v1/auth`), actualiza `authStore` y reintenta la petición original (US-003). El refresh nunca se lee ni se guarda desde JS.
  - 4 stores Zustand (`authStore`, `cartStore`, etc.); provider de TanStack Query; guards de rutas por rol; manejo de errores `{detail, code, field}`.
  - Rehidratación de sesión con `GET /auth/me` (contrato de sesión de C-02).
  - Tests: interceptor (refresh + reintento, un solo refresh concurrente), guards de ruta.
  - **Decisión tomada (2026-11-17, DD-27)**: el access vive solo en memoria (OQ-1 = A); ver `knowledge-base/09` DD-27. Texto original de la decisión pendiente: la spec `[INT]` pide que `authStore` persista solo `accessToken`, mientras que C-02 (D3/PA-04) dejó escrito que el access vive solo en memoria. Hay que elegir y, si cambia, actualizar la KB (`knowledge-base/05` RN-AU-10, `08` §Seguridad, `10` IN-07).
  - Punto de partida (C-08): los roles para la UI se toman de `GET /auth/me` (el claim `roles` del access es informativo y no autoriza); las lecturas públicas (`GET /productos`, `/categorias`, `/ingredientes`, `/unidades-medida`) con un access inválido responden 401, así que el interceptor renueva y reintenta.
  - Punto de partida (C-11): contrato de pedidos: `GET /pedidos` (scoped), `GET /pedidos/{id}`, `PATCH /pedidos/{id}/estado` con `{nuevo_estado, motivo}`, `DELETE /pedidos/{id}` con body OPCIONAL `{motivo}` (por defecto «Cancelado por el cliente»); paginación `{items,total,page,size,pages}`; errores `{detail, code, field}` con códigos de negocio.
  - **Heredado de C-13a** (verify 2026-11-15): pasar los roles de `GET /auth/me` y el usuario a `AppShell` (props `roles`, `usuario`, `onCerrarSesion`; hoy muestra siempre la variante sin sesión) y verificar visualmente la variante ADMIN contra `mockups/shell-admin.html` del change archivado; `error-page.test.tsx` usa `vi.unstubAllGlobals()` y borra el stub de `Request` de `src/test/setup.ts` (frágil: restaurar solo lo propio); activar los future flags de React Router o silenciar su aviso en los tests; quitar `RUTAS.raiz` si sigue sin uso y exportar `UsuarioShell` desde la API pública del shell; agregar a `uiStore` los campos que falten junto con los otros tres stores.
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
- **Estado**: `[x]` cerrado (2026-11-19). Apply completo (51/51 tareas; frontend 1084 tests verdes, backend suite completa verde; typecheck y lint limpios). Verify: PASS WITH FINDINGS; los 2 hallazgos se corrigieron en el mismo change (CORS con `expose_headers=["Retry-After"]` para que el 429 muestre el tiempo de bloqueo, y subrayado de los enlaces en texto). Pedido posterior del usuario: botón «Cerrar sesión» en Mi cuenta (mockup revisado y aprobado 2026-11-19, implementado; corregida una especificidad CSS en `mi-cuenta.css`). Visual verify: passed (Mi cuenta revisada a 1440x900 y 390x844; ver `design.md`). Decisiones DU-1..DU-5 en `design.md` (auto-login tras registrarse, se retira `GET /usuarios/me`, nombre/apellido obligatorios en backend, email normalizado en backend, «Repetir contraseña» solo en cliente). Migración `005_email_normalizado` (normaliza emails existentes y agrega `ck_usuario_email_normalizado`). Archivado en `openspec/changes/archive/2026-11-19-c-14-fe-auth-cuenta/`; specs principales creadas `frontend-account` y `user-profile`, y ampliadas `auth-session`, `backend-db-migrations` y `user-registration`.
- **Scope**:
  - US-001 registro (409 si el email ya existe), US-002 login (mensajes 401/429; el login no tiene 409), US-004 logout, US-005 perfil propio (`GET/PATCH` perfil sin tocar roles).
  - Páginas `Login`, `Register`, `Perfil`; validación con TanStack Form.
  - Punto de partida (C-02): login por `POST /auth/login` (form OAuth2) que devuelve el access en el body y setea la cookie del refresh (requiere `withCredentials`); logout por `POST /auth/logout` y «cerrar todas las sesiones» por `POST /auth/logout-all` (Bearer, sin body, 204); usuario por `GET /auth/me`.
  - Tests: formularios y flujos de error.
  - Punto de partida (C-13b): tras `POST /auth/login` llamar `abrirSesion(access_token)` de `@/entities/session`: guarda el access, pide `GET /auth/me` y deja la sesión `autenticada`; `RequiereAcceso` redirige solo al destino recordado (o a `/catalogo`), no hay que programar la vuelta. El login usa `apiClient` de `@/shared/api` (credenciales ya incluidas) y un 401 de `/auth/login` no dispara renovación. Los errores llegan como `ApiError` (`code`, `field`, `retryAfter` en 429 para el aviso de bloqueo). El logout ya existe (`useCerrarSesion`, botón en el pie del panel); «Cerrar todas las sesiones» usa `cerrarTodasLasSesionesRemota` de `@/shared/api` y el botón es de este change.
- **Dependencias**: `C-13b`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` login, registro, perfil.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 1
  - `knowledge-base/05_reglas_de_negocio.md` §Autenticación, §Usuarios
  - `knowledge-base/07_flujos_principales.md` §Auth

### [C-15] `fe-direcciones`
- **Estado**: `[x]` cerrado (2026-11-17). Verify: PASS WITH FINDINGS; los 4 warnings (limpieza de toasts/diálogo al cerrar sesión, foco tras eliminar, aviso de lista desactualizada, feedback de mutaciones superpuestas) se corrigieron en el mismo change. Verify visual: passed con el backend real (capturas en el change archivado, `mockups/verify/`).
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

### [C-16a] `backend-catalogo-filtros`
- **Estado**: `[x]` cerrado (2026-11-18). Verify: PASS (53 tests dirigidos y suite backend completa 1683 passed / 0 failed). Sin UI (`Decision: no (no UI)`). Archivado en `openspec/changes/archive/2026-11-18-c-16a-backend-catalogo-filtros/`; spec principal nueva `openspec/specs/catalog-search/spec.md`.
- **Scope**:
  - Parte backend de C-16 (partido el 2026-11-18, como C-13a/C-13b); sin UI.
  - `GET /productos/` suma `precio_min`/`precio_max` (decimales ≥ 0, extremos incluidos; `min > max` → 422 `VALIDATION_ERROR` con `field` `precio_max`, `AppError` en el service) y `con_stock` (`true` → solo `stock_cantidad > 0`), siempre intersectando con la visibilidad (`catalog-visibility`).
  - Arregla las filas duplicadas y el `total` contado dos veces al filtrar por varios `categoria_ids`/`ingrediente_ids` (JOIN sin `DISTINCT` en `modules/productos/repository.py`) pasando a `EXISTS`.
  - Centraliza los filtros repetidos entre el listado y el conteo en un único `_aplicar_filtros` (DRY, regla dura 5); corrige la descripción OpenAPI de `q` (busca solo en `nombre`, según la KB).
  - Decisiones del usuario (2026-11-18, ex OQ-1..OQ-3 de C-16): precio y «Solo con stock» se filtran en el backend; sin duplicados; el frontend (C-16b) envía la categoría elegida con todas sus subcategorías. Registradas en el `design.md` del change (DU-1..DU-3).
  - Sin migración. Tests: pytest de integración contra PostgreSQL real (`test_producto_filtros.py`), TDD estricto.
- **Dependencias**: `C-08, C-11, C-25a`
- **Governance**: BAJO
- **UI**: sin UI (`Decision: no (no UI)`).
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-007)
  - `knowledge-base/05_reglas_de_negocio.md` §Productos (RN-PR-02, RN-PR-03)
  - `openspec/specs/catalog-visibility/spec.md`, `openspec/specs/api-conventions/spec.md`
  - `openspec/changes/c-16a-backend-catalogo-filtros/` (proposal, design, tasks, spec `catalog-search`)

### [C-16b] `fe-catalogo-publico`
- **Estado**: `[x]` cerrado (2026-11-18). Verify: PASS (frontend 572/572 tests, lint y typecheck limpios). Verify visual: passed tras corregir el blocker V-1 en el mismo change. Archivado en `openspec/changes/archive/2026-11-18-c-16b-fe-catalogo-publico/`; spec principal nueva `openspec/specs/frontend-catalog/spec.md`.
- **Scope**:
  - Parte frontend de C-16 (partido el 2026-11-18, como C-13a/C-13b).
  - US-007 explorar catálogo: filtros (categoría, nombre con debounce, precio, disponibilidad), paginación `page/size`, detalle con ingredientes/alérgenos y stock; skeleton y estados vacíos.
  - US-008 árbol de categorías (`GET /categorias/arbol`).
  - Tests: filtros, estados vacíos.
  - Punto de partida (C-13b): usar `apiClient` de `@/shared/api` con consultas TanStack Query (`queryOptions` con claves jerárquicas `['productos','lista',filtros]`, dominio primero; las claves públicas están en `CLAVES_PUBLICAS` y sobreviven al cierre de sesión); los listados paginados se tipan con `Paginado<T>` y los precios llegan como string decimal (usar `cartStore.agregar` con ese string). Un 401 en una lectura pública se renueva solo.
  - Punto de partida (C-16a): `GET /productos/` acepta `precio_min`, `precio_max` (decimales ≥ 0, extremos incluidos) y `con_stock` (`true` → solo `stock_cantidad > 0`); `categoria_ids` e `ingrediente_ids` se repiten en la query **sin `[]`** (`?categoria_ids=1&categoria_ids=2`); `precio_min > precio_max` → 422 `VALIDATION_ERROR` con `field` `precio_max`; sin duplicados, por lo que `total`/`pages` son confiables para la paginación.
  - Usa los filtros de C-16a (`precio_min`, `precio_max`, `con_stock`, sin duplicados) y envía la categoría elegida con todas sus subcategorías (decisiones DU-1..DU-3 de C-16a). Preguntas abiertas propias: OQ-4..OQ-6 (umbral «pocas unidades», agregar sin sesión, tamaño de página), con valor por defecto.
- **Dependencias**: `C-13b, C-16a`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` catálogo, detalle de producto, navegación por categorías (mockups en `openspec/changes/c-16b-fe-catalogo-publico/mockups/`, aprobación pendiente).
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-007, US-008)
  - `knowledge-base/05_reglas_de_negocio.md` §Productos (RN-PR-03, RN-PR-04), RN-CA
  - `knowledge-base/07_flujos_principales.md` §Catálogo
  - `openspec/changes/c-16a-backend-catalogo-filtros/design.md` (decisiones DU-1..DU-3 y contrato de los filtros)

### [C-16b+] `fe-catalogo-filtros-arriba` (ajuste visual post-roadmap)
- **Estado**: `[x]` cerrado (2026-11-19). Verify: visual passed. Archivado en `openspec/changes/archive/2026-11-19-fe-catalogo-filtros-arriba/`; spec principal `frontend-catalog` ampliada. Ajuste extra **fuera de los changes planificados**; no cuenta en los totales ni renumera nada.
- **Scope**: el catálogo público deja la columna lateral de filtros (desde 1024 px) y usa la barra superior en todos los anchos; en escritorio suma la fila de subcategorías, «Precio ▾» (popover) y «Solo con stock» en línea. Mobile y el modelo de filtros en la URL sin cambios.
- **Dependencias**: `C-16b`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` mockups en `openspec/changes/fe-catalogo-filtros-arriba/mockups/` (aprobación pendiente).
- **Leer antes**: `openspec/changes/archive/2026-11-18-c-16b-fe-catalogo-publico/design.md`, spec `openspec/specs/frontend-catalog/spec.md`

### [C-17a] `fe-admin-categorias-ingredientes`
- **Estado**: `[x]` cerrado (2026-11-18). Verify: PASS (frontend 685/685 tests, lint y typecheck limpios). Verify visual: passed tras corregir los botones compactos y el resaltado de «Es alérgeno»; diferencias menores anotadas en el design. Archivado en `openspec/changes/archive/2026-11-18-c-17a-fe-admin-categorias-ingredientes/`; spec principal nueva `openspec/specs/frontend-admin-catalog/spec.md`.
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
- **Estado**: `[x]` cerrado (2026-11-18). Verify: PASS (backend 1706 tests, frontend 780/780, lint y typecheck limpios). Verify visual: passed tras corregir la marca «Alérgeno» de la fila de ingredientes; diferencias menores anotadas en el design. Incluye el arreglo de backend de `unidad_medida_id` en ingredientes y del bug de C-11 (productos con ingredientes). Archivado en `openspec/changes/archive/2026-11-18-c-17b-fe-admin-productos-stock/`; specs principales nuevas `ingredient-measure-unit` y `product-ingredients`, y `frontend-admin-catalog` ampliada.
- **Scope**:
  - US-010 productos (ADMIN/STOCK; `disponible` por PATCH), US-012 stock (rol STOCK limitado a stock/disponibilidad).
  - Vistas condicionadas por rol (RBAC alineado con C-08).
  - Imágenes y unidades de medida (US-013, US-014) quedan en C-28.
  - Tests: permisos por rol en UI, CRUD de productos, actualización de stock/disponibilidad.
  - Punto de partida (C-08): contratos de inventario: `PATCH /productos/{id}/disponibilidad` con body `{"disponible": bool}` (idempotente) y `PATCH /productos/{id}/stock` con `{"stock_cantidad": int>=0}` (absoluto), ambos ADMIN/STOCK; STOCK ve productos no disponibles pero no eliminados.
  - Punto de partida (C-17a): `src/entities/ingrediente/` (`ingredienteQueries.lista`, `useCrearIngrediente`/`useEditarIngrediente`/`useEliminarIngrediente`, `resumenUso`) y `src/entities/unidad-medida/` (`unidadMedidaQueries.todas`, `etiquetaUnidad`) ya existen; las mutaciones de categorías e ingredientes invalidan `['categorias']`/`['ingredientes']` y `['productos']`. Componentes compartidos: `shared/ui/estados`, `shared/ui/dialogo-baja`, `shared/ui/lista-admin` (CSS). (C-17b: el backend ya devuelve `unidad_medida_id` en las lecturas de ingrediente y `PATCH /ingredientes/{id}` lo acepta.)
  - Bug conocido (C-11): `POST /productos/` con `ingredientes` inline respondía 500 (`ProductoService.create` no copiaba `cantidad` ni `unidad_medida_id`). **Resuelto en este change** (DT-27, sin migración): alta/edición/`POST /{id}/ingredientes` comparten `_vincular_ingrediente`; ids repetidos → 422, unidad o ingrediente inexistente → 404.
- **Dependencias**: `C-17a, C-08`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` pantallas de administración de productos y stock.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-010, US-012)
  - `knowledge-base/03_actores_y_roles.md` §Matriz RBAC
  - `knowledge-base/05_reglas_de_negocio.md` RN-PR, §Stock (RN-ST)
  - `knowledge-base/04_modelo_de_datos.md` (Producto)

### [C-18] `fe-carrito-personalizacion`
- **Estado**: `[x]` cerrado (2026-11-19). Verify: PASS WITH FINDINGS (frontend 848/848 tests, lint y typecheck limpios). Verify visual: passed tras corregir el ancho de «Vaciar carrito» en mobile, el diálogo de confirmación por debajo de los avisos y el subrayado de «Seguir comprando»; diferencias menores anotadas en el design. Archivado en `openspec/changes/archive/2026-11-19-c-18-fe-carrito-personalizacion/`; spec principal nueva `frontend-cart`, y `frontend-client-stores` y `frontend-catalog` ampliadas.
- **Scope**:
  - US-015 carrito persistente en localStorage (sobrevive refresh, cierre y logout/login, CE-14), suscripción por slice a `cartStore`.
  - US-016 personalizar producto: excluir ingredientes removibles (`personalizacion` = IDs).
  - Tests: persistencia, personalización, totales.
  - **Heredado de C-13a**: contador de ítems del carrito en el panel lateral y en la barra superior mobile (clase `.count` del design system; C-13a no lo portó porque no hay `cartStore`).
  - Punto de partida (C-13b): `cartStore` ya existe y persiste (`@/entities/cart`: `agregar`, `fijarCantidad`, `quitar`, `vaciar`, `selectTotalItems`, `selectTotalPrecio`, `selectLinea`; clave `foodstore.cart`, sobrevive al logout); `uiStore` ya tiene `cartOpen`/`abrirCarrito`/`cerrarCarrito`, `toasts` y `confirmModal` (solo estado: este change dibuja lo que use). Falta la UI del carrito, la personalización visual y el contador del panel.
  - Punto de partida (C-16b): `TarjetaProducto` (`@/entities/producto`) acepta un slot `accion`; `BotonAgregarAlCarrito` vive en `@/features/agregar-al-carrito` (anónimo → `/ingresar` con `state.desde`; autenticado → `cartStore.agregar` + toast); `productoQueries.detalle(id)` trae el producto con ingredientes y `es_removible` disponible para la personalización; `formatearPrecio` formatea importes (`$ 1.250,50`). El carrito NO valida el stock acumulado (R4: sumar varias veces puede superar el stock; lo valida el backend al crear el pedido). El panel lateral aún no tiene contador de ítems (heredado de C-13a, sigue pendiente aquí).
  - Punto de partida (C-17b): `src/entities/producto/` expone `productoGestionQueries` (claves `productos-gestion`, distintas de las del catálogo público `productos`) y las mutaciones `useCrearProducto`/`useEditarProducto`/`useEliminarProducto`/`useFijarStock`/`useFijarDisponibilidad`, que invalidan `['productos-gestion']` y `['productos']`. `es_removible` ya es editable por producto-ingrediente (`PUT /productos/{id}` con `ingredientes` reemplaza la lista) y `GET /productos/{id}/ingredientes` lo devuelve junto con `cantidad` y `unidad_medida_id`; ya no hay 500 en el alta con ingredientes.
- **Dependencias**: `C-16b`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` drawer/página de carrito y selector de personalización.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 4 (US-015, US-016)
  - `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (Zustand)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-03, DD-05)

### [C-19] `fe-checkout-pedido`
- **Estado**: `[x]` cerrado (2026-11-19). Apply completo (35/35 tareas; frontend 986/986 tests, lint y typecheck limpios; sin cambios de backend). Mockups y OQ-1..OQ-6 (por defecto) aprobados por el usuario el 2026-11-19. Verify visual: passed (ver `design.md`). Archivado en `openspec/changes/archive/2026-11-19-c-19-fe-checkout-pedido/`; spec principal nueva `frontend-checkout`, y `frontend-cart` ampliada (Página del carrito).
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
  - Punto de partida (C-18): la página `/carrito` (`src/pages/carrito/`) ya existe y **no tiene CTA de checkout**: C-19 agrega el botón y la ruta. Cada línea del carrito (`useCartStore`) trae `personalizacion` (ids, ordenados; es lo que se envía como `items[].personalizacion`) y `personalizacionNombres` (snapshot para mostrar); `subtotalLinea(linea)` y `selectTotalPrecio` dan importes en string decimal. Riesgo R4: el backend no valida que los ids de personalización sean ingredientes removibles del producto (deuda backend para C-19/C-25b). El carrito muestra el precio del momento de agregar; el backend cobra el vigente y suma `costo_envio`.
  - `knowledge-base/06_funcionalidades.md` US-017
  - `knowledge-base/07_flujos_principales.md` §Compra
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-06, RN-PE-09, RN-ST
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-06, PA-11, PA-13)
  - Punto de partida (C-15): usar `SelectorDireccion` de `@/entities/direccion` (props `valor: number | null | undefined` donde `null` = retiro en el local, `onCambiar`, `permitirRetiro` —por defecto `true`; apagarlo según PA-13— y `leyenda`); preselecciona la principal (si no la primera, si no retiro) llamando una vez a `onCambiar`, y trata como «sin elegir» un id que ya no existe; pide `direccionQueries.lista({ page: 1, size: 100 })` y su enlace «Agregar dirección» lleva a `/direcciones` (el formulario de alta no está en el checkout). Notificaciones con `useUiStore.getState().notificar(...)` y confirmaciones con `pedirConfirmacion(...)` (ya se dibujan en el shell). Eliminar la principal no promueve otra en el backend (OQ-1 de C-15): el selector puede encontrarse con direcciones y ninguna principal. `entities/direccion` suma además `nombreDireccion` y `TarjetaDireccion`/`ResumenDireccion`.

### [C-20a] `fe-pago-tarjeta`
- **Estado**: `[x]` cerrado (2026-11-19). C-20 partido en dos por decisión del usuario (OQ-5). Verify: tests, visual y sandbox passed (`FUND`, `OTHE`, `APRO`, `CONT`; se agregó `rejected_by_issuer` a los motivos). Archivado en `openspec/changes/archive/2026-11-19-c-20a-fe-pago-tarjeta/`.
- **Scope**:
  - US-024 pago con `CardPayment` brick (PA-05 resuelta, DD-21: sin alternativa de redirect a Checkout Pro): envío sin datos de tarjeta, resultado inmediato de `POST /pagos/crear` (aprobado, rechazado con reintento, pendiente estático, «pago aprobado pero pedido cancelado por falta de stock» `a_devolver`, DD-20), «no corresponde pagar», errores 409/400/502/503/red y accesibilidad; `paymentStore` con `mpPaymentId` texto y `a_devolver`.
  - Clave pública servida por el backend (OQ-1 = endpoint, 2026-11-19): `GET /api/v1/pagos/config` autenticado (sin restricción de rol), 503 si falta `MP_PUBLIC_KEY`, en capas y con tests pytest; sin variable `VITE_*` nueva. OQ-3, OQ-4 y OQ-6 respondidas por defecto.
  - Tests: aprobado, rechazado, reintento, errores (MP mockeado con `vi.mock('@mercadopago/sdk-react')`) y endpoint de configuración (pytest).
  - **Heredado de C-12** (2026-11-17): el backend cobra por la Orders API (DD-26). El pedido a `POST /api/v1/pagos/crear` exige `payment_type_id` (`credit_card`/`debit_card`), que el brick entrega en `additionalData.paymentTypeId`; `issuer_id` se acepta pero no se envía a MercadoPago; los estados de MercadoPago son los de la orden (`processed`, `failed`, `processing`, `action_required`) y `mp_payment_id` es texto. La página `sandbox/pago-prueba.html` del change archivado sirve de referencia del contrato. Para probar: aplicación creada como Checkout API con «API de Orders», credenciales `APP_USR-` de la cuenta vendedora de prueba, email de una cuenta compradora de prueba y webhook del panel con el evento «Order (Mercado Pago)».
  - Punto de partida (C-13b): `paymentStore` ya existe en memoria (`@/entities/payment`: `iniciar(pedidoId)`, `registrarResultado`, `registrarError`, `reset`, estados `inactivo|procesando|aprobado|rechazado|pendiente|error`); falta el flujo del brick y la pantalla de resultado.
  - Punto de partida (C-19): la confirmación `MERCADOPAGO` `PENDIENTE` enlaza «Pagar $ X con tarjeta» a `/finalizar-compra/pedido/:pedidoId/pago` (`rutaPagoPedido(id)`), hoy una página provisoria (`PlaceholderPage`, dueño `C-20`, solo `CLIENT`): C-20 reemplaza esa página en `app/router/routes.tsx` sin cambiar la ruta. `pedidoQueries.detalle(id)` (`@/entities/pedido`) devuelve el `PedidoDetalle` con `total` (string decimal) y `estado_codigo`; tras crear el pedido ya está en la caché. El carrito ya está **vacío** cuando se llega al pago (se vacía al crear el pedido para cualquier forma de pago, OQ-3): el reintento de pago es sobre el pedido, no sobre el carrito. Si el pago se aprueba, invalidar `pedidoQueries.detalle(id)` y `pedidoQueries.todas()`.
- **Dependencias**: `C-19, C-12`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` pantalla de pago y resultados inmediatos.
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md`
  - `knowledge-base/06_funcionalidades.md` Épica 6 (US-024)
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos

### [C-20b] `fe-pago-seguimiento`
- **Estado**: `[x]` cerrado (2026-11-19). Verify: tests y visual passed (seguimiento del pendiente, tope de 2 min, recarga y línea de pago en la confirmación). Webhook con ngrok probado en sandbox el 2026-11-19 (tarea 6.1: FUND y APRO reciben webhook firmado con 200; CONT queda en proceso sin webhook). **Pendiente**: mostrar el N.º de operación tras recargar (`GET /pagos/{pedido_id}` no devuelve `mp_payment_id`; requiere cambio de backend). Archivado en `openspec/changes/archive/2026-11-19-c-20b-fe-pago-seguimiento/`.
- **Scope**:
  - US-025 reflejo de la confirmación por webhook: polling de `GET /pagos/{pedido_id}` mientras el pago está pendiente (5 s durante 2 min por defecto, OQ-2) con «La confirmación está demorando» + «Actualizar» al pasar el tope.
  - Reconstrucción de la vista de pago al recargar a partir del último intento en el servidor.
  - US-026 estado del pago con `mp_status_detail` legible en la confirmación del pedido (OQ-7).
  - Tests: recarga, polling con timers falsos (pendiente → aprobado/rechazado/`a_devolver`, tope), línea de estado en la confirmación.
  - Punto de partida (C-20a): `PagoPedidoPage`, `pagoQueries.estado`, `vistaPago` y `motivoRechazo` (`@/entities/payment`) ya existen; la vista sale de la caché `['pagos', id]`, que C-20a solo llena con la respuesta de `crear` o tras un 409.
- **Dependencias**: `C-20a`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` pendiente con seguimiento, demora y estado del pago en la confirmación.
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md`
  - `knowledge-base/06_funcionalidades.md` Épica 6 (US-025, US-026)
  - `knowledge-base/07_flujos_principales.md` §Webhook

### [C-21] `fe-mis-pedidos-seguimiento`
- **Estado**: `[x]` cerrado (2026-11-20). Verify: PASS WITH FINDINGS (frontend 1627/1627, backend 1764 passed, typecheck y lint limpios); major corregido en el mismo change: los distintivos de estado «Confirmado»/«Entregado» salían sin color porque Tailwind purgaba las clases `b-<estado>` armadas con plantilla (también afectaba a C-22); mapa de clases literales en `entities/pedido/model/estados.ts` y test en `tests/architecture/styles-compile.test.ts`. Visual verify: passed with differences (solo diferencias de datos de ejemplo). OQ-4 cambiada por el usuario: filtro por estado. Archivado en `openspec/changes/archive/2026-11-20-c-21-fe-mis-pedidos-seguimiento/`; spec principal nueva `frontend-my-orders`, y `order-api` y `frontend-app-shell` ampliadas. Alcance: `/mis-pedidos` (listado paginado con filtro por estado en la URL, polling 30 s) y `/mis-pedidos/:pedidoId` (progreso, pago con Pagar/Reintentar, entrega, ítems, historial con «Vos»/«El local»/«Automático», cancelación con motivo obligatorio en la UI); backend aditivo `GET /pedidos?propios=true` (sin migración); `MarcaActualizacion` y `vistaPagoDelPedido` movidos a `shared/ui` y `entities/payment`.
- **Scope**:
  - US-018 listado paginado y detalle propio (snapshots, totales), timeline de estados con polling 30 s (WebSocket queda en C-27).
  - US-019 cancelar mi pedido (solo PENDIENTE/CONFIRMADO, motivo obligatorio).
  - Tests: timeline, cancelación.
  - Punto de partida (C-19): existe `src/entities/pedido/` con `pedidoQueries.todas()` (`['pedidos']`, que `useCrearPedido` invalida al crear un pedido: el listado se vuelve a pedir al abrirlo), `pedidoQueries.detalle(id)` (`GET /pedidos/{id}`), los tipos `PedidoDetalle`/`DetallePedido`, `BadgeEstado`/`etiquetaEstado`/`claseEstado` (estados `PENDIENTE`…`CANCELADO`), `EtiquetaFormaPago` y `FORMAS_PAGO`. La confirmación `/finalizar-compra/pedido/:id` enlaza «Ver mis pedidos» a `/mis-pedidos` (hoy provisoria, dueño `C-21`). Falta el listado paginado (`pedidoQueries.lista`), el timeline, la cancelación y el seguimiento.
  - Punto de partida (C-22): `pedidoQueries.lista(filtros)` (listado paginado con `keepPreviousData`, acepta `estado`/`desde`/`hasta`/`page`/`size`) y `pedidoQueries.historial(id)`; `LineaTiempoHistorial`, `tituloEvento`/`autorEvento` y `EntregaDelPedido` en `entities/pedido`; `accionesGestion`/`proximoAvance` (`transiciones.ts`) espejan la FSM de gestión (la del cliente es otra); `clasificarErrorCambioEstado`; `HistorialEstadoPedidoRead.usuario_nombre`, `PedidoDetalle.direccion`; `Dialogo` y `DialogoBaja` (con `children`) y la variante de botón `peligroContorno`; las rutas `/gestion-pedidos` usan `RequiereAcceso` con `ACCESO_RUTAS`.
- **Dependencias**: `C-19, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` mis pedidos, detalle y timeline.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-018, US-019
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-07, RN-PE-10, RN-ST-02
  - `knowledge-base/07_flujos_principales.md` §Cancelación

### [C-22] `fe-gestion-operativa-pedidos`
- **Estado**: `[x]` cerrado (2026-11-19). Verify: PASS WITH FINDINGS (frontend 1464/1464, backend 1759 passed, typecheck y lint limpios). Major corregido en el mismo change (byte NUL en las comillas del historial, `pedido.css`, test `pedido-css.test.ts`). Visual verify: passed with differences (minor: el envío de $50 en retiros viene del backend, derivado a C-25b). Backend aditivo: `direccion` en el detalle y `usuario_nombre` en el historial. RN-PE-12 corregida (no hay borrado, solo cancelar). Archivado en `openspec/changes/archive/2026-11-19-c-22-fe-gestion-operativa-pedidos/`; spec principal nueva `frontend-order-management`, y `order-api` ampliada.
- **Scope**:
  - US-020 avanzar estado (PEDIDOS/ADMIN) con motivo/observación, incluye EN_CAMINO (despachado por ADMIN/PEDIDOS, DD-23); US-021 todos los pedidos con filtros estado/fecha e historial; US-022 cancelar/eliminar (ADMIN/PEDIDOS).
  - Confirmación manual PENDIENTE→CONFIRMADO visible solo para pedidos `EFECTIVO`/`TRANSFERENCIA` (DD-22), con el error de «sin stock» si el backend la rechaza (DD-20).
  - Acciones visibles según FSM, rol y forma de pago.
  - Tests: botones según estado/rol/forma de pago, historial.
  - Punto de partida (C-11): contrato de pedidos: `GET /pedidos` (scoped), `GET /pedidos/{id}`, `PATCH /pedidos/{id}/estado` con `{nuevo_estado, motivo}`, `DELETE /pedidos/{id}` con body OPCIONAL `{motivo}` (por defecto «Cancelado por el cliente»); paginación `{items,total,page,size,pages}`; errores `{detail, code, field}` con códigos de negocio.
  - Implementado y verificado (2026-11-19): `/gestion-pedidos` (listado con filtros en la URL, polling 30 s, próxima acción por fila) y `/gestion-pedidos/:pedidoId` (entrega, ítems, acciones, historial); backend aditivo `PedidoDetalle.direccion` e `historial[].usuario_nombre` (sin migración); `features/cambiar-estado-pedido` (diálogos de avance y de cancelación con motivo). Sin borrado de pedidos (OQ-4).
- **Dependencias**: `C-13b, C-09, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` tablero de gestión de pedidos.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 5 (US-020..US-022)
  - `knowledge-base/05_reglas_de_negocio.md` §Pedidos y FSM (RN-PE)
  - `knowledge-base/07_flujos_principales.md` §Ciclo operativo

### [C-23] `fe-admin-usuarios-roles`
- **Estado**: `[x]` cerrado (2026-11-20). Verify: PASS (frontend 1723/1723, backend 1810 passed, typecheck y lint limpios). Visual verify: passed with differences; las 3 menores corregidas en el mismo change (viñetas del diálogo, spinner de «Desactivando…», tamaño de errores del formulario; ver `design.md` `## UI Mockups`). OQ-1..OQ-10 aceptadas por defecto; migración `006_sesion_motivo_baja` (motivo de sesión `BAJA`); protecciones `SELF_ACTION_NOT_ALLOWED` y `LAST_ADMIN` (409, bloqueo `FOR UPDATE`). Archivado en `openspec/changes/archive/2026-11-20-c-23-fe-admin-usuarios-roles/`; specs principales nuevas `user-administration` y `frontend-admin-users`, y `frontend-app-shell` ampliada.
- **Scope**:
  - US-027 ADMIN: crear usuario con roles (multi-rol), listar paginado con filtro por rol, actualizar roles, desactivar (soft delete).
  - Tests: asignación multi-rol, filtros.
  - Implementación (C-23, apply): backend con migración `006` (motivo de sesión `BAJA`), roles validados y con `asignado_por_id`, protecciones `SELF_ACTION_NOT_ALLOWED`/`LAST_ADMIN` y baja con cierre de sesiones; frontend con `entities/usuario`, `pages/admin-usuarios` y `useRefrescarSesion`; la ruta `/admin/usuarios` ya no es provisoria (el dueño de las provisorias que quedan es C-24).
  - Punto de partida (C-14): el alta ADMIN (`UserCreateAdmin`) hereda el endurecimiento de `UserCreate`: `nombre`/`apellido` recortados y obligatorios (422 con `field`) y el email normalizado (recortado y en minúsculas; `ck_usuario_email_normalizado`, migración `005`); `UserUpdateAdmin` hereda el rechazo de `nombre`/`apellido` en `null`. `GET /usuarios/me` ya no existe (`GET /auth/me` lee el usuario autenticado).
- **Dependencias**: `C-13b, C-08`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` administración de usuarios.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-027
  - `knowledge-base/05_reglas_de_negocio.md` §Usuarios y Roles (RN-US-01..03)
  - `knowledge-base/03_actores_y_roles.md`

### [C-24] `fe-dashboard-metricas`
- **Estado**: `[x]` cerrado (2026-11-20). Verify: PASS WITH FINDINGS (backend 1862 passed, frontend 1815/1815, typecheck y lint limpios); el major de accesibilidad (botón «Ver como tabla» sin nombre en mobile) y 3 menores visuales se corrigieron en el mismo change; Visual verify: passed (minors aceptados: nombre a la izquierda en top productos, error KPI a ancho completo, botón «Ver gráfico»). Archivado en `openspec/changes/archive/2026-11-20-c-24-fe-dashboard-metricas/`; specs principales nuevas `sales-metrics` y `frontend-admin-dashboard`, y `frontend-app-shell` modificada.
- **Scope**:
  - US-028 (ADMIN): KPIs (ventas, ticket promedio, pedidos activos, ingresos), ventas por período, top productos, pedidos por estado, ingresos por forma de pago con recharts.
  - Verificar endpoints de estadísticas actuales y ajustarlos al contrato (page/size, errores).
  - Tests: endpoints de métricas y render de gráficos.
- **Dependencias**: `C-22`
  - Implementación (C-24, apply): backend con contrato nuevo de `/api/v1/estadisticas/*` (venta = `CONFIRMADO`/`EN_PREP`/`EN_CAMINO`/`ENTREGADO` de cualquier forma de pago, UTC, máximo 366 días inclusivos, series con ceros, importes en texto con 2 decimales, validación 422 con `field`) y frontend con `entities/estadistica` y `pages/admin-dashboard`; la ruta `/admin/dashboard` ya no es provisoria (`DuenoRuta` conserva `'C-24'`). Decisiones en DD-28.
  - Punto de partida (C-22): `pedidoQueries.lista` pide `GET /pedidos/` paginado con filtros `estado`/`desde`/`hasta` (fechas UTC); el listado de gestión y el dashboard comparten `BadgeEstado`/`etiquetaEstado`/`EtiquetaFormaPago`, los íconos y los estilos de `.badge` del design system.
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` dashboard.
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-028
  - `knowledge-base/07_flujos_principales.md` §Dashboard
  - `knowledge-base/02_descripcion_general.md`

### [C-25a] `backend-capas-y-renombres`
- **Estado**: `[x]` completado (archivado en `openspec/changes/archive/2026-11-14-c-25a-backend-capas-y-renombres/`)
- **Scope**:
  - DT-25 (capas): sacar `Session`/`get_session` de los routers de `categorias`, `ingredientes`, `pagos`, `pedidos` y `productos` (delegar al service) y cortar la dependencia `core/deps.py` → `modules/`; si un change anterior toca alguno de esos routers, lo corrige ahí.
  - Incluye la sugerencia pendiente del verify de C-02: mover `UsuarioServiceDep` fuera de `usuarios/router.py`.
  - Renombrar `direcciones_entrega` → `direcciones`, `admin`, `core/unit_of_work.py` → `core/uow.py` y el resto de los módulos a la estructura objetivo de la spec (`knowledge-base/08` §Estructura).
  - Cobertura pytest > 60% (auth, pedidos, pagos, categorías, direcciones, ingredientes, productos, estadísticas); prueba end-to-end del flujo compra→pago→entrega a nivel API.
  - Es solo backend: puede correr en paralelo con el frontend; se cierra antes de `C-25b`.
  - **Heredado de C-12** (menores del verify 2026-11-17; C-25a ya está cerrado, así que se toman en un change de endurecimiento de pagos antes de `C-25b` o dentro de él; gobernanza CRÍTICO): (1) tests directos del mapeo de estados `canceled`, `charged_back` y `created`; (2) `partially_refunded → aprobado` está en el código y en D20 pero no en la spec, y no tiene test: agregarlo a la spec o quitarlo; (3) la respuesta 200 del webhook incluye el `PedidoDetalle` completo: devolver solo `status`; (4) `procesar_webhook` y su handler son `async def` con I/O bloqueante (SDK y base): pasarlos a `def` para no bloquear el event loop; (5) comparar el `total_amount` de la orden con el monto del pago local antes de confirmar; (6) probar por el endpoint que los logs no contienen secretos; (7) decidir si se retira la variante «tal cual» de la firma del webhook (en sandbox MercadoPago firmó con el id en minúsculas); (8) casos de sandbox no ejecutados: `OTHE`, `CONT` y clave de idempotencia repetida (OQ-14); (9) `python -m app.db.seed` falla en la consola de Windows (cp1252) al imprimir emojis y revierte todo: forzar UTF-8 en la salida o quitar los emojis.
  - Punto de partida (C-11): `pedidos/repository.py` importa `FiltrosPedidos` desde `pedidos/schemas.py`; moverlo a un lugar neutro (la capa de repositorio no debe importar de schemas).
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
  - **Heredado de C-13a** (menores del verify 2026-11-15): favicon (hoy `/favicon.ico` da 404 en consola); accesibilidad del drawer mobile (`role="dialog"`/`aria-modal`, trampa de foco, contenido `inert` detrás del scrim); test que exija `index.ts` en cada slice/segmento FSD; título del 404 en mobile (una línea en la app, dos en el mockup); decidir si se quita la escala por defecto de Tailwind (hoy `h-10` sale como `2.5rem` literal, fuera de los tokens); sumar los íconos `obra`, `brujula` y `alerta` al sprite de `design-system/components.html` (cambio visual del design system: requiere revisión del usuario); test de `readConfig` con valor vacío que no distingue del caso URL inválida; imagen de producción del frontend (el Dockerfile actual es solo servidor de desarrollo).
  - **Heredado de C-15** (deuda sugerida, 2026-11-17): índice único parcial de `es_principal` (`WHERE es_principal AND deleted_at IS NULL`, por usuario) en `direcciones`, porque la regla «solo una principal» (RN-DI-01) la garantiza solo el service y dos `PATCH /direcciones/{id}/principal` simultáneos podrían dejar dos principales (R3; requiere migración Alembic, governance BAJO); sumar al sprite de `design-system/components.html` los íconos `editar`, `basura`, `estrella`, `mas` y `tienda` que usa el frontend (cambio visual del design system: requiere revisión del usuario); decidir con OQ-1 de C-15 si al eliminar la principal el backend promueve otra.
  - **Heredado de C-19** (deuda de backend detectada, 2026-11-19; el frontend la compensa): R1 `POST /pedidos/` devuelve todos sus rechazos como `HTTP_400`/`HTTP_404` sin código estable ni línea afectada (el frontend clasifica por el texto de `detail` en `clasificarErrorCreacion`); sumar `ErrorCode` estables (`PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `PAYMENT_METHOD_UNAVAILABLE`, `DUPLICATE_ITEM`) con `field` y el `producto_id` afectado y simplificar el clasificador; R2 sin idempotencia de creación (un timeout tras el commit + «Reintentar» puede crear dos pedidos `PENDIENTE`); R3 `direccion_id` no se valida (inexistente o de otro usuario → FK/500 o pedido a dirección ajena); R4 los ids de `personalizacion` no se validan como ingredientes removibles del producto; además no hay endpoint que liste las formas de pago habilitadas (el frontend usa un catálogo local, OQ-2) y no hay datos bancarios en el sistema para la transferencia (OQ-5).
  - **Heredado de C-22** (deuda detectada, 2026-11-19): R1 el costo de envío fijo de $50 (`COSTO_ENVIO_FIJO`) se cobra también a los pedidos para retirar en el local (`crear_pedido` lo aplica siempre; sin `direccion_id` debería ser 0); R2 los filtros de fecha del listado son UTC (el gestor ve días locales); R6 el filtro de estado acepta un solo valor y no hay búsqueda por cliente o número; OQ-7 considerar varios estados, «activos» y zona horaria; el rol `COCINA`/KDS y el WebSocket siguen sin tocarse (PA-07, C-26/C-27); los íconos `moto`, `flecha`, `nota` y `calendario` de `shared/ui/icon` son provisionales y faltan en el sprite de `design-system/components.html`.
  - **Punto de partida (C-24)**: la pantalla «Dashboard» queda lista para capturas y video (tarjetas KPI, ventas por período, productos más vendidos, pedidos por estado, ingresos por forma de pago, «Ver como tabla», estados vacío y de error). Con datos de ejemplo hace falta algún pedido confirmado; las fechas son UTC; ver «Dashboard de métricas (C-24)» en `frontend/README.md`.
  - **Punto de partida (C-23)**: la pantalla «Usuarios» queda lista para capturas y video (listado con filtro por rol, alta multi-rol, edición propia con la casilla «Administrador» bloqueada, diálogo de desactivación). Deuda a documentar en la entrega: la contraseña inicial del alta ADMIN la elige el administrador y no hay cambio de contraseña (DT-28); recuperación sin `ADMIN` con `python -m app.db.seed`; ver «Usuarios y roles (C-23)» en `frontend/README.md`.
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
  - Reemplazar el polling de 30 s en C-21/C-22 si se aprueba (en C-21: `refetchInterval` de `pages/mis-pedidos`, listado y detalle, más el de `pagoQueries.estado`).
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
| 1 — Features | 18 | C-13a, C-13b, C-14, C-15, C-16a, C-16b, C-17a, C-17b, C-18, C-19, C-20a, C-20b, C-21..C-24, C-25a, C-25b | Frontend completo (PA-01 resuelta); changes `[UI-MOCKUP]` (14): C-13a, C-14, C-15, C-16b, C-17a, C-17b, C-18, C-19, C-20a, C-20b, C-21..C-24 |
| 2 — Extras | 3 | C-26..C-28 | Opcional/bloqueado por la parte COCINA/KDS de PA-07 y por PA-19; al final |

**Total: 33 changes** (28 originales; C-13, C-16, C-17, C-20 y C-25 partidos en dos). **Cerrados: 29** (C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, C-09, C-10, C-11, C-12, C-13a, C-13b, C-14, C-15, C-16a, C-16b, C-17a, C-17b, C-18, C-19, C-20a, C-20b, C-21, C-22, C-23, C-24, C-25a). **Pendientes obligatorios: 1** (todos de Fase 1; la Fase 0 está completa) y 3 opcionales de Fase 2. Ajustes extra fuera del plan (no cuentan): `fe-catalogo-filtros-arriba` (cerrado).

Governance CRITICO: C-02, C-04, C-05, C-08, C-12, C-14, C-20a, C-20b, C-23. ALTO: C-03, C-06, C-07, C-09, C-10, C-13b, C-27.

**Primer change recomendado**: `C-01` (`baseline-backend`) ✓ → siguiente: C-13a (`fe-foundation-scaffold`) y luego C-13b (`fe-foundation-auth-data`, ya desbloqueado en backend: requiere C-13a, C-02 ✓ y C-11 ✓). Fase 0 completa: C-12 se cerró el 2026-11-17.
