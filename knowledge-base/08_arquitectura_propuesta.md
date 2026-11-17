# Arquitectura Propuesta

## Patrones aplicados

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

| Patrón | Capa | Dónde se usa | Por qué |
|--------|------|--------------|---------|
| Repository + `BaseRepository[T]` genérico | Backend | `core/repository.py` y `modules/*/repository.py` | Aísla acceso a BD; facilita mocks. Métodos spec: `get_by_id`, `list_all(skip,limit)`, `count`, `create`, `update`, `soft_delete`, `hard_delete`. El código actual usa `get_all_by_state`, `count_model`, `add`, `update`, `delete` (soft) |
| Unit of Work | Backend | `core/uow.py` + UoW por módulo (`PedidoUnitOfWork`, `UsuarioUnitOfWork`, ...) | Transacción atómica: commit al salir sin excepción, rollback si falla. El Service nunca hace commit |
| Service Layer (stateless) | Backend | `service.py`; `base_service` genérico en `core/service.py` | Concentra lógica de negocio testeable sin HTTP |
| Snapshot | Backend/BD | `DetallePedido.*_snapshot`, `Pedido` monetario | Integridad histórica de precios/nombres |
| Soft Delete + índices únicos parciales | Backend/BD | `UniqueAuditableMixin` | Recuperación y unicidad solo entre activos |
| Audit Trail append-only | Backend/BD | `HistorialEstadoPedido` | Trazabilidad inmutable |
| State Machine (FSM) | Backend | `PedidoService.TRANSICIONES` (mapa por rol) | Transiciones válidas y permisos en un solo lugar |
| Idempotent Payments | Backend | `Pago.idempotency_key` | Evitar cobros/procesamiento duplicado |
| Webhook / IPN | Backend | `POST /pagos/webhook` | Confirmación asíncrona sin polling |
| Rate limiting | Backend | slowapi en login (5 fallos/15 min/IP, ventana deslizante en memoria; C-03). `core/rate_limit/` | Mitigar fuerza bruta/abuso |
| Pub/Sub por rooms (WebSocket) | Backend | `core/websocket.py` (`ConnectionManager`) | Extra del código, no especificado (PA-19) |
| Feature-Sliced Design | Frontend | `pages/features/components/hooks/store/api/types` | Límites de import claros |
| Custom Hooks (TanStack Query) | Frontend | `useProductos(filtros)`, etc. | Encapsular fetching/cache/debounce |
| Optimistic Updates | Frontend | mutations (`onMutate/onError/onSettled`) | UX instantánea con rollback |
| Zustand por slice | Frontend | 4 stores | Rendimiento (suscripción granular) |

Regla de oro de imports (backend): `Router → Service → UoW → Repository → Model`; nunca al revés. Frontend: `Pages → Features → Hooks/Stores → API → Types`.

## Estructura de directorios

Backend real (, **estado tras C-06 (DT-09 resuelta):** Alembic con migración 001; `main.py` y `seed.py` ya viven dentro de `backend/app/`; D9: la raíz es solo gestión, el código vive en `backend/` y `frontend/`):

```
Food-Store-Prueba/                # raíz = gestión + orquestación (docker-compose.yml, .env/.env.example de compose; openspec/, knowledge-base/, docs/, design-system/, CHANGES.md, CLAUDE.md, AGENTS.md, README.md)
├── docker-compose.yml           # D10: orquesta db (postgres:15, host 5433), pgadmin (5050), backend (build ./backend); frontend en C-13a
├── .env  .env.example           # SOLO variables de compose (POSTGRES_*, PGADMIN_*); .env no se versiona
├── frontend/                    # React + TS (llega en C-13a)
└── backend/
    ├── Dockerfile  .dockerignore
    ├── alembic.ini  alembic/ (env.py, script.py.mako, versions/001_esquema_inicial.py, 002_sesiones_y_refresh_rotado.py)   # migraciones (C-06)
    ├── requirements.txt  pytest.ini  .env  .env.example   # .env no se versiona
    ├── tests/.env.test  tests/.env.test.example           # .env.test no se versiona; los tests lo leen de ahí
    ├── README.md
    ├── app/
    │   ├── main.py                  # create_app(): CORS, RateLimitMiddleware, routers /api/v1 + /health, handlers de error (sin lifespan: la app no crea tablas)
    │   ├── db/                      # models.py (import_all_models), migrations.py (helpers Alembic), seed.py (python -m app.db.seed), reset.py
    │   ├── core/
    │   │   ├── config.py            # Settings (pydantic-settings)
    │   │   ├── database.py  security.py  enums.py  errors.py  logger.py
    │   │   ├── repository.py  service.py  uow.py  schemas.py (PaginatedResponse)
    │   │   ├── websocket.py         # ConnectionManager (rooms)
    │   │   ├── cloudinary/          # schemas, service (el router de imágenes vive en modules/admin)
    │   │   ├── mixins/auditable_mixin.py
    │   │   └── rate_limit/          # limiter (slowapi) + LimitadorPorClave + Protocol RegistroIntentos
    │   ├── modules/
    │   │   ├── auth/                # auth_router (register, login, refresh, logout, logout-all, me), AuthService, cookies, AuthUnitOfWork (C-02)
    │   │   ├── refreshtokens/       # models Sesion + RefreshToken, repositorios (sin router ni service) (C-02)
    │   │   ├── usuarios/            # usuarios_router (perfil), UsuarioService
    │   │   ├── direcciones/ categorias/ productos/ ingredientes/ unidades_medida/
    │   │   ├── pedidos/             # incluye EstadoPedido, DetallePedido, HistorialEstadoPedido, filtros.py, fsm.py
    │   │   ├── pagos/               # incluye FormaPago
    │   │   ├── admin/               # usuarios_admin_router, estadisticas_router (EstadisticasService), imagenes_router
    │   │   ├── health/
    │   │   └── (cada módulo: models, schemas, repository, service, router, unit_of_work, dependencies)
    │   └── utils/errores.py         # handlers {detail, code, field}
    └── tests/ (conftest.py, support/, integration/*, unit/*)
```

