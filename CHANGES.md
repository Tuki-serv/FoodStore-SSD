# CHANGES — Secuencia de Implementación

> Índice canónico de todos los changes del proyecto **Food Store** (React + TS + Vite + Tailwind + TanStack Query + Zustand / FastAPI + SQLModel + PostgreSQL + Alembic; MercadoPago, Cloudinary).
> Cada change es atómico: un agente puede implementarlo en una sesión (~4-6 horas).
> **Leer este archivo antes de ejecutar cualquier `/opsx:propose`.**

**Regla de la KB (DD-16/DD-17):** la spec `integrador.docx` v5.0 es el objetivo; el código actual (solo backend) es el *estado actual con deuda técnica*. La tabla consolidada DT-01..DT-25 vive en `knowledge-base/09_decisiones_y_supuestos.md`. Por eso la **Fase 0 corrige la deuda** antes de construir features (Fase 1). La Fase 2 son extras no especificados, opcionales y bloqueados.

**Leyenda de marcas**
- `[UI-MOCKUP]` = change visual: requiere mockup aprobado antes de apply (política `system-and-mockups`, design system Revision 1 aprobado en `design-system/README.md`). Registrar `## UI Mockups` en el `design.md` del change.
- `[PENDIENTE DE DECISIÓN: PA-xx]` = el orden o scope puede cambiar según una pregunta abierta; **no bloquea** el roadmap (se implementa con el supuesto indicado y se ajusta).
- `[OPCIONAL/BLOQUEADO]` = Fase 2; no iniciar hasta resolver PA-07 y PA-19.

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
C-01 baseline-backend
 ├── C-02 auth-sesion-tokens-bearer-refresh ─────┬── C-08 rbac-multirol-permisos-stock
 │                                               └── C-13 fe-foundation-spa (también C-11)
 ├── C-03 auth-rate-limit-slowapi
 ├── C-04 pagos-autorizacion-propietario
 │     └── C-05 pagos-webhook-firma-idempotencia ──┐
 └── C-06 datos-migraciones-alembic                │
       └── C-07 datos-seed-y-catalogos             │
             └── C-09 pedidos-fsm-en-camino  (+C-08)
                   ├── C-10 pedidos-stock-descuento      [PA-03]
                   ├── C-11 pedidos-contrato-api-y-categorias
                   └── C-12 pagos-checkout-api-cardpayment (+C-05) [PA-05]

FASE 1 (frontend sobre base corregida)  [PA-01]
C-13 fe-foundation-spa (C-02, C-11)
 ├── C-14 fe-auth-cuenta
 ├── C-15 fe-direcciones
 ├── C-16 fe-catalogo-publico
 │     └── C-18 fe-carrito-personalizacion
 │           └── C-19 fe-checkout-pedido (+C-10, C-11, C-15)
 │                 ├── C-20 fe-pago-mercadopago (+C-12)
 │                 └── C-21 fe-mis-pedidos-seguimiento (+C-11)
 ├── C-17 fe-admin-catalogo-stock (+C-08)
 ├── C-22 fe-gestion-operativa-pedidos (+C-09, C-11)
 │     └── C-24 fe-dashboard-metricas
 └── C-23 fe-admin-usuarios-roles (+C-08)
C-25 calidad-tests-docs-entrega (todo lo anterior de Fase 0 y 1)

FASE 2 (opcional/bloqueado: PA-07, PA-19)
C-26 rol-cocina-kds (C-09, C-08) ── C-27 websocket-tiempo-real (C-09) ── C-28 extras-cloudinary-unidades-ratelimit-global
```

### Paralelismo por fase

```
GATE 0: C-01 ✓                                          ← FORK
  → C-02 auth-sesion-tokens-bearer-refresh   [Agente A — CRITICO]
  → C-04 pagos-autorizacion-propietario       [Agente B — CRITICO]
  → C-06 datos-migraciones-alembic            [Agente C]
  → C-03 auth-rate-limit-slowapi              [Agente A, tras C-02 o en paralelo si hay capacidad]

