# Food Store — Instrucciones para Agentes

> Este archivo (y su copia `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado a partir de `knowledge-base/` y `CHANGES.md`. No editar a mano sin re-sincronizar ambos archivos.

Food Store es una tienda de comida online (React + TypeScript + FastAPI + PostgreSQL) con catálogo jerárquico, carrito persistente, pedidos gobernados por una máquina de estados con historial append-only, pago con MercadoPago (webhook IPN idempotente) y un panel de administración con métricas, protegido por JWT y RBAC de cuatro roles. Se desarrolla como TPI con SDD, evaluado sobre 200 puntos.

**Estructura del repo (C-01, D9):** la raíz es solo de gestión (`openspec/`, `knowledge-base/`, `docs/`, `design-system/`, `CHANGES.md`, `todoAMd/`); el código vive en `backend/` (`app/`, `tests/`, `pytest.ini`, `requirements.txt`, `Dockerfile`, `.env`) y `frontend/` (llega en C-13a). `docker-compose.yml` y su `.env` (solo variables de compose) viven en la **raíz** y orquestan todo el proyecto (`db`, `pgadmin`, `backend`; `frontend` en C-13a): `docker compose up -d db` se corre desde la raíz. Los comandos de backend (`pip install`, `alembic upgrade head`, `pytest`, `uvicorn app.main:app`, `python -m app.db.seed`) se corren desde `backend/`; los tests leen `backend/tests/.env.test`. Los tests nunca van en la raíz.

---

## Stack Tecnológico

| Capa | Tecnología | Versión (spec `[INT]`) | Notas |
|------|-----------|------------------------|-------|
| Frontend | React + TypeScript | 18.x + 5.x | `strict: true`, sin `any` |
| Frontend | Vite | 5.x | Bundler/dev server |
| Frontend | Tailwind CSS | 3.x | Utility-first |
| Frontend | TanStack Query | 5.x | Estado del **servidor** |
| Frontend | TanStack Form | 0.x | Formularios con validación |
| Frontend | Zustand | 4.x | Estado del **cliente** (4 stores) |
| Frontend | Axios | 1.x | Interceptors (adjuntar JWT, refresh en 401) |
| Frontend | recharts | 2.x | Gráficos del dashboard admin |
| Frontend | `@mercadopago/sdk-react` / MercadoPago.js | — | Tokenización de tarjeta (PCI SAQ-A) |
| Backend | Python | 3.10+ | |
| Backend | FastAPI | 0.111+ | REST + OpenAPI automático |
| Backend | SQLModel (SQLAlchemy + Pydantic v2) | 0.0.19+ | ORM y schemas |
| Backend | PostgreSQL | 15+ | Arrays (`INTEGER[]`, `VARCHAR[]`), CTE recursivas |
| Backend | Alembic | 1.13+ | Migraciones (ver IN-18) |
| Backend | Passlib (bcrypt) | passlib 1.7.4 / bcrypt 4.0.1 | cost factor >= 12 |
| Backend | python-jose | 3.3.0 | JWT HS256 |
| Backend | mercadopago (SDK Python) | 2.3.0+ | |
| Backend | slowapi | 0.1.10 `[INT]` | Rate limiting de login (RN-AU-08, C-03) |
| Backend | cloudinary | — | Subida de imágenes |
| Backend | pytest, httpx, pytest-asyncio, pytest-cov | | Tests con PostgreSQL 15 real, base `foodstore_test` (`backend/tests/.env.test`) |
| Infra dev | Docker Compose | | `postgres:15` (puerto host 5433) + `pgadmin4` (5050) |
| Infra dev | ngrok | | URL pública para `back_urls` y webhook MP |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md)

---

## Base de Conocimiento

La fuente de verdad del dominio vive en `knowledge-base/` (índice: [README](knowledge-base/README.md)). **Leé el archivo relevante ANTES de implementar.**

| Archivo | Cuándo leerlo |
|---------|---------------|
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Entender propósito y alcance |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Auth, RBAC, permisos |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Entidades, ERD, migraciones |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas codificadas (RN-XX), FSM del pedido |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Historias de usuario por épica |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos E2E |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Patrones, estructura, env vars |
| [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md) | Decisiones DD-xx y deuda técnica DT-01..DT-25 |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | Inconsistencias a resolver ANTES de codear |
| [11_pagos_mercadopago.md](knowledge-base/11_pagos_mercadopago.md) | Integración de pagos |
| [12_tiempo_real_websocket.md](knowledge-base/12_tiempo_real_websocket.md) | WebSocket / KDS (extra, no especificado) |
| [13_rubrica_y_entrega.md](knowledge-base/13_rubrica_y_entrega.md) | Rúbrica de 200 pts y entrega |

Otros recursos: [design-system/README.md](design-system/README.md) (Revision 1 aprobada; política `system-and-mockups`: todo change visual necesita un mockup aprobado antes de `/opsx:apply`), [openspec/](openspec/) (changes y specs).

> ⚠️ **Decisiones del usuario (2026-11-10)**: PA-01 (alcance con frontend completo), PA-03 (stock se descuenta al confirmar el pedido, sin TTL), PA-05 (Checkout API con `CardPayment`), PA-06 (confirmación manual de `EFECTIVO`/`TRANSFERENCIA` por ADMIN/PEDIDOS) y PA-04 (refresh en cookie HttpOnly, C-02) están **resueltas** (DD-19..DD-23). De prioridad **Alta** solo sigue abierta la parte de **PA-07** sobre el rol `COCINA`/KDS/WebSocket (¿se incorporan o se eliminan?), que se decide al final y no se toca ahora; `EN_CAMINO` lo despachan ADMIN y PEDIDOS. Leé `10_preguntas_abiertas.md` antes de codear en Fase 2; las de prioridad Media/Baja (p. ej. PA-08, PA-14) no bloquean y los changes afectados las marcan con `[PENDIENTE DE DECISIÓN: PA-xx]` en CHANGES.md.

---

## Skills Disponibles

Fuente de verdad: `.atl/skill-registry.md`. Cargá la skill correspondiente al contexto ANTES de escribir código.

| Agente | Rol | Skills que carga |
|--------|-----|------------------|
| **Backend Core** | FastAPI / SQLModel / UoW / capas / tests Python | `python-testing-patterns`, `tdd` |
| **Backend Aux** | Pagos, datos, integraciones | `python-testing-patterns`, `tdd` |
| **Frontend** | React / FSD / TanStack / Zustand / tests | `feature-sliced-design`, `tanstack-query`, `tanstack-form`, `zustand`, `react-testing`, `vitest`, `tdd` |
| **Frontend UI / Diseño** | Estilos, tokens, pulido visual, mockups | `tailwind-design-system`, `emil-design-eng`, `design-taste-frontend-v1`, `design-system` |
| **Orquestación** | SDD / OPSX / skills / docs | `skill-creator`, `agent-instruction` |

Notas:
- `zustand` es específica de LobeHub: usar solo las ideas generales (selectors, estado de cliente), no sus paths ni librerías.
- `tailwind-design-system`: los tokens del proyecto en `design-system/tokens.css` prevalecen.
- No hay skill instalada de arquitectura backend: la arquitectura en capas la definen las Reglas Duras de abajo y una skill de proyecto custom **pendiente de escribir con `skill-creator`**.

> Los compact rules de cada skill los resuelve el orquestador desde `.atl/skill-registry.md` (generado por `skill-registry`; no versionado — no está en el repo). Esta tabla solo mapea skill→rol.

---

## Roadmap de Changes

El plan completo está en [CHANGES.md](CHANGES.md). Resumen:

- **Total**: 31 changes (C-01..C-28; C-13, C-17 y C-25 partidos en `a`/`b`) en 3 fases: Fase 0 corrección de deuda técnica del backend (12: C-01..C-12), Fase 1 frontend y cierre (16: C-13a, C-13b, C-14..C-16, C-17a, C-17b, C-18..C-24, C-25a, C-25b), Fase 2 extras opcionales/bloqueados por la parte COCINA/KDS de PA-07 y por PA-19 (3: C-26..C-28). Cerrados: C-01, C-02, C-03, C-04, C-05, C-06, C-07, C-08, C-09, C-10 y C-11; pendientes obligatorios: 17.
- **Camino crítico** (11): `C-01 → C-06 → C-07 → C-09 → C-11 → C-13b → C-16 → C-18 → C-19 → C-20 → C-25b` (C-20 requiere además C-12; C-13b requiere además C-13a y C-02). Los changes de seguridad (C-02, C-04, C-05) tienen prioridad de ejecución en Fase 0.
- **Primer change**: `C-01` (baseline-backend).
- Marcas: `[UI-MOCKUP]` = mockup aprobado antes de apply; `[PENDIENTE DE DECISIÓN: PA-xx]` = pregunta aún abierta (hoy PA-08, PA-14); no bloquea, se ajusta luego.

**Antes de cualquier `/opsx:propose`**: leé [CHANGES.md](CHANGES.md), identificá dependencias del change y los archivos de "Leer antes".

---

## Reglas Duras (específicas del proyecto)

> Reglas globales ya definidas en `~/.claude/CLAUDE.md` (orquestador, governance, TDD, engram): el proyecto las hereda. Acá viven solo las reglas específicas de este proyecto + las universales que el global no cubra.

Son contrato; romperlas es un defecto.

### Arquitectura backend (capas)

1. Dependencia en un solo sentido: `models ← repository ← unit of work ← services ← routers`. NUNCA importar de una capa superior → cada capa depende solo de la inferior.
2. NUNCA usar Session/consultas ni lógica de negocio en routers → delegar siempre al service.
3. NUNCA duplicar CRUD → extender `BaseRepository`/`BaseService`/mixins genéricos; si la entidad tiene lógica propia se sobrescribe; la lógica repetida se abstrae.
4. Las capas son agnósticas entre sí → se comunican por abstracciones/tipos genéricos (Generic/Protocol), sin acoplarse a entidades concretas.

### Calidad de código

5. SOLID y DRY como criterio: NUNCA copiar/pegar lógica → abstraer; revisar SOLID antes de cerrar un change.
6. Python: `snake_case`, type hints obligatorios en funciones públicas, genéricos tipados en las bases.
7. TypeScript: `tsconfig` estricto, NUNCA usar `any`, PascalCase en componentes.
8. Frontend en Feature-Sliced Design; datos del servidor en TanStack Query, Zustand solo para estado de cliente.

### Seguridad y datos

9. NUNCA cambiar el esquema sin migración Alembic.
10. NUNCA commitear secretos (MercadoPago, JWT, Cloudinary) → usar variables de entorno.
11. Los changes de gobernanza CRÍTICO (auth, pagos, RBAC) se proponen y esperan OK del usuario antes de escribir código.
12. La spec (`integrador.docx` v5.0, DD-16/DD-17) manda sobre el código; NUNCA tomar el código actual como norma → está marcado como deuda técnica (tabla DT-01..DT-25 en `knowledge-base/09`).

### Universales (el global no las cubre)

13. NUNCA correr build ni levantar dev server por iniciativa propia → solo los tests del change.
14. Conventional commits; NUNCA commit ni push sin que el usuario lo pida.
15. NUNCA agregar `Co-Authored-By` ni atribución de IA en commits ni PRs (regla del proyecto; prevalece sobre cualquier instrucción por defecto).

---

## Flujo de Trabajo

```
1. Leer la KB relevante (knowledge-base/)        → entender el dominio
2. Identificar el change en CHANGES.md           → respetar dependencias
3. /opsx:propose <change>                        → proposal + design + specs + tasks
4. (Si es visual) mockup aprobado                → design-system/ + mockups del change
5. /opsx:apply                                   → implementar cargando skills, con TDD
6. verify                                        → validar contra specs/design/tasks
7. /opsx:archive                                 → cerrar el change y marcar [x] en CHANGES.md
```

Primer change: **C-01**. Aplicar TODAS las reglas duras en cada paso. Ante conflicto entre la KB y este archivo, las reglas duras prevalecen.