**Estructura objetivo (norma)** según spec `[INT]` (`backend/app/main.py` y `backend/app/db/seed.py` ya cumplidos en C-01): `backend/app/main.py`, `backend/app/db/seed.py`, `backend/app/modules/{auth,refreshtokens,usuarios,direcciones,categorias,productos,pedidos,pagos,admin}/`, `backend/app/core/uow.py`. Comandos de backend: se corren desde `backend/`.

Frontend objetivo (spec, FSD) — **`[INT]` literal** (norma de la spec; el mapeo a FSD v2.1 está debajo):

```
frontend/src/
├── app/            # providers, router, estilos globales
├── pages/          # una por ruta
├── features/       # auth, catalogo, carrito, checkout, pedidos, admin... (autocontenidas)
├── components/     # UI genérica
├── hooks/          # lógica TanStack Query
├── store/          # authStore.ts cartStore.ts paymentStore.ts uiStore.ts
├── api/            # Axios + interceptors
└── types/
```

Frontend real tras C-13b (`frontend/`, FSD v2.1: `app` → `pages` → `entities` → `shared`; `features`/`widgets` a demanda). Detalle y reglas en `frontend/README.md`:

```
frontend/
├── package.json, vite.config.ts, tailwind.config.ts, tsconfig.json, eslint.config.js, Dockerfile, .env.example
├── tests/architecture/        # fronteras FSD (fsd-boundaries) y tokens de Tailwind (tailwind-tokens), con fixtures
└── src/
    ├── app/
    │   ├── providers/         # AppProviders (QueryClientProvider + SesionGate + RouterProvider)
    │   ├── router/            # routes.tsx (árbol único), route-map.ts, RequiereAcceso (guards), destino.ts, future.ts
    │   ├── layouts/app-shell/ # AppShell, ShellConSesion, Sidebar, Topbar, NavSections, app-shell.css, model/navigation.ts
    │   └── styles/index.css   # importa design-system/tokens.css y las directivas de Tailwind
    ├── pages/                 # placeholder/, not-found/, error/, forbidden/ (Sin permiso) (una carpeta por slice)
    ├── entities/
    │   ├── session/           # api/ (rehidratarSesion, abrirSesion, sesionQueries), model/ (useSesion, useCerrarSesion)
    │   ├── cart/              # model/ (cartStore persistente)
    │   └── payment/           # model/ (paymentStore, solo memoria)
    ├── shared/
    │   ├── api/               # apiClient (Axios), renovación single-flight ante 401, ApiError, crearQueryClient, auth.ts, Paginado
    │   ├── auth/              # authStore (access solo en memoria, usuario, estado de la sesión)
    │   ├── config/            # env.ts (readConfig, VITE_API_URL), roles.ts, routes.ts (RUTAS, ACCESO_RUTAS), brand.ts
    │   ├── model/             # ui-store.ts (uiStore)
    │   ├── lib/               # useMediaQuery, almacenamiento seguro de Zustand
    │   └── ui/                # Icon (sprite del design system), PantallaCarga, estilos de botón
    └── test/                  # setup de Vitest (MSW, stores), msw/, render-app, router (fuera de las capas)
```