GATE 1: C-04 ✓ / C-06 ✓ / C-02 ✓
  → C-05 pagos-webhook-firma-idempotencia     [Agente B — si C-04 ✓]
  → C-07 datos-seed-y-catalogos               [Agente C — si C-06 ✓]
  → C-08 rbac-multirol-permisos-stock         [Agente A — si C-02 ✓]

GATE 2: C-07 ✓ + C-08 ✓
  → C-09 pedidos-fsm-en-camino                [Agente A]

GATE 3: C-09 ✓                                          ← FORK
  → C-10 pedidos-stock-descuento              [Agente A] [PA-03]
  → C-11 pedidos-contrato-api-y-categorias    [Agente C]
  → C-12 pagos-checkout-api-cardpayment       [Agente B — si C-05 ✓] [PA-05]

GATE 4: C-02 ✓ + C-11 ✓  (inicio Fase 1)
  → C-13 fe-foundation-spa                    [Agente C]  [PA-01]

GATE 5: C-13 ✓                                          ← FORK
  → C-14 fe-auth-cuenta                       [Agente C]
  → C-16 fe-catalogo-publico                  [Agente C]
  → C-15 fe-direcciones                       [Agente B]
  → C-17 fe-admin-catalogo-stock              [Agente A — si C-08 ✓]
  → C-22 fe-gestion-operativa-pedidos         [Agente B — si C-09, C-11 ✓]
  → C-23 fe-admin-usuarios-roles              [Agente A — si C-08 ✓]

GATE 6: C-16 ✓ → C-18 ; C-18 + C-15 + C-10 ✓ → C-19 ; C-19 ✓ →
  → C-20 fe-pago-mercadopago                  [Agente B — si C-12 ✓]
  → C-21 fe-mis-pedidos-seguimiento           [Agente C]
  → C-24 fe-dashboard-metricas                [Agente A — si C-22 ✓]

GATE 7: Fase 0 y Fase 1 ✓ → C-25 calidad-tests-docs-entrega (todos)
GATE 8 (opcional): PA-07 y PA-19 resueltas → C-26, C-27, C-28
```

Si **PA-01 = "sin frontend"**: se descartan C-13..C-24; C-25 pasa a depender solo de Fase 0 y la Fase 1 queda reducida a auditoría de contrato (las features backend ya existen).

### Camino crítico (9 changes — mínimo irreducible)

`C-01 → C-06 → C-07 → C-09 → C-11 → C-13 → C-19 → C-20* → C-25`

\* C-20 requiere además C-12 (rama paralela `C-05 → C-12`), que también debe estar completa antes de C-20. Los changes de seguridad (C-02, C-04, C-05) no están en el camino crítico pero tienen **prioridad de ejecución** por regla de Fase 0.

### Plan óptimo con 3 agentes

| Paso | Agente A (Backend Core: auth/pedidos) | Agente B (Backend Aux: pagos/datos) | Agente C (Frontend / datos) |
|------|--------------------------------------|-------------------------------------|-----------------------------|
| 1 | C-01 | — | — |
| 2 | C-02 | C-04 | C-06 |
| 3 | C-08 | C-05 | C-07 |
| 4 | C-03 | — | — |
| 5 | C-09 | — | — |
| 6 | C-10 | C-12 | C-11 |
| 7 | C-17 | C-15 | C-13 |
| 8 | C-23 | C-22 | C-14 + C-16 |
| 9 | C-24 | — | C-18 |
| 10 | — | — | C-19 |
| 11 | — | C-20 | C-21 |
| 12 | C-25 | C-25 | C-25 |

(Pasos 4 y 5 pueden solaparse: C-03 no bloquea C-09. En el paso 7, C-17 y C-15 requieren C-13: ajustar si C-13 aún no terminó.)

---

## FASE 0 — Corrección de deuda técnica (spec = objetivo)

> Seguridad y pagos primero. Cada change agrupa filas de la tabla DT por dominio; ninguno es un change por fila. Tras C-01 se abren C-02, C-04 y C-06 en paralelo.

### [C-01] `baseline-backend`
- **Estado**: `[ ]` pendiente
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
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-07, DT-11, DT-12.
  - Transporte del access token por `Authorization: Bearer`; retirar cookie HttpOnly como único medio (cookie `secure` configurable solo si PA-04 la mantiene como complemento).
  - `GET /auth/me` (reemplaza `/usuarios/me` como contrato de sesión).
  - `POST /auth/refresh`: rotación del refresh token, hash SHA-256, uso de `revoked_at`; comparación de fechas aware vs naive corregida.
  - `POST /auth/logout`: revoca (marca `revoked_at`), no borra la fila; 204.
  - Registro con email duplicado devuelve 409 (no 403).
  - Tests: login/refresh/rotación, reuso de refresh revocado, logout efectivo, expiración, 409.
  - Renombrar los módulos `auth` y `refreshtokens` a los nombres de la estructura de la spec (se reescriben en este change).
- **Dependencias**: `C-01`
- **Governance**: CRITICO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-04]` dónde guarda el frontend el refresh token (el backend lo soporta por body; no bloquea).
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
  - Tests: umbral de 5 fallos, ventana, reset tras login correcto, otras rutas sin límite.
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
  - Tests: firma válida/inválida, reentrega duplicada, fallo a mitad de transacción, actor Sistema.
