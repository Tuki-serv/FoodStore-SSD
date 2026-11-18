# Food Store

Tienda de comida online: los clientes exploran un catálogo jerárquico, arman su pedido con productos
personalizables (sacando ingredientes), eligen dónde recibirlo y pagan con MercadoPago; el local gestiona
pedidos, stock y catálogo desde un panel de administración con métricas.

Trabajo Práctico Integrador desarrollado con **Spec-Driven Development** (OpenSpec): cada funcionalidad nace
como un *change* con propuesta, diseño, specs y tareas, se implementa con TDD estricto y se verifica contra
la spec antes de archivarse.

## Funcionalidades

- **Catálogo**: categorías en árbol, productos con ingredientes, alérgenos, stock y disponibilidad.
- **Carrito persistente** con personalización por producto.
- **Pedidos** gobernados por una máquina de estados (`PENDIENTE → CONFIRMADO → EN_PREP → EN_CAMINO → ENTREGADO`, con cancelación) y un historial *append-only*; el stock se descuenta al confirmar.
- **Pagos** con MercadoPago (Orders API, tarjeta tokenizada en el navegador) y webhook idempotente con firma verificada; efectivo y transferencia se confirman a mano.
- **Direcciones de entrega** propias, con una principal.
- **Cuentas y seguridad**: JWT de acceso en memoria + refresh en cookie HttpOnly con rotación, rate limiting de login y RBAC multirol.
- **Panel de administración**: catálogo, stock, usuarios y roles, gestión operativa de pedidos y dashboard de métricas.

### Roles

| Rol | Puede |
|-----|-------|
| `CLIENT` | Comprar, gestionar sus direcciones y seguir sus pedidos |
| `PEDIDOS` | Gestionar el ciclo operativo de los pedidos |
| `STOCK` | Gestionar productos, ingredientes y stock |
| `ADMIN` | Todo lo anterior, más usuarios, roles y métricas |

## Stack

| Capa | Tecnologías |
|------|-------------|
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS, TanStack Query, TanStack Form, Zustand, Axios — Feature-Sliced Design |
| Backend | Python, FastAPI, SQLModel, PostgreSQL 15, Alembic, python-jose (JWT), Passlib/bcrypt, slowapi, SDK de MercadoPago — arquitectura en capas (models → repository → unit of work → services → routers) |
| Tests | pytest contra PostgreSQL real; Vitest + Testing Library + MSW + axe |
| Infra dev | Docker Compose (PostgreSQL + pgAdmin), ngrok para el webhook |

## Estado

El roadmap completo está en [CHANGES.md](CHANGES.md) (31 changes en 3 fases).

- **Fase 0 — backend**: completa (seguridad, migraciones, seed, FSM de pedidos, stock y pagos).
- **Fase 1 — frontend**: en curso. Listos la base de la app (shell con panel lateral, sesión, cliente HTTP, guards por rol) y las direcciones de entrega; siguen catálogo, carrito, checkout, pago, seguimiento y administración.
- **Fase 2 — extras opcionales**: cocina/KDS y tiempo real, pendientes de decisión.

## Estructura del repo

La raíz es solo de **gestión del proyecto**; el código vive en subdirectorios.

```
Food-Store-Prueba/
├── backend/           # API FastAPI (app/, tests/, alembic, Dockerfile) — ver backend/README.md
├── frontend/          # React + TS (src/, tests/) — ver frontend/README.md
├── docker-compose.yml # orquesta db, pgadmin, backend y frontend; su .env (raíz) solo trae variables de compose
├── openspec/          # changes (activos y archivados) y specs vigentes (SDD)
├── knowledge-base/    # base de conocimiento del dominio (reglas, flujos, decisiones)
├── design-system/     # tokens, componentes y assets de la identidad visual
├── docs/              # documentos fuente
├── todoAMd/           # tareas manuales pendientes
├── CHANGES.md         # roadmap de changes
└── CLAUDE.md / AGENTS.md  # instrucciones para agentes
```

## Cómo correrlo

1. Base de datos (desde la raíz): `docker compose up -d db`
2. Backend: instalación, variables de entorno, migraciones, seed y tests en [backend/README.md](backend/README.md) (los comandos se corren desde `backend/`).
3. Frontend: dependencias, variables, dev server y tests en [frontend/README.md](frontend/README.md) (los comandos se corren desde `frontend/`).