| `[INT]` | FSD en este repo |
|---------|------------------|
| `app/` (providers, router, estilos) | `src/app/` (`providers/`, `router/`, `layouts/app-shell/`, `styles/`) |
| `pages/` | `src/pages/<slice>/` (uno por ruta) |
| `features/` | `src/features/<slice>/` (desde C-14) |
| `components/` | `src/shared/ui/` |
| `hooks/` | segmentos `api/` y `model/` de cada slice |
| `store/` (4 stores) | `uiStore` en `src/shared/model/`; `authStore` en `src/shared/auth/`; `cartStore` en `src/entities/cart/`; `paymentStore` en `src/entities/payment/` (todos desde C-13b; C-18 y C-20 suman la UI) |
| `api/` | `src/shared/api/` (C-13b, cumplida: cliente Axios, renovación ante 401, `ApiError`, fábrica del QueryClient) |
| `types/` | segmento `model/` del slice; contratos HTTP en `shared/api` |

Comandos de frontend: se corren desde `frontend/` (`npm install`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`); requieren `frontend/.env` copiado de `frontend/.env.example` (`VITE_API_URL`).

## Estado del cliente (Zustand) — 4 stores

| Store | Estado | Persistencia |
|-------|--------|--------------|
| `authStore` | accessToken, usuario, estado (`verificando`/`autenticada`/`anonima`), motivo | **Sin `persist`**: el access vive en memoria (DD-27); la cookie HttpOnly del refresh rehidrata la sesión al recargar. `[INT]` pedía `partialize` del `accessToken`: desvío decidido en DD-27. No leer el token a mano fuera del store |
| `cartStore` | líneas (producto + personalización + cantidad); `selectTotalItems/selectTotalPrecio/selectLinea` | `persist` `foodstore.cart` (líneas completas, v1; datos corruptos → carrito vacío). Sobrevive al logout (CE-14) |
| `paymentStore` | estado del checkout/pago MP, `mpPaymentId`, errores | Ninguna (se resetea al recargar) |
| `uiStore` | cartOpen, sidebarOpen (drawer mobile), sidebarCollapsed (desktop, solo íconos), confirmModal, toasts | `persist` + `partialize`: solo `sidebarCollapsed`; el resto no se persiste. Vive en `src/shared/model/ui-store.ts` (clave `foodstore.ui`, v1); desde C-13b incluye `cartOpen`, `toasts` y `confirmModal` (estado y acciones; los dibuja el change que los use). El tema no existe: el design system Revision 2 no define tema oscuro |

**Ubicación de los stores (C-13b):** `authStore` en `src/shared/auth/` (el interceptor de `shared/api` lo lee con `getState()` y `shared` no puede importar `entities`), `cartStore` en `src/entities/cart/`, `paymentStore` en `src/entities/payment/` y `uiStore` en `src/shared/model/`. Las operaciones de sesión (`rehidratarSesion`, `abrirSesion`, `useCerrarSesion`) viven en `src/entities/session/`.

**Navegación (DD-25)**: panel lateral izquierdo para toda la app, con secciones según rol. Desktop: colapsable a solo íconos (`sidebarCollapsed`, preferencia persistida). Mobile: oculto tras un botón ☰, entra como drawer (`sidebarOpen`, no persistido). Detalle de secciones por rol en [09](09_decisiones_y_supuestos.md) (DD-25).

Buenas prácticas: suscripción por slice (`useCartStore(s => s.itemCount())`), nunca el store completo sin selector, `getState()` fuera de React (interceptores).

## Seguridad

- **Autenticación (C-02)**: JWT HS256 (access 30 min, claims `sub`, `roles`, `sid`, `type`) enviado solo como `Authorization: Bearer` y guardado en memoria por el frontend (`authStore`, DD-27). El refresh es un valor opaco (hash SHA-256 en BD) en la cookie HttpOnly `refresh_token` con `Path=/api/v1/auth`, `SameSite`/`Secure` configurables (`REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`). Cada login abre una **sesión** de 7 días fijos; el refresh rota en cada renovación con historial (`revoked_at` = rotado), con período de gracia (`REFRESH_REUSE_GRACE_SECONDS`) y detección de reuso que cierra todas las sesiones del usuario. Logout y logout-all marcan la sesión (nunca borran). CORS con credenciales: `CORS_ORIGINS` no admite `*`.
- **Autorización**: RBAC con `require_role([...])`; propiedad de recursos verificada en Service (403).
- **Validación de input**: Pydantic v2 (Create/Update/Read separados); CHECK constraints en BD; 422 uniforme `VALIDATION_ERROR`.
- **Passwords**: bcrypt (passlib), cost >= 12, `CHAR(60)`.
- **Rate limiting (RN-AU-08, C-03)**: slowapi (`moving-window`, `memory://`) sobre un adaptador `LimitadorPorClave` que `AuthService.login` invoca (`verificar` antes de leer el usuario, `registrar` en cada 401, `reiniciar` tras el commit del login correcto). Umbral y ventana (5 / 15 min) son regla de negocio, no variables. **IP:** la de la conexión (`request.client.host`); la app NO lee `X-Forwarded-For`. Detrás de un proxy confiable, uvicorn traduce el header con `--proxy-headers` (activo por defecto) y `--forwarded-allow-ips=<ip del proxy>`; el agente de ngrok local ya conecta desde 127.0.0.1 (confiado por defecto); en Docker, sin esa opción, los clientes detrás del mismo NAT comparten cupo. **Límite del diseño:** el estado vive en memoria de un solo proceso (el `Dockerfile` corre un único uvicorn sin `--workers`); se pierde al reiniciar y no se comparte entre workers: pasar a Redis solo cambia `storage_uri` (C-28). Quedan sin límite el resto de endpoints y `/health`. Carrera `verificar`→`registrar` aceptada (cada intento paga bcrypt).
- **CORS**: `CORSMiddleware` con orígenes de `CORS_ORIGINS`, `allow_credentials=True`.
- **Pagos**: PCI SAQ-A; verificar siempre contra la API de MP; **objetivo**: validar firma del webhook y autenticar/autorizar `/pagos/crear` y `/pagos/{id}`; *deuda DT-05/DT-06:* ninguno de los dos está implementado en el código actual.
- **Secrets**: `.env` (nunca commiteado; `.env.example` obligatorio); `SECRET_KEY` >= 32 chars (`openssl rand -hex 32`); tokens MP `TEST-` en sandbox, `APP_USR-` en producción.
- **Datos**: soft delete en entidades de negocio, nunca DELETE físico; historial inmutable.

## Variables de entorno

> **Convención (DD-18):** toda variable es explícita (vive en `.env`/`.env.example` y se declara en `Settings`), nada se deriva de otra y **no hay defaults ocultos**. Obligatoria = la app la necesita para funcionar (fail-fast con un error que la nombra). Integraciones opcionales (MercadoPago, Cloudinary) = `Optional = None` («no configurada»); la funcionalidad responde 503 con el formato uniforme solo al usarse. `settings` es un singleton de módulo. Los ejemplos son placeholders.

| Variable | Descripción | Ejemplo | Obligatoria |
|----------|-------------|---------|-------------|
| `ENVIRONMENT` | `development|production|test` | `development` | **Y** |
| `DATABASE_URL` | **Única variable de BD del backend.** Se usa tal cual (esquema `postgresql+psycopg://`); sin normalización ni construcción desde `POSTGRES_*`. En tests apunta a una base `*_test` | `postgresql+psycopg://CHANGE_ME_USER:CHANGE_ME_PASSWORD@localhost:5433/foodstore` | **Y** |
| `SQL_ECHO` | `true` imprime cada sentencia SQL | `false` | **Y** |
| `SECRET_KEY` | Firma JWT (>= 32 chars) | `openssl rand -hex 32` | **Y** |
| `ALGORITHM` | Algoritmo JWT | `HS256` | **Y** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vida del access token | `30` | **Y** |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Vencimiento fijo de la sesión (C-02; la rotación no lo extiende) | `7` | **Y** |
| `REFRESH_REUSE_GRACE_SECONDS` | Segundos tras rotar un refresh en que todavía se acepta sin considerarlo reuso (entero >= 0; 0 desactiva la gracia) | `30` | **Y** |
| `REFRESH_COOKIE_SECURE` | Atributo `Secure` de la cookie del refresh (`false` solo en `.env.test`) | `true` | **Y** |
| `REFRESH_COOKIE_SAMESITE` | `lax\|strict\|none` (`none` exige `REFRESH_COOKIE_SECURE=true`; si no, la carga falla) | `lax` | **Y** |
| `LOG_LEVEL` | Nivel de log | `INFO` | **Y** |
| `CORS_ORIGINS` | Orígenes permitidos, **array JSON** de strings. No puede contener `*` (la cookie del refresh exige CORS con credenciales; si lo contiene la carga falla) | `["http://localhost:5173"]` | **Y** |
| `MP_ACCESS_TOKEN` | Access token MP (backend) | `TEST-...` | N (opcional: pagos) |
| `MP_PUBLIC_KEY` | Public key MP (frontend vía API) | `TEST-...` | N (opcional: pagos) |
| `MP_WEBHOOK_SECRET` | Clave secreta de Webhooks (panel MP) para validar `x-signature`; sin ella el webhook responde 503 | `CHANGE_ME` | N (opcional: pagos; obligatoria para recibir webhooks) |
| `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cuenta Cloudinary | `CHANGE_ME` | N (opcional: imágenes; sin ellas subir = 503, borrar = no-op) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | **Solo docker-compose** (crean usuario y base del contenedor). Mantener `DATABASE_URL` consistente a mano | `CHANGE_ME_USER` | solo compose |
| `PGADMIN_EMAIL`, `PGADMIN_PASSWORD` | **Solo docker-compose** (login de pgAdmin) | `CHANGE_ME@example.com` | solo compose |
| `VITE_API_URL`, `VITE_MP_PUBLIC_KEY` | **Solo frontend** (Vite); no las lee el backend | `http://localhost:8000` | solo frontend |

**Retiradas (C-12):** `BACKEND_PUBLIC_URL` y `FRONTEND_URL` (eran de Checkout Pro: `back_urls` y redirect post-pago). Crear un pago exige solo `MP_ACCESS_TOKEN` (si falta, 503 nombrándola; si MercadoPago rechaza las credenciales, 503 también). **Retirada (C-12, revisión Orders):** `MP_NOTIFICATION_URL` (la Orders API no tiene `notification_url`: la URL del webhook, `<url pública>/api/v1/pagos/webhook`, se configura solo en el panel de MercadoPago con el evento «Order (Mercado Pago)»). **Retiradas (C-03):** `RATE_LIMIT_DEFAULT_PER_MINUTE`, `RATE_LIMIT_DEFAULT_BURST`, `RATE_LIMIT_AUTH_PER_MINUTE`, `RATE_LIMIT_AUTH_BURST` (el límite de login es RN-AU-08, fijo en código). **Retiradas (C-01):** `NGROK_URL` y `MP_WEBHOOK_URL` (la URL del webhook se configura en el panel de MercadoPago; ver «Retirada (C-12)»), `VITE_FRONTEND_URL` (sin equivalente en el backend desde C-12), `POSTGRES_HOST`/`POSTGRES_PORT` y `TEST_DATABASE_URL` (tests: `DATABASE_URL` de `.env.test`, base `foodstore_test`). Con `extra="ignore"`, si siguen en el `.env` no afectan ningún valor.

## Testing

pytest + httpx + pytest-asyncio + pytest-cov sobre **PostgreSQL 15 real** (base `foodstore_test`, creada por la suite si falta; `backend/tests/.env.test` copiado de `backend/tests/.env.test.example`). Guardia de seguridad: la suite aborta si `ENVIRONMENT != test`, si el nombre de la base no termina en `_test` o si falta la configuración. Aislamiento por test con transacción externa + savepoint (rollback al terminar); el esquema de `foodstore_test` se construye una vez por sesión con `alembic upgrade head` desde una base vacía; los tests de migraciones (upgrade/downgrade, «esquema == modelos») usan la base auxiliar `foodstore_migrations_test`, que también cumple la guardia `_test`. Una fixture autouse de `conftest.py` ejecuta `limiter.reset()` antes de cada test y desactiva el hilo de purga de `MemoryStorage` (lee el reloj real y borraría entradas creadas bajo `freezegun`); el tiempo de las ventanas se controla con `freezegun` y la IP de la conexión con `TestClient(app, client=(ip, puerto))`. Suites en `backend/tests/integration/` y `backend/tests/unit/` (config, engine, mixins, Cloudinary, plantillas `.env`, guardia de BD, `LimitadorPorClave`). Ningún test llama a las APIs reales de MercadoPago ni Cloudinary.

**Cobertura (PA-16, C-25a):** el umbral vive en `backend/.coveragerc` (`[run] source = app`; `[report] fail_under = 60`, `show_missing = true`) y se mide con `pytest --cov --cov-report=term` desde `backend/` (no está en `addopts`, para no ralentizar la corrida diaria). Si el total baja de 60% el comando falla. Marker `e2e` (declarado en `pytest.ini`): flujos completos por HTTP (compra, pago, entrega; solo el SDK de MercadoPago se reemplaza), `pytest -m e2e`. **Tests de arquitectura y contrato:** `tests/unit/test_arquitectura_capas.py` (dependencia unidireccional, routers sin acceso a datos, `core` sin `modules`, capas inferiores sin FastAPI), `tests/unit/test_estructura_modulos.py` (estructura objetivo de módulos) y `tests/integration/test_contrato_rutas.py` (contrato de rutas: los renombres internos no cambian ninguna ruta pública).
