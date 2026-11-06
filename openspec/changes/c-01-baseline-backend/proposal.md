# Proposal — C-01 `baseline-backend`

## Why

El repo todavía no tiene el backend base ejecutable, ni suite de tests, ni `.env.example`. Todos los changes posteriores (C-02..C-12) corrigen deuda técnica sobre el backend, así que primero necesitan una base incorporada, ubicada en la estructura de la spec (`backend/app/main.py`, `backend/app/db/seed.py`), con variables de entorno alineadas (DT-22) y una suite pytest que corra contra PostgreSQL real (PA-10 resuelta).

## What Changes

- **Incorporar el backend base** al repo, tal cual (sin corregir lógica de negocio):
  - `main.py` (raíz) → `backend/app/main.py`; `seed.py` → `backend/app/db/seed.py` (ejecutable con `python -m app.db.seed`); `reset.py` → `backend/app/db/reset.py`. **BREAKING** para el arranque: `uvicorn app.main:app` reemplaza `uvicorn main:app`.
  - Módulos feature-first de `backend/app/core/` y `backend/app/modules/` en sus rutas actuales; `requirements.txt`, `pytest.ini`, `.gitignore`, `README.md`.
- **Nuevo endpoint `GET /health`** (liveness, sin BD, sin auth).
- **Alinear variables de entorno (DT-22)**:
  - `CORS_ORIGINS` pasa a ser un **array JSON** (`["http://localhost:5173"]`). **BREAKING**: el formato separado por comas deja de aceptarse.
  - Se agrega `MP_NOTIFICATION_URL` (URL completa del webhook).
  - Se retiran `MP_WEBHOOK_URL`, `NGROK_URL` y `VITE_FRONTEND_URL` de `Settings`. **BREAKING**: los `.env` existentes deben migrarse.
  - **Convención de proyecto**: toda variable de configuración vive en `.env` / `.env.example` y se declara en `Settings`, y ningún valor se deriva de otra variable. Por eso se agregan `FRONTEND_URL` (destino del redirect post-pago) y `BACKEND_PUBLIC_URL` (base de las `back_urls`). Las dos son explícitas y removibles en C-12. Es una **desviación deliberada de la spec**: DT-22 retira `VITE_FRONTEND_URL` pero no prevé una variable equivalente propia del backend.
  - Se agrega `SQL_ECHO` (bool), que controla el `echo` del engine. Antes estaba fijo en `True`.
  - **Sin valores por defecto ocultos; obligatoria = necesaria para que la app funcione**. **BREAKING**: una variable obligatoria faltante impide el arranque con un error de validación que la nombra. Esto incluye las que antes tenían default (`ENVIRONMENT`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `LOG_LEVEL`, `RATE_LIMIT_*` hasta C-03, `SQL_ECHO`).
  - **Integraciones opcionales**: MercadoPago (`MP_*`, más `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL`) y Cloudinary (`CLOUDINARY_*`, que hoy son obligatorias) son `Optional = None`. La app y los tests arrancan sin ellas, para poder probar el CRUD sin cuentas externas. La funcionalidad responde con un error específico solo al usarse: 503 en formato uniforme («MercadoPago no configurado», que reemplaza deliberadamente el 400 anterior; upload de imagen sin Cloudinary; redirect sin `FRONTEND_URL`), y el borrado de imagen es un no-op que nunca hace fallar el soft delete.
  - **Cloudinary con configuración perezosa**: `core/cloudinary/service.py` deja de configurar el SDK al importarse (gap 6 de la auditoría PA-09, resuelto en C-01). **BREAKING** en la BD: `DATABASE_URL` pasa a ser obligatoria y es la **única** variable de BD que lee el backend. Se eliminan la construcción desde `POSTGRES_*` (con sus fallbacks `localhost` y `5432`) y la normalización del esquema, así que hay que escribirla como `postgresql+psycopg://…`. `POSTGRES_*` y `PGADMIN_*` quedan solo para docker-compose, en un bloque rotulado de los `.example`, y su consistencia con `DATABASE_URL` se mantiene a mano.
  - `.env.test` deja de versionarse. Se versiona `.env.test.example` con placeholders falsos; `.env` y `.env.test` quedan ignorados (regla 10).
  - `VITE_API_URL` deja de ser requerida por el backend (es variable del frontend) y se documenta en `.env.example` junto a `VITE_MP_PUBLIC_KEY`.
  - Se mantienen `ACCESS_TOKEN_EXPIRE_MINUTES`, `MP_ACCESS_TOKEN` y el resto de las variables actuales.
  - Nuevo `.env.example` completo, con todas las variables y placeholders, y `backend/tests/.env.test.example` apuntando a PostgreSQL `foodstore_test`.