- **Dependencias**: `C-04`
- **Governance**: CRITICO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-08]` reembolso / cancelación ante pago `cancelled` (fuera de este scope).
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md` (todo)
  - `knowledge-base/07_flujos_principales.md` §Webhook
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos (RN-PA-02..04), RN-PE-02
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-07, DT-06, DT-13, DT-20, DT-21)

### [C-06] `datos-migraciones-alembic`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-09 (parte datos). Inicializar `backend/alembic/`; migración 001 con el esquema completo actual (PK semántica `codigo`, `deleted_at/created_at/updated_at`, índices parciales `UniqueAuditableMixin`, `INTEGER[]` de personalización).
  - Quitar `SQLModel.metadata.create_all` del `lifespan` y del seed (los tests ya corren sobre PostgreSQL real desde C-01, PA-10 resuelta).
  - Verificar `alembic upgrade head` sobre BD vacía (CE-04).
  - Tests: upgrade/downgrade, esquema == modelos.
  - La fixture de tests (`backend/tests/conftest.py`, hoy `drop_all` + `create_all` sobre `foodstore_test`) debe pasar a `alembic upgrade head`.
- **Dependencias**: `C-01`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` (ERD y entidades)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-04, DD-05, DD-06, DD-15, DT-09)
  - `knowledge-base/13_rubrica_y_entrega.md` (CE-04)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-10, PA-15)

### [C-07] `datos-seed-y-catalogos`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-23 y la parte de seed de DT-03. `backend/app/db/seed.py` idempotente: Roles (ADMIN, STOCK, PEDIDOS, CLIENT), EstadoPedido con 6 estados incl. `EN_CAMINO` y orden correcto (`CANCELADO` sin `orden=99`), FormaPago `MERCADOPAGO/EFECTIVO/TRANSFERENCIA` (no `TARJETA`), admin con `Admin1234!`.
  - Migración 002 si hay cambios de catálogo/órdenes.
  - Tests: seed idempotente (2 corridas), contenido exacto de catálogos.
- **Dependencias**: `C-06`
- **Governance**: ALTO
- **Leer antes**:
  - `knowledge-base/04_modelo_de_datos.md` §Seed data inicial
  - `knowledge-base/05_reglas_de_negocio.md` §FSM (RN-PE)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-03, DT-23)
  - `knowledge-base/06_funcionalidades.md` (US-029)

### [C-08] `rbac-multirol-permisos-stock`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-14, DT-16. Autorización multi-rol: evaluar todos los roles del usuario (no `roles[0]`); eliminar `KeyError` para STOCK.
  - Permisos STOCK: solo `stock`/`disponible` (`PATCH /productos/{id}/disponibilidad`) y lectura de ingredientes; categorías/ingredientes de escritura según matriz RBAC; auditar router de productos (PA-09).
  - Tests: matriz RBAC por rol y combinaciones multi-rol.
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
  - Confirmación: CONFIRMADO automático por pago; la transición manual PENDIENTE→CONFIRMADO para EFECTIVO/TRANSFERENCIA queda según PA-06 (por defecto: solo ADMIN/PEDIDOS y solo para esas formas de pago).
  - Tests: cada transición válida/inválida por rol, historial, cancelación solo en PENDIENTE/CONFIRMADO con motivo.
- **Dependencias**: `C-07, C-08`
- **Governance**: ALTO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-06]` confirmación de pedidos EFECTIVO/TRANSFERENCIA; `[PENDIENTE DE DECISIÓN: PA-07]` quién despacha EN_CAMINO (por defecto ADMIN/PEDIDOS).
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Pedidos y FSM (RN-PE)
  - `knowledge-base/07_flujos_principales.md` §Ciclo operativo
  - `knowledge-base/04_modelo_de_datos.md` (EstadoPedido, HistorialEstadoPedido)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-11, DT-03, DT-15)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-06, PA-07)

