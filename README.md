# Food Store

Tienda de comida online: los clientes exploran un catálogo jerárquico, arman su pedido con productos
personalizables (sacando ingredientes), eligen dónde recibirlo y pagan con MercadoPago; el local gestiona
pedidos, stock y catálogo desde un panel de administración con métricas.

Trabajo Práctico Integrador desarrollado con **Spec-Driven Development** (OpenSpec): cada funcionalidad nace
como un *change* con propuesta, diseño, specs y tareas, se implementa con TDD estricto y se verifica contra
la spec antes de archivarse.

> **De un vistazo** — React 18 + TypeScript · FastAPI + SQLModel · PostgreSQL 15 · MercadoPago (Checkout API) · Docker Compose
> · App en http://localhost:5173 · API en http://localhost:8000 · Swagger en http://localhost:8000/docs

## Contenido

1. [Repositorio y equipo](#repositorio-y-equipo)
2. [Funcionalidades](#funcionalidades)
3. [Stack](#stack)
4. [Arquitectura](#arquitectura)
5. [Cómo correrlo](#cómo-correrlo)
6. [Referencia rápida de comandos](#referencia-rápida-de-comandos)
7. [Solución de problemas](#solución-de-problemas)
8. [Estado del proyecto](#estado-del-proyecto)
9. [Cómo se trabajó: OpenSpec + TDD](#cómo-se-trabajó-openspec--tdd)
10. [Limitaciones conocidas](#limitaciones-conocidas)
11. [Documentación](#documentación)

## Repositorio y equipo

- **Repositorio**: https://github.com/Tuki-serv/FoodStore-SSD
- **Video de demostración** (14:38): https://www.youtube.com/watch?v=ty1VeeI9Aig
- **Materia, carrera, equipo y docente**: en [docs/entrega/metadatos.md](docs/entrega/metadatos.md).

## Funcionalidades

- **Catálogo**: categorías en árbol, productos con ingredientes, alérgenos, stock y disponibilidad; búsqueda y filtros.
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
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS, TanStack Query, TanStack Form, Zustand, Axios, recharts — Feature-Sliced Design |
| Backend | Python 3.10+, FastAPI, SQLModel, PostgreSQL 15, Alembic, python-jose (JWT), Passlib/bcrypt, slowapi, SDK de MercadoPago |
| Tests | pytest contra PostgreSQL real; Vitest + Testing Library + MSW + axe |
| Infra dev | Docker Compose (PostgreSQL + pgAdmin), ngrok para el webhook |

## Arquitectura

```
┌──────────────────────────── FRONTEND (React + Vite) ────────────────────────────┐
│  Feature-Sliced Design:  app → pages → features → entities → shared             │
│  Estado del servidor: TanStack Query (catálogo, pedidos, métricas…)             │
│  Estado del cliente:  Zustand — 4 stores (auth, cart, payment, ui)              │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ HTTP /api/v1 (Axios: JWT en memoria,
                                       │ refresh por cookie HttpOnly ante un 401)
┌──────────────────────────────────────▼──── BACKEND (FastAPI) ───────────────────┐
│  routers → services → unit of work → repositories → models                      │
│  (dependencias en un solo sentido; CRUD genérico en BaseRepository/BaseService) │
│  JWT + RBAC · rate limiting · FSM de pedidos · webhook de pagos idempotente     │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ SQLModel / Alembic
┌──────────────────────────────────────▼──── PostgreSQL 15 ───────────────────────┐
│  Identidad y acceso · Catálogo · Ventas y pagos                                 │
│  Soft delete · snapshots de precio y dirección · historial de estados append-only│
└─────────────────────────────────────────────────────────────────────────────────┘
          ▲
          │ webhook «Order» (vía ngrok en desarrollo)
     MercadoPago
```

Cada módulo del backend (`backend/app/modules/<módulo>/`) repite la misma forma —modelo, repositorio, servicio, router y schemas— y se apoya en las bases genéricas de `backend/app/core/`. El detalle está en [knowledge-base/08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md).

### Estructura del repo

La raíz es solo de **gestión del proyecto**; el código vive en subdirectorios.

```
Food-Store-Prueba/
├── backend/           # API FastAPI (app/, tests/, alembic, Dockerfile) — ver backend/README.md
├── frontend/          # React + TS (src/, tests/) — ver frontend/README.md
├── docker-compose.yml # orquesta db, pgadmin, backend y frontend; su .env (raíz) solo trae variables de compose
├── openspec/          # changes (activos y archivados) y specs vigentes (SDD)
├── knowledge-base/    # base de conocimiento del dominio (reglas, flujos, decisiones)
├── design-system/     # tokens, componentes y assets de la identidad visual
├── docs/              # documentos fuente y evidencia de entrega (docs/entrega/)
├── todoAMd/           # tareas manuales pendientes
├── CHANGES.md         # roadmap de changes
└── CLAUDE.md / AGENTS.md  # instrucciones para agentes
```

#### Backend (`backend/`): capas por módulo

```
backend/
├── app/
│   ├── main.py              # create_app(): routers bajo /api/v1, CORS, rate limit
│   ├── core/                # bases genéricas compartidas por todos los módulos
│   │   ├── repository.py    # BaseRepository[T] (CRUD genérico)
│   │   ├── service.py       # BaseService[T]
│   │   ├── uow.py           # Unit of Work (commit/rollback por request)
│   │   ├── security.py      # JWT y bcrypt
│   │   ├── permissions.py   # RBAC por rol
│   │   ├── pagination.py, errors.py, config.py, database.py
│   │   └── mixins/          # auditoría / soft delete
│   ├── modules/             # un módulo por dominio, todos con la misma forma
│   │   ├── pedidos/         # models → repository → unit_of_work → service → router
│   │   │                    #   + schemas.py, fsm.py (máquina de estados), filtros.py
│   │   ├── pagos/           # MercadoPago: pago con tarjeta y webhook idempotente
│   │   ├── auth/, usuarios/, refreshtokens/
│   │   ├── productos/, categorias/, ingredientes/, unidades_medida/
│   │   └── direcciones/, admin/ (métricas del dashboard), health/
│   └── db/                  # seed.py, reset.py, registro de modelos
├── alembic/                 # migraciones del esquema
├── tests/                   # pytest contra PostgreSQL real (foodstore_test)
├── requirements.txt, pytest.ini, Dockerfile
```

#### Frontend (`frontend/src/`): Feature-Sliced Design

```
frontend/src/
├── app/         # arranque: providers (TanStack Query), router, layouts, estilos
├── pages/       # una carpeta por pantalla: catalogo, producto, carrito, finalizar-compra,
│                #   pago-pedido, mis-pedidos, gestion-pedidos, admin-dashboard,
│                #   admin-productos, admin-categorias, admin-usuarios, ingresar, registrarse...
├── features/    # acciones del usuario: agregar-al-carrito, cambiar-estado-pedido, pagar-con-tarjeta
├── entities/    # entidades del dominio (api + model + ui): producto, pedido, cart, session,
│                #   categoria, usuario, direccion, payment, estadistica...
├── shared/      # sin dominio: api (Axios + interceptor de refresh), ui, lib, config, auth
└── test/        # utilidades de Vitest y handlers de MSW
```

Las capas del frontend solo importan hacia abajo (`app → pages → features → entities → shared`), igual que el backend (`router → service → unit of work → repository → models`).

## Cómo correrlo

### Requisitos

- Docker Desktop (PostgreSQL 15 y pgAdmin), Python 3.10 o superior con `pip`, Node.js 22.22 o superior (24 recomendado) con `npm`, y Git.
- Opcional: cuenta de desarrolladores de MercadoPago y `ngrok` (solo para probar el pago con tarjeta; ver más abajo).

### Pasos (en este orden)

Cada paso indica desde qué directorio se corre y qué tenés que ver al terminar. Reemplazá los `CHANGE_ME_*` de cada archivo de entorno por valores propios.

1. **Clonar y crear los archivos de entorno** (desde la raíz). Cada uno se copia de su plantilla `.env.example` a `.env` (la plantilla de tests es `backend/tests/.env.test.example`, que se copia a `backend/tests/.env.test`):

   ```bash
   git clone https://github.com/Tuki-serv/FoodStore-SSD.git Food-Store-Prueba && cd Food-Store-Prueba
   ```

   | Plantilla | Se copia a | Qué lleva |
   |-----------|-----------|-----------|
   | `.env.example` (raíz) | `.env` (raíz) | solo variables de docker compose (`POSTGRES_*`, `PGADMIN_*`) |
   | `backend/.env.example` | `backend/.env` | `DATABASE_URL`, `SECRET_KEY`, sesión, CORS, MercadoPago y Cloudinary (opcionales) |
   | `backend/tests/.env.test.example` | `backend/tests/.env.test` | solo para los tests |
   | `frontend/.env.example` | `frontend/.env` | `VITE_API_URL` |

   En PowerShell, desde la raíz:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend\.env.example backend\.env
   Copy-Item backend\tests\.env.test.example backend\tests\.env.test
   Copy-Item frontend\.env.example frontend\.env
   ```

   Son **cuatro** archivos y hacen falta todos: sin `frontend/.env` la app queda en blanco. Después reemplazá los `CHANGE_ME_*` de cada uno. `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` de la raíz deben coincidir con los de `DATABASE_URL` de `backend/.env` (puerto host **5433**).
2. **Base de datos** (desde la raíz): `docker compose up -d db`. Resultado esperado: el contenedor `db` queda `healthy` (`docker compose ps`).
3. **Backend** (desde `backend/`):

   ```bash
   cd backend                        # desde la raíz del repo
   python -m venv .venv
   .venv\Scripts\activate            # Windows  (Linux/macOS: source .venv/bin/activate)
   pip install -r requirements.txt
   alembic upgrade head              # crea el esquema; termina sin errores
   python -m app.db.seed             # catálogos, usuarios y ventas de demostración (--sin-ventas las omite)
   uvicorn app.main:app --reload     # API en http://localhost:8000
   ```

   Resultado esperado: `GET http://localhost:8000/health` responde `{"status":"ok"}` y Swagger queda en http://localhost:8000/docs. El seed imprime al final las cuentas para ingresar (también están en [Credenciales de prueba](#credenciales-de-prueba-solo-desarrollo)).
4. **Frontend** (desde `frontend/`, en otra terminal):

   ```bash
   cd frontend                       # desde la raíz del repo
   npm install
   npm run dev                       # http://localhost:5173
   ```

   Resultado esperado: el catálogo de demostración en http://localhost:5173.

Detalle y variables de cada parte en [backend/README.md](backend/README.md) y [frontend/README.md](frontend/README.md).

### Variables de entorno más importantes

| Variable | Archivo | Para qué |
|----------|---------|----------|
| `DATABASE_URL` | `backend/.env` | conexión a PostgreSQL (puerto host 5433) |
| `SECRET_KEY` | `backend/.env` | firma de los JWT; usá una clave larga y aleatoria |
| `CORS_ORIGINS` | `backend/.env` | array JSON con el origen del frontend; no admite `*` (la cookie de refresh viaja con credenciales) |
| `REFRESH_COOKIE_SECURE` / `REFRESH_COOKIE_SAMESITE` | `backend/.env` | cookie del refresh; en local, `false` y `lax` |
| `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` | `backend/.env` | MercadoPago (opcionales; ver «Pagos con MercadoPago») |
| `CLOUDINARY_*` | `backend/.env` | subida de imágenes (opcional) |
| `VITE_API_URL` | `frontend/.env` | URL de la API (`http://localhost:8000`) |

Nunca commitees estos valores: los `.env` están en `.gitignore`.

### Credenciales de prueba (solo desarrollo)

El seed crea estas cuentas, una por rol. Son **credenciales de desarrollo**: no usarlas fuera del entorno local; el seed no modifica usuarios que ya existen.

| Usuario | Contraseña | Rol | Para probar |
|---------|------------|-----|-------------|
| `admin@foodstore.com` | `Admin1234!` | ADMIN | usuarios, roles, catálogo y dashboard |
| `cliente@foodstore.com` | `cliente123` | CLIENT | compra, pago y seguimiento |
| `pedidos@foodstore.com` | `pedidos123` | PEDIDOS | avanzar y cancelar pedidos |
| `stock@foodstore.com` | `stock123` | STOCK | productos, ingredientes y stock |

El seed también crea 16 clientes de ejemplo (`nombre.apellido@demo.foodstore.com`, contraseña `cliente123`, rol CLIENT, con dirección) y ≈300 pedidos de demostración de los últimos 12 meses (con pedidos activos de hoy y ayer) para que el dashboard, «Mis pedidos» y la gestión de pedidos tengan datos; `python -m app.db.seed --sin-ventas` omite los pedidos. Las ventas se siembran una sola vez y sus fechas son relativas a esa primera corrida: para fechas frescas, reseteá la base como se indica abajo.

Para volver al estado inicial: desde `backend/`, `python -m app.db.reset` (borra **todas** las tablas), `alembic upgrade head` y `python -m app.db.seed`.

### Tests y cobertura

```bash
# desde la raíz (la base debe estar levantada)
docker compose up -d db
# desde backend/
pytest                          # suite completa contra PostgreSQL real (foodstore_test)
pytest --cov --cov-report=term  # informa la cobertura y falla si es menor a 60 % (backend/.coveragerc)
pytest -m e2e                   # flujo completo compra -> pago -> entrega por API
# desde frontend/
npm test                        # Vitest, sin backend ni red
npm run typecheck               # tsc --noEmit (strict)
npm run lint                    # ESLint
```

### Pagos con MercadoPago (sandbox)

El pago con tarjeta es opcional: sin credenciales, `EFECTIVO` y `TRANSFERENCIA` funcionan igual y se confirman a mano desde el panel (`PEDIDOS`/`ADMIN`).

1. En el panel de desarrolladores de MercadoPago, creá una aplicación y copiá las credenciales de **prueba** a `backend/.env`: `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY`.
2. Exponé el backend con `ngrok http 8000`.
3. En el panel de MercadoPago, sección Webhooks, configurá `<URL de ngrok>/api/v1/pagos/webhook` con el evento «Order (Mercado Pago)» y copiá la clave secreta a `MP_WEBHOOK_SECRET` de `backend/.env`. Sin esa variable el webhook responde 503.
4. Reiniciá el backend y pagá con una **tarjeta de prueba** usando como titular el nombre que define el resultado:

   | Titular | Resultado esperado en Food Store |
   |---------|----------------------------------|
   | `APRO` | pago aprobado → el webhook confirma el pedido solo (`CONFIRMADO`, por «Sistema») |
   | `OTHE` | pago rechazado → el pedido sigue `PENDIENTE` y se puede reintentar |

   Los números de tarjeta de prueba vigentes están en la documentación de MercadoPago para tu país (cambian con el tiempo, por eso no se copian acá). Usá un usuario comprador de prueba, no tu cuenta real.

### Frontend de producción (perfil `prod`)

Sitio estático servido por nginx; desde la raíz: `docker compose --profile prod up -d --build frontend-prod` (http://localhost:8080). `VITE_API_URL` se incrusta al construir (por defecto `http://localhost:8000`).

## Referencia rápida de comandos

| Desde | Comando | Qué hace |
|-------|---------|----------|
| raíz | `docker compose up -d db` | levanta PostgreSQL (puerto 5433) |
| raíz | `docker compose up -d pgadmin` | levanta pgAdmin en http://localhost:5050 |
| raíz | `docker compose ps` | estado de los contenedores |
| `backend/` | `alembic upgrade head` | aplica las migraciones |
| `backend/` | `python -m app.db.seed` | siembra catálogos, usuarios y datos de demostración (idempotente) |
| `backend/` | `python -m app.db.reset` | borra todas las tablas (después: migrar y sembrar) |
| `backend/` | `uvicorn app.main:app --reload` | API en http://localhost:8000 |
| `backend/` | `pytest` | tests del backend |
| `frontend/` | `npm run dev` | app en http://localhost:5173 |
| `frontend/` | `npm test` | tests del frontend |
| `frontend/` | `npm run build` | build de producción (typecheck + Vite) |

## Solución de problemas

**`docker compose up -d db` falla porque el puerto 5433 está ocupado.** Otra instancia de PostgreSQL usa ese puerto: detenela o cambiá el mapeo de puertos en `docker-compose.yml` y el puerto de `DATABASE_URL` en `backend/.env`.

**`alembic upgrade head` no conecta (`connection refused` o `password authentication failed`).** Revisá que `db` esté `healthy` (`docker compose ps`) y que usuario, contraseña, base y puerto de `DATABASE_URL` coincidan con el `.env` de la raíz. Si cambiaste la contraseña después de crear el volumen, PostgreSQL conserva la anterior: borrá el volumen (`docker compose down -v`, se pierden los datos) y volvé a levantar.

**El backend no arranca y nombra una variable faltante.** La configuración se valida al iniciar: falta esa variable en `backend/.env`. Copiá de nuevo la plantilla `backend/.env.example` y completá los `CHANGE_ME_*`.

**La página de http://localhost:5173 queda en blanco.** Falta `frontend/.env` (la consola del navegador dice «Falta la variable VITE_API_URL»). Copialo de `frontend/.env.example` y reiniciá `npm run dev`: Vite lee el `.env` solo al arrancar.

**El frontend carga pero no muestra productos o la sesión se pierde al recargar.** Revisá que el backend esté corriendo, que `VITE_API_URL` apunte a él y que `CORS_ORIGINS` incluya exactamente `http://localhost:5173` (sin barra final). Para la cookie de refresh en local, `REFRESH_COOKIE_SECURE=false`.

**Los tests del backend fallan todos al conectar.** Necesitan la base levantada y `backend/tests/.env.test` copiado de su plantilla; usan la base `foodstore_test`, separada de la de desarrollo.

**El pago con tarjeta queda `PENDIENTE` aunque MercadoPago lo aprobó.** El webhook no llegó: revisá que ngrok siga corriendo (la URL cambia cada vez que se reinicia), que la URL del panel termine en `/api/v1/pagos/webhook` y que `MP_WEBHOOK_SECRET` sea la clave de ese webhook. Si falta, el backend responde 503.

## Estado del proyecto

El roadmap completo está en [CHANGES.md](CHANGES.md).

| Fase | Alcance | Estado |
|------|---------|--------|
| Fase 0 — backend | seguridad, migraciones, seed, FSM de pedidos, stock y pagos | completa |
| Fase 1 — frontend | shell, sesión, catálogo, carrito, checkout, pago con MercadoPago, seguimiento de pedidos y panel de administración con dashboard, más la deuda heredada saldada en `c-25b1` | completa |
| Entrega (C-25b) | documentación y evidencia en [docs/entrega/](docs/entrega/), video publicado | completa |
| Fase 2 — extras opcionales | cocina/KDS y tiempo real | pendiente de decisión (PA-07) |

## Cómo se trabajó: OpenSpec + TDD

Cada cambio recorre el mismo ciclo, y nada se implementa sin una spec que lo respalde:

```
explore → propose (proposal, design, specs, tasks) → mockup aprobado (si es visual) → apply con TDD → verify → archive
```

- **Specs vigentes** en [openspec/specs/](openspec/specs/): una carpeta por capacidad (auth, pedidos, pagos, catálogo, frontend…), cada una con sus escenarios de aceptación.
- **Changes archivados** en [openspec/changes/archive/](openspec/changes/archive/): la historia completa de cómo se construyó el sistema, con su propuesta, diseño y tareas.
- **TDD estricto**: cada tarea arranca con un test que falla (rojo), se implementa lo mínimo para pasarlo (verde) y se refactoriza con los tests en verde.
- **Design system** en [design-system/](design-system/): tokens, componentes y mockups aprobados antes de implementar cada pantalla.

Para ver el estado de los changes: `openspec list`.

## Limitaciones conocidas

Decisiones y deuda aceptadas para la entrega; ninguna impide el flujo compra → pago → entrega.

- **Contraseña inicial de usuarios creados por el administrador (DT-28)**: el `ADMIN` elige y escribe la contraseña del alta y se la comunica a la persona; no existe cambio de contraseña ni obligación de cambiarla al ingresar. Si se pierde el acceso de administrador, se recrea con `python -m app.db.seed` desde `backend/` (o reseteando la base como indica la sección de credenciales).
- **Rol `COCINA`, KDS y WebSocket (PA-07)**: el código conserva restos del rol `COCINA`, pero no está sembrado ni incorporado a la spec; `EN_CAMINO` lo despachan `ADMIN` y `PEDIDOS`. Se decide en la Fase 2 opcional.
- **Fechas en UTC**: los filtros de fecha del gestor de pedidos y el dashboard usan UTC; cerca de la medianoche local un pedido puede aparecer en el día siguiente. El filtro de estado acepta un solo valor y no hay búsqueda por cliente o número.
- **Envío fijo de $50 también en retiro (PA-13)**: los pedidos para retirar en el local pagan el mismo envío que los de entrega, porque la spec vigente define $50 fijo; pendiente de decisión.
- **Sin idempotencia al crear pedidos**: si la respuesta se pierde después de que el servidor confirmó y se reintenta, puede quedar un segundo pedido `PENDIENTE`; se recupera cancelándolo (no afecta el stock, que se descuenta al confirmar).
- **Escala de Tailwind por defecto**: el frontend conserva la escala de espaciado por defecto de Tailwind junto a los tokens del design system; no cambia el resultado visual aprobado.
- **Sin deploy público**: el proyecto corre en local (ngrok solo para el webhook); no se publicó en un proveedor.
- **Transferencia**: no hay datos bancarios cargados en el sistema; la confirmación de `TRANSFERENCIA` es manual.

## Documentación

### Entrega

| Documento | Contenido |
|-----------|-----------|
| [docs/entrega/checklist-rubrica.md](docs/entrega/checklist-rubrica.md) | 13 criterios de la rúbrica, bonus y CE-01..CE-14, con estado y evidencia |
| [docs/entrega/recorrido-e2e.md](docs/entrega/recorrido-e2e.md) | recorrido compra → pago → entrega, paso a paso y con la cuenta a usar |
| [docs/entrega/guion-video.md](docs/entrega/guion-video.md) | guion del video de demostración (5 a 10 minutos), con minuto, cuenta y criterio de la rúbrica por paso |
| [docs/entrega/capturas/](docs/entrega/capturas/) | 17 pantallas distintas en 1440x900 y 390x844 (`NN-<pantalla>-<viewport>.png`) |
| [docs/entrega/metadatos.md](docs/entrega/metadatos.md) | materia, carrera, equipo y docentes de la entrega |

### Dominio y diseño

| Documento | Contenido |
|-----------|-----------|
| [knowledge-base/](knowledge-base/README.md) | visión, actores, modelo de datos, reglas de negocio, flujos, arquitectura y decisiones |
| [knowledge-base/13_rubrica_y_entrega.md](knowledge-base/13_rubrica_y_entrega.md) | rúbrica de 200 puntos y requisitos de entrega |
| [CHANGES.md](CHANGES.md) | roadmap de changes, dependencias y camino crítico |
| [design-system/README.md](design-system/README.md) | identidad visual, tokens y componentes |
| `docs/integrador.docx`, `docs/Descripcion.docx`, `docs/Historias de Usuario.md` | documentos fuente de la consigna |