- **Corrección del typo `backend/app/core/minxins/` → `backend/app/core/mixins/`**: es una sola carpeta con 6 imports, y se actualizan de forma mecánica.
- **Estrategia de BD de tests (PA-10)**: PostgreSQL 15 real en una base separada `foodstore_test` (mismo contenedor de docker-compose, puerto 5433). Se elimina el parche SQLite del `conftest.py`.
- **Suite pytest baseline**: se incorporan los tests existentes adaptados a la nueva ubicación y a Postgres, y se agregan tests de arranque de app, health y configuración por entorno.
- **Auditoría PA-09** de 4 archivos (`productos/router.py`, `productos/service.py`, `core/cloudinary/service.py`, `ingredientes/service.py`): queda una nota en `design.md` con los gaps, que se registran como deuda para C-08 y otros changes. C-01 no los corrige.
- **Documentación**: se corrige "SQLite en memoria" en `CLAUDE.md`, `AGENTS.md` y la KB (02, 08, 09, 10), y se marcan PA-09 y PA-10 como resueltas.

Fuera de alcance (lo hacen otros changes): Alembic y la eliminación de `create_all` (C-06), seed corregido (C-07), permisos STOCK y multi-rol (C-08), auth Bearer/refresh (C-02), slowapi (C-03), pagos (C-04, C-05, C-12), renombrar módulos a los nombres de la spec (`auth` y `refreshtokens` en C-02; `direcciones`, `admin`, `core/uow.py` y el resto en C-25).

## Capabilities

### New Capabilities
- `backend-runtime`: arranque de la aplicación FastAPI (factory `create_app` en `backend/app/main.py`, routers montados bajo `/api/v1`, CORS desde configuración, handlers de error) y endpoint de salud `GET /health`, y comportamiento cuando las integraciones opcionales no están configuradas (arranque sin ellas, upload 503, delete no-op, pago 503 y redirect 503).
- `backend-config`: configuración por entorno con `Settings` (pydantic-settings, singleton de módulo). Cubre: variables explícitas, sin derivaciones ni defaults ocultos; obligatorias (necesarias para funcionar, fail-fast al arrancar) versus opcionales por integración (`None`); nombres de la spec (DT-22) más `FRONTEND_URL`, `BACKEND_PUBLIC_URL` y `SQL_ECHO`; `CORS_ORIGINS` como array JSON; `DATABASE_URL` obligatoria y única configuración de BD, sin construcción ni normalización; `ENVIRONMENT` ∈ {development, production, test}; `.env.example` como contrato.

### Modified Capabilities
- (ninguna; `openspec/specs/` está vacío)

## Impact

- **Código**: nuevo árbol `backend/app/` (~95 archivos), `backend/tests/`, `docker-compose.yml` (raíz, D11), `backend/Dockerfile`, `backend/requirements.txt`, `backend/pytest.ini`, `.gitignore` en la raíz (sin `docs/` ni `!.env.test`, con `!.env.test.example`), `backend/README.md` (y `README.md` de proyecto en la raíz), `backend/.env.example`, `backend/tests/.env.test.example`, `.env.example` (raíz, solo compose). Estructura del repo: raíz = gestión, código en `backend/` y `frontend/` (design D10). Cambios mínimos sobre lo restaurado: `backend/app/core/config.py` (variables), `backend/app/core/database.py` (`echo=settings.SQL_ECHO`), `backend/app/core/minxins/` → `backend/app/core/mixins/` (más 6 imports en `models.py`), `backend/app/main.py` (CORS como lista y `/health`), `backend/app/core/cloudinary/service.py` (configuración perezosa y opcional), `backend/app/modules/pagos/service.py` y `router.py` (lectura de URLs desde las variables nuevas y chequeo «no configurado» al usarse), `backend/tests/conftest.py` (Postgres).
- **Operación** (código desde `backend/`, `docker compose` desde la raíz): el arranque pasa a `uvicorn app.main:app` y el seed a `python -m app.db.seed`. Los tests necesitan el contenedor `db` levantado (`docker compose up -d db`, desde la raíz). Quien clone el proyecto debe copiar `backend/.env.example` → `backend/.env`, `backend/tests/.env.test.example` → `backend/tests/.env.test` y `.env.example` → `.env` (raíz, compose) y completar las variables **obligatorias**, porque sin ellas la app y los tests no arrancan. MercadoPago y Cloudinary son opcionales.
- **Dependencias**: no se agregan paquetes de runtime. `pytest-dotenv` ya está en `requirements.txt`.
- **Docs**: `CLAUDE.md`, `AGENTS.md`, `knowledge-base/02,08,09,10` (incluye registrar la desviación `FRONTEND_URL`/`BACKEND_PUBLIC_URL` para una futura actualización de la spec), `CHANGES.md` (nota PA-10 en C-06, renombres en C-02 y C-25).
- **Governance**: MEDIO. Se toca la configuración de pagos solo para renombrar variables. Su comportamiento queda igual y su lógica es dominio de C-04, C-05 y C-12.