### [C-10] `pedidos-stock-descuento`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-04. Verificar `disponible` y stock al crear el pedido (errores claros: no disponible, sin stock).
  - Momento del descuento: **supuesto por defecto = mantener el código actual** (al crear el pedido PENDIENTE, restaura en toda cancelación) hasta resolver PA-03; encapsular en un único método de `StockService` para poder cambiar a "al confirmar pago" y/o TTL de PENDIENTE sin tocar el resto.
  - Tests: descuento, restauración en cancelación, concurrencia (dos pedidos sobre el último stock), atomicidad en UoW.
- **Dependencias**: `C-09`
- **Governance**: ALTO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-03]` momento del descuento de stock y TTL de pedidos impagos; puede reordenar/expandir este change y C-05.
- **Leer antes**:
  - `knowledge-base/05_reglas_de_negocio.md` §Stock (RN-ST), RN-PE-06, RN-PE-10
  - `knowledge-base/07_flujos_principales.md` §Compra y §Cancelación
  - `knowledge-base/09_decisiones_y_supuestos.md` (DT-04, DD-16)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-12)

### [C-11] `pedidos-contrato-api-y-categorias`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Cubre DT-17, DT-18, DT-19.
  - Contrato de pedidos: `PATCH /pedidos/{id}/estado` body `{nuevo_estado, motivo}`; `GET /pedidos/{id}` propietario/roles; `DELETE /pedidos/{id}` cancela el propio pedido (no soft delete solo-ADMIN); retirar `/mis-pedidos/...` y `estado_hacia` (o alias deprecado).
  - Paginación `page/size` → `{items,total,page,size,pages}` en todos los listados; errores `{detail, code, field}` en toda la API incl. 429.
  - Borrado de categoría: soft delete validando productos asociados e hijas (no re-asignar al abuelo sin validar).
  - Migración 003 solo si cambia esquema.
  - Tests: contrato por endpoint, paginación, forma de errores, borrado con productos.
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
  - Cubre DT-01. Migrar de Checkout Pro (preferencia + `init_point`) a Checkout API/Orders con token de tarjeta (`CardPayment` brick): `POST /pagos/crear` recibe `token`, `payment_method_id`, `installments`, `issuer_id`; la tarjeta nunca toca el backend (SAQ-A); `X-Idempotency-Key`.
  - Reintento tras rechazo; `GET /pagos/{pedido_id}` con `mp_status_detail`.
  - Mantener el webhook de C-05 como confirmación.
  - Tests con sandbox mockeado: aprobado, rechazado, pendiente, reintento.
  - Al retirar el redirect de Checkout Pro se eliminan `FRONTEND_URL` y `BACKEND_PUBLIC_URL` (opcionales, introducidas en C-01). El chequeo «MercadoPago no configurado» (503, formato uniforme `{detail, code, field}`) debe conservarse en el flujo nuevo.
- **Dependencias**: `C-05, C-09`
- **Governance**: CRITICO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-05]` si Checkout Pro se acepta como etapa intermedia; de ser así este change se difiere sin afectar C-19/C-20 (usarían redirect).
- **Leer antes**:
  - `knowledge-base/11_pagos_mercadopago.md` §Modalidades, §Flujo de cobro, §Sandbox
  - `knowledge-base/05_reglas_de_negocio.md` §Pagos (RN-PA)
  - `knowledge-base/07_flujos_principales.md` §Compra
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-07, DT-01)
  - `knowledge-base/10_preguntas_abiertas.md` (PA-05)

