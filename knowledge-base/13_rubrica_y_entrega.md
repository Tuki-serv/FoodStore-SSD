# Rúbrica de Corrección y Entrega

Extra de contexto académico: define cómo se evalúa el proyecto. Fuente principal `[INT]` §12-13; `[DESC]` §14-15 la describe en prosa con otra numeración de CE. Metadatos de la portada de `[INT]`: **Materia** y **Carrera** vacíos (PA-18); Modalidad = Trabajo Práctico Integrador (TPI); versión del documento 5.0 (ERD v5 + Arquitectura SDD + Diagramas + Feature-First).

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

## Estado frente a la rúbrica (backend actual)

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

La rúbrica evalúa contra la spec v5.0; cada celda "Estado observado" es el código actual y su distancia al objetivo es deuda técnica (ver DT-xx).

| Área | Estado observado en el código actual |
|------|-----------------------------|
| Estructura backend | Capas + módulos por dominio; core separado; **sin Alembic**; entry en raíz (DT-09) |
| Modelo de datos | Completo y con extras (UnidadMedida); sin `direccion_snapshot` |
| UoW/Repo | UoW genérico y por módulo; `BaseRepository`; service de categorías/pagos usan sesión directa en algunos puntos (`PaymentService` usa `self._session.get`) |
| Servicio | FSM por rol; RN de historial/terminal/motivo cubiertas; EN_CAMINO ausente (DT-03) |
| REST | `/api/v1`, schemas separados; paginación mixta; sin 402 definido |
| MercadoPago | SDK + webhook + tabla Pago; idempotency_key generado pero no usado para dedupe; Checkout Pro (DT-01, DT-05, DT-06, DT-20) |
| Frontend | No incluido (DT-24) |
| Tests | Suite de integración y unit del rate limiter (potencial bonus) |
| Deploy | No evidenciado |
