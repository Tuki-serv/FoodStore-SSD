# Checklist de la rúbrica y de entrega

Estado al 2026-11-21 (rama `dev`, con `c-25b1-deuda-heredada` archivado). Fuente de los criterios: [knowledge-base/13_rubrica_y_entrega.md](../../knowledge-base/13_rubrica_y_entrega.md).

Estados: **cumplido** (hay evidencia verificable en el repo), **parcial** (hay evidencia pero falta algo) y **pendiente** (depende del usuario o de la revisión final). La puntuación la asigna el docente: aquí solo se declara si el criterio está cubierto, no cuántos puntos vale el resultado.

> Evidencia que todavía no existe (capturas, ejecución del recorrido E2E, video) figura como pendiente: se completa cuando el usuario revise la aplicación y se ejecute el recorrido (tareas 2.2, 3.1, 3.2 y 5.x de `openspec/changes/c-25b-entrega-docs-video/`).

## Criterios de la rúbrica (200 puntos)

| Criterio | Pts | Estado | Evidencia |
|----------|-----|--------|-----------|
| Backend — Estructura y configuración | 10 | cumplido | Capas y módulos por dominio en `backend/app/modules/`, `core/` separado, migraciones Alembic (`backend/alembic/`), seed (`backend/app/db/seed.py`), CORS y rate limiting; `backend/tests/unit/test_arquitectura_capas.py`, `backend/tests/integration/test_rate_limit.py` |
| Backend — Modelo de datos | 15 | cumplido | Modelos SQLModel por módulo, constraints, soft delete, snapshot de precios y nombres en el pedido; `backend/tests/integration/test_migrations.py` (esquema == modelos) |
| Backend — Unit of Work y Repository | 15 | cumplido | `BaseRepository` genérico y UoW con commit/rollback; `backend/tests/unit/test_unit_of_work.py` (commit/rollback del UoW) y `backend/tests/unit/test_arquitectura_capas.py` (dependencias en un solo sentido); búsqueda de `commit(` sin resultados en `backend/app/modules/` (2026-11-21) |
| Backend — Capa de servicio | 15 | cumplido | FSM del pedido y reglas RN; `backend/tests/unit/test_pedido_fsm.py`, `backend/tests/integration/test_pedidos_fsm.py`, `backend/tests/integration/test_pedidos_stock.py` |
| Backend — Controladores REST | 15 | cumplido | Prefijo `/api/v1`, schemas Read/Create/Update y códigos de estado; `backend/tests/integration/test_contrato_rutas.py`, `backend/tests/integration/test_openapi_documentacion.py` |
| Backend — MercadoPago | 15 | parcial | SDK + webhook con firma verificada e idempotente + tabla de pagos (`backend/tests/integration/test_pago_webhook_*.py`); el pago con tarjeta sandbox end-to-end lo ejecuta el usuario (ver CE-09) |
| Frontend — Estructura y TypeScript | 10 | cumplido | Feature-Sliced Design y `strict: true` sin `any`; `frontend/tests/architecture/fsd-boundaries.test.ts`, `npm run typecheck`, `npm run lint` |
| Frontend — Zustand | 10 | cumplido | 4 stores tipados: `frontend/src/shared/auth/auth-store.ts`, `frontend/src/entities/cart/model/cart-store.ts`, `frontend/src/shared/model/ui-store.ts`, `frontend/src/entities/payment/model/payment-store.ts`; `frontend/src/entities/cart/__tests__/cart-store.test.ts` |
| Frontend — TanStack Query | 15 | cumplido | `useQuery`/`useMutation` con claves jerárquicas e invalidación tras mutaciones, interceptor de refresh en 401; `frontend/src/shared/api/` y su sección en `frontend/README.md` |
| Frontend — Funcionalidades cliente | 15 | parcial | Catálogo con debounce, filtros y paginación, carrito persistente, checkout con `CardPayment` y seguimiento con polling (`frontend/src/pages/`); falta la ejecución registrada del recorrido y las capturas (pendiente de la revisión del usuario) |
| Frontend — Panel Admin | 15 | parcial | Dashboard con KPIs y recharts, CRUD de categorías, productos e ingredientes, gestión de pedidos con FSM y usuarios (`frontend/src/pages/admin-*`, `gestion-pedidos`); falta la verificación visual y las capturas (pendiente) |
| UI/UX y diseño | 10 | parcial | Design system Revision 3 (`design-system/`), mockups aprobados por change en `openspec/changes/archive/*/mockups/`, skeletons, toasts, modales de confirmación y estados vacíos; falta el verify visual pantalla por pantalla (tarea 3.2, pendiente) |
| Calidad de código | 10 | parcial | Convenciones, funciones acotadas, docstrings y READMEs por parte; README raíz como guía única; falta la prueba del README en máquina limpia por el usuario (CE-02) |