---

## FASE 1 — Features por épica (sobre base corregida)

> Todo el bloque frontend depende de `[PENDIENTE DE DECISIÓN: PA-01]` (alcance incluye frontend). Se planifica asumiendo SÍ (DT-24, SU-01). Los changes visuales deben tener mockup aprobado (Revision 1 del design system) antes de apply.

### [C-13] `fe-foundation-spa`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - Proyecto Vite + React + TS + Tailwind en estructura FSD; `VITE_API_URL`; importar `design-system/tokens.css`.
  - Cliente Axios con interceptor: `Authorization: Bearer`, ante 401 llama `/auth/refresh`, actualiza `authStore` y reintenta (US-003).
  - 4 stores Zustand (`authStore` persistiendo solo `accessToken`, `cartStore`, etc.); TanStack Query provider; router con rutas protegidas por rol; layout base y manejo de errores `{detail, code, field}`.
  - Tests: interceptor (refresh + reintento), guards de ruta.
- **Dependencias**: `C-02, C-11`
- **Governance**: ALTO
- **UI**: `[UI-MOCKUP]` layout/shell y navegación. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (Zustand), §Seguridad
  - `knowledge-base/02_descripcion_general.md`
  - `knowledge-base/06_funcionalidades.md` (US-003)
  - `knowledge-base/13_rubrica_y_entrega.md`

### [C-14] `fe-auth-cuenta`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-001 registro, US-002 login (mensajes 401/409/429), US-004 logout, US-005 perfil propio (`GET/PATCH` perfil sin tocar roles).
  - Páginas `Login`, `Register`, `Perfil`; validación con TanStack Form.
  - Tests: formularios y flujos de error.
- **Dependencias**: `C-13`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` login, registro, perfil. `[PENDIENTE DE DECISIÓN: PA-01]`
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
- **Dependencias**: `C-13`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` listado/formulario de direcciones. `[PENDIENTE DE DECISIÓN: PA-01]`
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
- **Dependencias**: `C-13`
- **Governance**: BAJO
- **UI**: `[UI-MOCKUP]` catálogo, detalle de producto, navegación por categorías. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-007, US-008)
  - `knowledge-base/05_reglas_de_negocio.md` §Productos (RN-PR-03, RN-PR-04), RN-CA
  - `knowledge-base/07_flujos_principales.md` §Catálogo

### [C-17] `fe-admin-catalogo-stock`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-009 categorías (nombre único, anti-ciclos), US-010 productos (ADMIN/STOCK; `disponible` por PATCH), US-011 ingredientes y alérgenos (`es_alergeno`, `es_removible`), US-012 stock (rol STOCK limitado a stock/disponibilidad).
  - Vistas condicionadas por rol (RBAC alineado con C-08).
  - Imágenes y unidades de medida (US-013, US-014) quedan en C-28.
  - Tests: permisos por rol en UI, CRUDs.
