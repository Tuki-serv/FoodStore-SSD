# Rúbrica de Corrección y Entrega

Extra de contexto académico: define cómo se evalúa el proyecto. Fuente principal `[INT]` §12-13; `[DESC]` §14-15 la describe en prosa con otra numeración de CE. Metadatos de la portada de `[INT]`: **Materia** y **Carrera** vacíos en el documento; completados en `docs/entrega/metadatos.md` (PA-18 resuelta, 2026-11-23); Modalidad = Trabajo Práctico Integrador (TPI); versión del documento 5.0 (ERD v5 + Arquitectura SDD + Diagramas + Feature-First).

## Rúbrica v5.0 (200 puntos)

Corrección escrita + **video de demostración obligatorio**.

| Criterio | Pts | Excelente (resumen) |
|----------|-----|---------------------|
| Backend — Estructura y configuración | 10 | Capas router/service/uow/repository/model, módulos por dominio, `core/` separado, Alembic + seed, CORS + rate limiting |
| Backend — Modelo de datos | 15 | SQLModel correcto, constraints, soft delete, snapshot, entidades completas (Ingrediente, FormaPago, DireccionEntrega, RefreshToken, Pago) |
| Backend — Unit of Work y Repository | 15 | UoW con context manager y commit/rollback automático; `BaseRepository[T]`; ningún service hace `session.commit()` |
| Backend — Capa de servicio | 15 | FSM implementada; RN-01/02/03/05 validadas; services stateless que reciben el `uow` |
| Backend — Controladores REST | 15 | Verbos y rutas semánticas, status precisos (201/204/422/402), prefijo `/api/v1`, schemas Read/Create/Update |
| Backend — MercadoPago | 15 | SDK Python con `idempotency_key` UUID; webhook `/pagos/webhook` que procesa `topic=payment` y avanza pedido; tabla Pago completa |
| Frontend — Estructura y TypeScript | 10 | Feature-sliced sin cross-imports; `strict: true`, sin `any` |
| Frontend — Zustand | 10 | 4 stores tipados, `persist` correcto, suscripción por slice |
| Frontend — TanStack Query | 15 | `useQuery/useMutation` para todo el fetch, `queryKeys` descriptivos, invalidación tras mutaciones, interceptor refresh 401 |
| Frontend — Funcionalidades cliente | 15 | Catálogo con debounce/filtros/paginación/skeleton, carrito persistente, checkout con CardPayment, timeline con polling 30 s |
| Frontend — Panel Admin | 15 | Dashboard KPIs + recharts, CRUD categorías/productos con relaciones, gestión de pedidos con FSM, gestión de stock |
| UI/UX y diseño | 10 | Sistema de diseño consistente, mobile-first, skeletons, toasts, modales de confirmación, estados vacíos |
| Calidad de código | 10 | Convenciones snake_case/camelCase/PascalCase, funciones < 50 líneas, SRP, docstrings/JSDoc, README completo |

Escala: 181-200 Excelente (90-100%); 141-180 Bueno (70-89%); 101-140 Regular (50-69%); 0-100 Insuficiente.
**Bonus** +10 tests unitarios con pytest cobertura > 60% (`test_pedidos`, `test_pagos`, `test_auth`); +10 deploy funcional (Railway/Render/Fly.io) con URL accesible.
**Penalización** −30% si el proyecto no corre localmente siguiendo el README (`[DESC]` también lo aplica a plagio y a artefactos faltantes; commit único masivo es penalizado).

## Checklist de entrega

| ID | Ítem (`[INT]`) |
|----|----------------|
| CE-01 | Link a repositorio GitHub **público** en la entrega |
| CE-02 | `README.md` con setup funcionando en máquina limpia |
| CE-03 | `.env.example` completo, con variables MercadoPago documentadas |
| CE-04 | `alembic upgrade head` sin errores |
| CE-05 | `python -m app.db.seed` carga datos iniciales |
| CE-06 | `npm install` + `npm run dev` sin errores |
| CE-07 | `pip install -r requirements.txt` + `uvicorn app.main:app` sin errores |
| CE-08 | Swagger UI (`/docs`) con todos los endpoints documentados |
| CE-09 | Pago de prueba con tarjeta sandbox MP end-to-end |
| CE-10 | UoW correcto (ningún `service.session.commit()` directo) |
| CE-11 | 4 stores Zustand implementados, tipados, con `persist` correcto |
| CE-12 | Screenshots de al menos 10 pantallas distintas |
| CE-13 | Link a video de demostración (5-10 min) en el README |
| CE-14 | Repositorio público verificado con sesión cerrada |

`[DESC]` define otra lista CE-01..CE-14 (repo Git con historial progresivo, README, `.env.example`, migraciones, seed, backend funcional, frontend funcional, flujo de auth completo, CRUD productos, flujo de pedidos completo con RN-01..05, integración MP sandbox, control de acceso por roles, snapshots e inmutabilidad, carrito persistente incluso tras logout/login). Los criterios de `[DESC]` adicionales relevantes: **snapshot de direcciones** (IN-15) y **carrito sobrevive a logout/login** (el `cartStore` no debe limpiarse al cerrar sesión).

## Referencias externas (apéndice `[INT]`)

FastAPI, SQLModel, Pydantic v2, Alembic, TanStack Query v5, TanStack Form, Zustand, Tailwind CSS, recharts, slowapi, MercadoPago Developers AR, SDK Python y SDK React de MercadoPago (URLs oficiales en el apéndice del documento).

## Estado frente a la rúbrica (al cierre de C-25b, 2026-11-25)

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo. El detalle por criterio, con su evidencia (tests, capturas, recorrido E2E, video), vive en [docs/entrega/checklist-rubrica.md](../docs/entrega/checklist-rubrica.md); esta tabla es el resumen. Deuda que sigue abierta: tabla consolidada en [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada) y «Limitaciones conocidas» del README.

| Área | Estado |
|------|--------|
| Backend (estructura, modelo, UoW/Repository, servicio, REST) | Cumplido: capas `router → service → unit of work → repository → models` verificadas por test, Alembic, seed, FSM del pedido con historial append-only, `/api/v1` con Swagger completo |
| MercadoPago | Cumplido: Checkout API con `CardPayment`, `idempotency_key`, webhook con firma verificada e idempotente; pago sandbox end-to-end verificado (CE-09, 2026-11-24) |
| Frontend (estructura, Zustand, TanStack Query, cliente, admin) | Cumplido: FSD con TypeScript estricto, 4 stores, TanStack Query con refresh en 401, recorrido de compra a entrega y panel admin con dashboard |
| UI/UX | Cumplido: design system Revision 4 aprobado, mockups por change, verify visual de 17 pantallas (0 blocker) |
| Calidad y entrega | Cumplido: README como guía única probada en clon limpio, checklist CE-01..CE-14 completo, capturas, repo público y video (CE-13, 14:38, por encima de los 10 min de la consigna por decisión del usuario) |
| Bonus tests (+10) | Cumplido: `pytest --cov` con piso del 60 % |
| Bonus deploy (+10) | Sin reclamar: sin deploy por decisión del usuario (PA-17) |
| Diferidos (X1–X4 de C-25b1) | Documentados como limitaciones en el README: idempotencia de creación de pedidos (X1), envío de $50 también en retiro (X2, PA-13), filtros en UTC sin multi-estado ni búsqueda (X3), escala por defecto de Tailwind (X4) |