## Bonus y penalización

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Bonus +10 — tests con pytest y cobertura mayor a 60 % | cumplido | Suite de integración y unit en `backend/tests/`; `pytest --cov` falla bajo 60 % (`backend/.coveragerc`, `fail_under = 60`); cubre pedidos, pagos y auth (`test_pedidos*.py`, `test_pago*.py`, `test_auth*.py`) |
| Bonus +10 — deploy funcional con URL accesible | pendiente | Decisión del usuario (2026-11-21, PA-17): **no se hace deploy**; el bonus de +10 queda sin reclamar |
| Penalización −30 % si el proyecto no corre siguiendo el README | pendiente | README raíz reescrito como guía única; la prueba en máquina limpia (tarea 1.4) la hace el usuario |

## Checklist de entrega (CE-01..CE-14)

| ID | Ítem | Estado | Evidencia |
|----|------|--------|-----------|
| CE-01 | Link a repositorio GitHub público en la entrega | pendiente (usuario) | El usuario publica el repositorio y registra el enlace aquí |
| CE-02 | `README.md` con setup funcionando en máquina limpia | pendiente (usuario) | [README.md](../../README.md) reescrito y verificado estáticamente (`backend/tests/unit/test_entrega_docs.py`); falta la prueba en clon limpio (tarea 1.4) |
| CE-03 | `.env.example` completo, con variables de MercadoPago documentadas | cumplido | Tres plantillas validadas por test (`backend/tests/unit/test_env_example.py`, `frontend/src/shared/config/__tests__/env-example.test.ts`); cada variable de MercadoPago de `backend/.env.example` indica de dónde sale en el panel de desarrolladores (`backend/tests/unit/test_entrega_docs.py`, 2026-11-23) |
| CE-04 | `alembic upgrade head` sin errores | cumplido | `backend/tests/integration/test_migrations.py` aplica las migraciones desde una base vacía |
| CE-05 | `python -m app.db.seed` carga datos iniciales | cumplido | `backend/app/db/seed.py` y `backend/tests/integration/test_seed.py`; cuentas en el README |
| CE-06 | `npm install` + `npm run dev` sin errores | parcial | Scripts verificados contra `frontend/package.json`; falta la corrida en máquina limpia (tarea 1.4) |
| CE-07 | `pip install -r requirements.txt` + `uvicorn app.main:app` sin errores | parcial | `backend/tests/integration/test_app_startup.py`; falta la corrida en máquina limpia (tarea 1.4) |
| CE-08 | Swagger UI (`/docs`) con todos los endpoints documentados | cumplido | `backend/tests/integration/test_openapi_documentacion.py` (C-25b1) |
| CE-09 | Pago de prueba con tarjeta sandbox de MercadoPago end-to-end | pendiente (usuario) | Lo ejecuta el usuario con ngrok y el webhook configurado (tarea 2.3); anotar el resultado en [recorrido-e2e.md](recorrido-e2e.md) |
| CE-10 | UoW correcto (ningún `service.session.commit()` directo) | cumplido | `backend/tests/unit/test_unit_of_work.py`; ningún `commit(` en `backend/app/modules/` (búsqueda del 2026-11-21) |
| CE-11 | 4 stores Zustand tipados y con `persist` correcto | cumplido | Los cuatro stores del criterio de Zustand; `cart-store` y `ui-store` usan `persist`, `auth-store` y `payment-store` viven en memoria a propósito (token de acceso y pago en curso no se persisten) |
| CE-12 | Capturas de al menos 10 pantallas distintas | pendiente | Se generan en `docs/entrega/capturas/` tras la revisión del usuario (tarea 3.1) |
| CE-13 | Link a video de demostración (5-10 min) en el README | pendiente (usuario) | El usuario graba y publica el video; el enlace se agrega al README (tareas 5.1 y 5.2) |
| CE-14 | Repositorio público verificado con sesión cerrada | pendiente (usuario) | El usuario lo abre en una ventana privada y lo marca aquí (tarea 5.3) |

## Pendientes del usuario

- Prueba en máquina o carpeta limpia siguiendo solo el README (CE-02, CE-06, CE-07; evita la penalización de −30 %).
- Pago con tarjeta sandbox (CE-09).
- Revisar la aplicación; luego se ejecuta el recorrido E2E y se capturan las pantallas (CE-12).
- Grabar y publicar el video; repositorio público (CE-01, CE-13, CE-14).
- Informar materia, carrera, equipo y docente: ver [metadatos.md](metadatos.md) (PA-18).

## Limitaciones conocidas

Ver la sección homónima del [README](../../README.md): DT-28, PA-07 (COCINA/KDS), fechas en UTC, envío fijo de $50 en retiro (PA-13), sin idempotencia al crear pedidos y escala de Tailwind por defecto.