- **Dependencias**: `C-13, C-08`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` pantallas de administración de catálogo. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 3 (US-009..US-012)
  - `knowledge-base/03_actores_y_roles.md` §Matriz RBAC
  - `knowledge-base/05_reglas_de_negocio.md` RN-CA, RN-PR
  - `knowledge-base/04_modelo_de_datos.md` (Producto, Ingrediente)

### [C-18] `fe-carrito-personalizacion`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-015 carrito persistente en localStorage (sobrevive refresh, cierre y logout/login, CE-14), suscripción por slice a `cartStore`.
  - US-016 personalizar producto: excluir ingredientes removibles (`personalizacion` = IDs).
  - Tests: persistencia, personalización, totales.
- **Dependencias**: `C-16`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` drawer/página de carrito y selector de personalización. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 4 (US-015, US-016)
  - `knowledge-base/08_arquitectura_propuesta.md` §Estado del cliente (Zustand)
  - `knowledge-base/09_decisiones_y_supuestos.md` (DD-03, DD-05)

### [C-19] `fe-checkout-pedido`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-017: elegir dirección (o retiro en local) y forma de pago; crear pedido PENDIENTE en una transacción; manejo de errores (no disponible, sin stock, forma de pago deshabilitada, líneas duplicadas).
  - Costo de envío / descuento según DD-10 (50.00 / 0) hasta resolver PA-11/PA-13.
  - Tests: éxito, cada error, EFECTIVO/TRANSFERENCIA.
- **Dependencias**: `C-18, C-15, C-10, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` flujo de checkout. `[PENDIENTE DE DECISIÓN: PA-01]`, `[PENDIENTE DE DECISIÓN: PA-03]` (mensajes de stock), PA-06 (pasos para efectivo).
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-017
  - `knowledge-base/07_flujos_principales.md` §Compra
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-06, RN-PE-09, RN-ST-01
  - `knowledge-base/10_preguntas_abiertas.md` (PA-03, PA-06, PA-11, PA-13)

### [C-20] `fe-pago-mercadopago`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-024 pago con `CardPayment` brick (o redirect si PA-05 difiere C-12), reintento tras rechazo; US-025 reflejo de la confirmación por webhook (polling del estado); US-026 estado de pago con `mp_status_detail`.
  - Pantallas de éxito/pendiente/rechazo.
  - Tests: aprobado, rechazado, reintento (MP mockeado).
- **Dependencias**: `C-19, C-12`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` pantalla de pago y resultados. `[PENDIENTE DE DECISIÓN: PA-01]`, PA-05
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
- **UI**: `[UI-MOCKUP]` mis pedidos, detalle y timeline. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-018, US-019
  - `knowledge-base/05_reglas_de_negocio.md` RN-PE-07, RN-PE-10, RN-ST-02
  - `knowledge-base/07_flujos_principales.md` §Cancelación

### [C-22] `fe-gestion-operativa-pedidos`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-020 avanzar estado (PEDIDOS/ADMIN) con motivo/observación, incluye EN_CAMINO; US-021 todos los pedidos con filtros estado/fecha e historial; US-022 cancelar/eliminar (ADMIN/PEDIDOS).
  - Acciones visibles según FSM y rol.
  - Tests: botones según estado/rol, historial.
- **Dependencias**: `C-13, C-09, C-11`
- **Governance**: MEDIO
- **UI**: `[UI-MOCKUP]` tablero de gestión de pedidos. `[PENDIENTE DE DECISIÓN: PA-01]`, PA-06, PA-07
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` Épica 5 (US-020..US-022)
  - `knowledge-base/05_reglas_de_negocio.md` §Pedidos y FSM (RN-PE)
  - `knowledge-base/07_flujos_principales.md` §Ciclo operativo

### [C-23] `fe-admin-usuarios-roles`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-027 ADMIN: crear usuario con roles (multi-rol), listar paginado con filtro por rol, actualizar roles, desactivar (soft delete).
  - Tests: asignación multi-rol, filtros.
- **Dependencias**: `C-13, C-08`
- **Governance**: CRITICO
- **UI**: `[UI-MOCKUP]` administración de usuarios. `[PENDIENTE DE DECISIÓN: PA-01]`
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
- **UI**: `[UI-MOCKUP]` dashboard. `[PENDIENTE DE DECISIÓN: PA-01]`
- **Leer antes**:
  - `knowledge-base/06_funcionalidades.md` US-028
  - `knowledge-base/07_flujos_principales.md` §Dashboard
  - `knowledge-base/02_descripcion_general.md`

### [C-25] `calidad-tests-docs-entrega`
- **Estado**: `[ ]` pendiente
- **Scope**:
  - US-029 seed/arranque reproducible (`alembic upgrade head` + seed + dev), US-030 Swagger `/docs`, README con setup, `.env.example` final, `docker-compose` para BD.
  - Cobertura pytest > 60% (auth, pedidos, pagos, categorías, direcciones, ingredientes, productos, estadísticas); prueba end-to-end del flujo compra→pago→entrega.
  - DT-25 (capas): sacar `Session`/`get_session` de los routers de `categorias`, `ingredientes`, `pagos`, `pedidos` y `productos` (delegar al service) y cortar la dependencia `core/deps.py` → `modules/`; si un change anterior toca alguno de esos routers, lo corrige ahí.
  - Checklist de entrega de la rúbrica de 200 pts; metadatos faltantes (PA-18); deploy opcional (PA-17).
  - Verificación visual contra mockups aprobados (si hay frontend).
  - Renombrar `direcciones_entrega` → `direcciones`, `admin`, `core/unit_of_work.py` → `core/uow.py` y el resto de los módulos a la estructura objetivo de la spec (`knowledge-base/08` §Estructura).
- **Dependencias**: `C-01 a C-12`; si PA-01 = sí también `C-13 a C-24`
- **Governance**: MEDIO
- **Decisión pendiente**: `[PENDIENTE DE DECISIÓN: PA-01]` (alcance), PA-16, PA-17, PA-18
- **Leer antes**:
  - `knowledge-base/13_rubrica_y_entrega.md`
  - `knowledge-base/08_arquitectura_propuesta.md` §Testing
  - `knowledge-base/06_funcionalidades.md` Épica 8
  - `knowledge-base/10_preguntas_abiertas.md` (PA-10, PA-16, PA-17, PA-18)

---

## FASE 2 — Extras fuera de la spec `[OPCIONAL/BLOQUEADO]`

> No iniciar hasta resolver **PA-07** (rol COCINA/KDS: ¿se incorpora a la spec o se elimina?) y **PA-19** (extras del código: ¿formalizar o descartar?). Si se descartan, estos changes pasan a "eliminar el extra del código" en lugar de construirse.

### [C-26] `rol-cocina-kds`
- **Estado**: `[ ]` pendiente `[OPCIONAL/BLOQUEADO: PA-07, PA-19]`
- **Scope**:
  - Cubre DT-02 y US-023. Según decisión: (a) formalizar rol `COCINA` (seed, `require_role`, permisos de FSM CONFIRMADO→EN_PREP, `GET /pedidos/cocina/pedidos`) y pantalla KDS; o (b) retirar `COCINA` del código y reasignar.
  - Tests según la opción elegida.
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
  - Tests: conexión, disconnect, rooms, autorización.
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
- **Dependencias**: `C-17, C-03`
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
| 0 — Deuda técnica | 12 | C-01..C-12 | Cubre DT-01, 03..07, 09..23 (DT-02 y DT-08 en Fase 2; DT-24 en Fase 1) |
| 1 — Features | 13 | C-13..C-25 | Frontend sujeto a PA-01; changes `[UI-MOCKUP]`: C-13..C-24 |
| 2 — Extras | 3 | C-26..C-28 | Opcional/bloqueado por PA-07, PA-19 |

Governance CRITICO: C-02, C-04, C-05, C-08, C-12, C-14, C-20, C-23. ALTO: C-03, C-06, C-07, C-09, C-10, C-13, C-27.

**Primer change recomendado**: `C-01` (`baseline-backend`) → `/opsx:propose C-01-baseline-backend`. Luego, en paralelo, C-02, C-04 y C-06.
