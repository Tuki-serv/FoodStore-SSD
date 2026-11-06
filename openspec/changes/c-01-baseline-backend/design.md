# Design — C-01 `baseline-backend`

## Context

- Motivación y alcance: ver `proposal.md`. Requisitos: `specs/backend-runtime/spec.md` y `specs/backend-config/spec.md`.
- Punto de partida: el backend base no trae `.env.example` ni `.env.test` (los ignora su `.gitignore`), ni `__init__.py` en `backend/app/`, `backend/app/core/` y `backend/app/modules/*`: son paquetes namespace, así que hace falta `pythonpath = .` en `pytest.ini`.
- Estado del código observado:
  - `database.py` lanza `ValueError` al importarse si falta `DATABASE_URL`.
  - `cloudinary/service.py` llama a `cloudinary.config(...)` al importarse, así que `CLOUDINARY_*` es obligatoria incluso en tests (con valores mock).
  - `lifespan` hace `create_all` salvo con `ENVIRONMENT=test`.
  - `UnitOfWork.__exit__` hace `session.commit()` o `session.rollback()`.
  - `main.py` parsea `CORS_ORIGINS` con `split(",")`.
  - En `pagos/service.py` y `pagos/router.py`, `NGROK_URL` arma `notification_url` y `back_urls`, y `VITE_FRONTEND_URL` arma el redirect al frontend.
  - No existe ruta `/health`, aunque `RateLimitMiddleware.EXCLUDED_PATHS` ya la excluye.
  - El `conftest.py` original usa SQLite con parches `@compiles(ARRAY)` y `date_trunc`, inicia sesión vía cookie y siembra `COCINA` y `CANCELADO.orden=99` (deuda que se corrige en otros changes).
- Restricciones: CLAUDE.md (reglas duras 1-15) y DD-16/DD-17: el código se incorpora **tal cual**. Solo se toca lo que exige el alcance de C-01.

## Goals / Non-Goals

**Goals:**
- Que el código incorporado sea **fiel** al backend base, salvo las ediciones listadas en D2, D3, D4, D5 y D9.
- Una suite reproducible sobre PostgreSQL real, aislada por test y sin riesgo para los datos de desarrollo.
- Que la configuración sea testeable sin efectos de import: los tests de `Settings` no deben requerir BD.

**Non-Goals:**
- Corregir lógica de negocio, permisos, contratos de API o formatos de paginación. Todo eso es DT-xx y le corresponde a C-02..C-12.
- Renombrar módulos a los nombres objetivo de la spec: `auth` y `refreshtokens` en C-02, que los reescribe; `direcciones`, `admin`, `core/uow.py` y el resto en C-25. (El typo `minxins` sí se corrige en C-01, ver D2.)
- Sacar `create_all` del lifespan o del seed, e introducir Alembic (C-06).
- Fijar versiones en `requirements.txt` o agregar dependencias.

## Decisions

### D1. Incorporación del backend base y reubicación
El backend base se incorpora sin cambios de lógica y después se aplica la reubicación.
- *Reubicación*: `main.py` → `backend/app/main.py`, `seed.py` → `backend/app/db/seed.py`, `reset.py` → `backend/app/db/reset.py`, más `backend/app/db/__init__.py`. Se ajustan los imports que referían `main` (en `backend/tests/conftest.py`: `from app.main import app`). El docstring del seed pasa a `python -m app.db.seed`.
- `.gitignore`: se mantiene **sin** la línea `docs/`, porque en este repo `docs/` contiene la spec.

### D2. Estructura resultante
Es la de `knowledge-base/08` (§Estructura), con `main.py` y `seed.py` dentro de `backend/app/`, más `backend/app/modules/health/router.py` (D4). Los módulos feature-first conservan su nombre actual (DD-02). Renombrarlos ahora rompería los imports que C-02..C-12 van a tocar, y generaría churn sin valor de comportamiento. Los renombres quedan para C-02 (`auth`, `refreshtokens`) y C-25 (el resto), por decisión del usuario.
- **Typo `minxins` → `mixins`, corregido en C-01**: es una sola carpeta (`backend/app/core/minxins/auditable_mixin.py`) y la importan 6 líneas idénticas en `categorias`, `ingredientes`, `pedidos`, `productos`, `unidades_medida` y `usuarios` (`models.py`). El reemplazo es mecánico. Se verifica con `compileall`, con un grep vacío de `minxins` y con un test que importa `app.core.mixins.auditable_mixin.UniqueAuditableMixin`.

### D3. Configuración (`backend/app/core/config.py`)
- `CORS_ORIGINS: list[str]`. pydantic-settings decodifica JSON para tipos complejos de forma nativa, así que una cadena con comas falla la validación, que es lo que pide la spec. `backend/app/main.py` usa la lista directamente y desaparece el `split(",")`.
- Se agrega `MP_NOTIFICATION_URL` (opcional, grupo pagos). Se quitan `MP_WEBHOOK_URL`, `NGROK_URL` y `VITE_FRONTEND_URL`. `VITE_API_URL` también sale de `Settings`, porque es variable del frontend y queda documentada en `.env.example`. `extra="allow"` se cambia a `extra="ignore"`, así una variable retirada presente en el `.env` no queda como atributo ni altera valores efectivos (spec «Variables retiradas»).
- **Convención: explícitas (decisión del usuario, aplica a todo el proyecto)**. Toda variable vive en `.env` / `.env.example` y se declara en `Settings`. **No hay valores derivados** de otras variables: no se usan propiedades calculadas. No hay excepciones; se elimina incluso la construcción preexistente de `DATABASE_URL` desde `POSTGRES_*`. `Settings` sigue siendo un singleton de módulo (`from app.core.config import settings`), sin `Depends`.
- **Convención: obligatoria u opcional según si la app la necesita para funcionar (decisión del usuario, criterio refinado)**. Ningún campo tiene un valor por defecto *oculto*: ni URLs `localhost` ni constantes.
  - **Obligatorias (sin default, fail-fast)**: las que la app necesita para funcionar. Son `ENVIRONMENT`, `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `LOG_LEVEL`, `SQL_ECHO`, `CORS_ORIGINS` y los 4 `RATE_LIMIT_*` (aprobado por el usuario hasta que C-03 los retire). Si falta una, `Settings()` lanza `ValidationError` nombrándola; como `settings` se instancia al importar `app.core.config`, la app no arranca.
  - **Opcionales por funcionalidad (`Optional[...] = None`)**: las de integraciones que no se necesitan para probar el CRUD. `None` significa «funcionalidad no configurada», no es un valor sustituto. La funcionalidad falla con un error claro y específico solo cuando se usa sin ellas. Motivo del usuario: accesibilidad, porque quien clone el proyecto para probar el CRUD no debe necesitar cuentas de MercadoPago ni de Cloudinary.
    - **Imágenes**: `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (ver D9).
    - **Pagos**: `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY`. Esto revierte la decisión previa (b): la rama «MercadoPago no configurado» de `pagos/service.py` vuelve a ser alcanzable y es el comportamiento previsto. Su código pasa de 400 a **503** (decisión g).
    - **URLs del flujo de pago, opcionales** (decisión f, aprobada): `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL` solo se usan al crear un pago y en el redirect post-pago. Ninguna otra parte de la app las lee, así que son **opcionales, del mismo grupo que MP**, y se validan al usarse:
      - `crear_pago` extiende su chequeo existente («MercadoPago no configurado») para que también falle si falta `MP_NOTIFICATION_URL` o `BACKEND_PUBLIC_URL`. Lo hace antes de contactar a MP, nombra las faltantes en el `detail` y responde **503** en lugar del 400 anterior (cambio deliberado, decisión g).
      - `GET /pagos/redirect/...` responde **503** si falta `FRONTEND_URL`.
      - La alternativa, hacerlas obligatorias, obligaría a definir URLs de pago para probar el CRUD, lo que contradice el criterio.

  `model_config` agrega `env_ignore_empty=True`: una opcional escrita vacía en `.env` (`MP_ACCESS_TOKEN=`) se trata como ausente (`None`), no como `""`. Una obligatoria vacía falla como faltante.
  Se conservan los tipos y `Literal` (`ENVIRONMENT`, `LOG_LEVEL`) para la validación de formato. Las propiedades `rate_limit_*` son alias sin lógica: se mantienen, porque las consume el middleware.
  - **BD (decisión del usuario)**: `DATABASE_URL: str` es obligatoria y es la **única** configuración de BD que lee `Settings`.
    - Se eliminan el `model_validator` `fix_database_url`, la construcción desde `POSTGRES_*` con sus fallbacks `localhost` y `5432`, y la normalización `postgresql://` → `postgresql+psycopg://`. La URL se usa tal cual, así que `.env.example` documenta que debe escribirse con el esquema `postgresql+psycopg://`.
    - Los 5 campos `POSTGRES_*` se **quitan** de `Settings`. `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` los consume **solo docker-compose** (verificado en el `docker-compose.yml`: crean el usuario y la base del contenedor, y alimentan el healthcheck), igual que `PGADMIN_EMAIL` y `PGADMIN_PASSWORD` (login de pgAdmin). Viven en el `.env` de la **raíz** (y su `.env.example`; D11), que solo lee docker-compose, con el comentario de mantener `DATABASE_URL` consistente a mano (usuario, contraseña, base, puerto host 5433). Con `extra="ignore"`, que estén en `.env` no afecta a `Settings`.
    - El `ValueError` de `database.py` si falta `DATABASE_URL` queda inalcanzable, porque `Settings` ya falla antes. Se conserva como defensa por fidelidad al código base.
  - **Tests y MP**: ningún test llama a la API real de MP (`test_pago.py` solo cubre el 404 y el webhook ignorado). `.env.test.example` **no** define variables MP ni Cloudinary. El test 503 de «MercadoPago no configurado» corre sin ellas, y el camino configurado se prueba con el SDK mockeado.
- Variables explícitas nuevas del grupo pagos, **opcionales y sin valor sustituto**:
  - `MP_NOTIFICATION_URL: Optional[str] = None`: el `notification_url` de la preferencia.
  - `BACKEND_PUBLIC_URL: Optional[str] = None`: la base de las `back_urls` (`{BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{id}/{status}`).
  - `FRONTEND_URL: Optional[str] = None`: el destino del redirect post-pago en `pagos/router.py`. Reemplaza el `getattr(..., "http://localhost:5173")`.

  `BACKEND_PUBLIC_URL` y `FRONTEND_URL` son removibles en C-12, cuando Checkout API elimine el redirect.
  - **Desviación deliberada de la spec**: DT-22 retira `VITE_FRONTEND_URL` y no prevé una variable equivalente propia del backend, ni una base pública para las `back_urls`. Se registra en la KB para una futura actualización de la spec (tarea 6.3).
  - *Alternativa descartada*: derivar el frontend de `CORS_ORIGINS[0]` y la base del host de `MP_NOTIFICATION_URL`. El usuario la rechazó porque acopla variables con propósitos distintos.
- `SQL_ECHO: bool`, obligatoria y sin default. `backend/app/core/database.py` pasa a `create_engine(settings.DATABASE_URL, echo=settings.SQL_ECHO)`. Antes era `echo=True` fijo.
- `pagos/service.py` y `pagos/router.py` reemplazan sus lecturas de `settings.NGROK_URL` y `VITE_FRONTEND_URL` (`getattr` con fallback) por `settings.MP_NOTIFICATION_URL`, `settings.BACKEND_PUBLIC_URL` y `settings.FRONTEND_URL`, con el chequeo al usarse descrito arriba. También desaparece la normalización `https://` de `NGROK_URL`, porque las variables nuevas son URLs completas. Si están configuradas, las URLs resultantes son las mismas que antes.
- Testabilidad:
  - Los tests de config instancian `Settings(_env_file=None)` sobre un entorno controlado, así no dependen de `app.core.database` ni de `.env`.
    - Una fixture `required_env` define un dict con las variables **obligatorias** y placeholders falsos. `full_env` agrega las opcionales (MP, URLs de pago y Cloudinary) con dummies, para los casos «configuración completa».
    - `monkeypatch` primero limpia del entorno todas las claves de `Settings.model_fields`, que `pytest-dotenv` cargó desde `backend/tests/.env.test`, y después aplica `full_env`.
    - Cada caso de «falta X» hace `delenv(X)` sobre ese entorno completo.
  - El test de `SQL_ECHO` necesita que el engine se construya con una función testeable. Para eso se extrae `build_engine(cfg: Settings) -> Engine` en `database.py`, y el `engine` de módulo queda como `build_engine(settings)`. El test verifica `build_engine(cfg).echo` con `SQL_ECHO` en true y en false. Es un refactor mínimo que habilita el test RED.

### D4. Endpoint `/health`
`backend/app/modules/health/router.py` expone un `APIRouter` con `GET /health` → `{"status": "ok"}`. Se monta en `create_app()` sin prefijo y no toca la BD ni dependencias (liveness). Se elige un módulo propio para respetar «routers como capa superior» sin meter lógica en `main.py`.
- *Alternativa*: un readiness con `SELECT 1`. Se descarta porque la spec pide no consultar la BD, y un readiness puede venir después.

### D5. Estrategia de BD de tests (PA-10 resuelta: PostgreSQL real)
- **`.env.test` NO se versiona. Se versiona `.env.test.example`** (decisión tomada; ver Open Questions). El motivo: `.env.test` tiene que llevar la contraseña real del Postgres local de cada desarrollador (la del `.env` usado por docker-compose), y la regla 10 prohíbe commitear secretos. Además, como las obligatorias no tienen default, no hay forma de que un archivo versionado funcione para todos sin contener credenciales. La decisión (c) está **confirmada por el usuario**.
  - `.env.test.example` tiene **todas las obligatorias** de `Settings` con placeholders evidentemente falsos:
    - `ENVIRONMENT=test`
    - `DATABASE_URL=postgresql+psycopg://CHANGE_ME_USER:CHANGE_ME_PASSWORD@localhost:5433/foodstore_test`
    - `SECRET_KEY=test-only-not-a-secret-…` (64 caracteres)
    - `SQL_ECHO=false`
    - el rate limit con valores altos, para no producir 429 espurios
    - `CORS_ORIGINS`
  - Las opcionales (`MP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`, `CLOUDINARY_*`) aparecen **comentadas o vacías**, con la nota «opcional: la suite corre sin ellas». Los tests que necesitan el camino configurado las inyectan con `monkeypatch` y mockean el SDK.
  - El desarrollador lo copia a `.env.test` y completa usuario y contraseña de su Postgres.
  - `.gitignore`: se mantienen `.env` y `.env.*` ignorados. Se **quita** la excepción `!.env.test` previa y se agrega `!.env.test.example` junto a `!.env.example`.
  - `pytest.ini` declara `env_files = tests/.env.test` (se corre desde `backend/`; D11), y `pytest-dotenv` lo carga antes del import de `app.*`.
  - `conftest.py` **no** depende de defaults de `Settings`. Si falta `backend/tests/.env.test`, aborta con `pytest.exit("Falta backend/tests/.env.test: copiá backend/tests/.env.test.example y completá las credenciales")` antes de importar `app.*`.
- Los `POSTGRES_*`/`PGADMIN_*` ya no van en `.env.test.example` sino en el `.env.example` de la raíz (D11); la advertencia de consistencia manual con `DATABASE_URL` se mantiene. Los tests reutilizan el contenedor de desarrollo: solo cambia el nombre de la base en `DATABASE_URL`.
- **Guardia de seguridad**: un hook temprano de `conftest.py` (`pytest_sessionstart` o un chequeo a nivel de módulo antes de importar `app.main`) aborta con `pytest.exit(...)` si `ENVIRONMENT != "test"` o si el nombre de la base no termina en `_test`. Ese nombre se parsea del path de `settings.DATABASE_URL` con `sqlalchemy.engine.make_url(url).database`, que es la única fuente.
- **Creación de la base**: una fixture `scope="session"` se conecta a la base de mantenimiento `postgres` (mismo host y credenciales, `AUTOCOMMIT`) y ejecuta `CREATE DATABASE foodstore_test` si no existe. Después hace `SQLModel.metadata.drop_all` + `create_all` sobre el engine de test, una vez por sesión. C-06 cambiará este paso por `alembic upgrade head`.
  - *Alternativa*: un init script de docker-compose (`/docker-entrypoint-initdb.d`). Se descarta porque solo corre con el volumen vacío, y el volumen de desarrollo ya puede existir.
- **Aislamiento por test**: cada test usa la receta de SQLAlchemy 2.x «join into external transaction»:
  1. `connection = engine.connect()`
  2. `trans = connection.begin()`
  3. `Session(bind=connection, join_transaction_mode="create_savepoint")`
  4. Al terminar el test: `session.close()`, `trans.rollback()`, `connection.close()`

  Así, los `commit()` y `rollback()` del `UnitOfWork` operan sobre savepoints y nada persiste entre tests. Es más rápido que hacer `drop_all` por test.
- Se eliminan los parches SQLite (`compile_array_sqlite`, `date_trunc`) y el `StaticPool`.
- `get_session` se sobrescribe con la sesión de test, igual que antes. Los helpers de auth siguen usando cookie, porque Bearer llega en C-02.

### D6. Tests incorporados
Se incorporan `backend/tests/integration/*` y `backend/tests/unit/test_rate_limiter.py` sin cambios de aserciones. Las fallas que aparezcan al correrlos sobre Postgres se clasifican así:
- **(a) Artefacto de infraestructura de tests** (por ejemplo, `pedido_db` usa `direccion_id=1` sin crear la dirección: SQLite no valida FKs, Postgres sí). Se corrige el *fixture* en C-01.
- **(b) Comportamiento del producto que diverge de la spec o es un bug** (DT-xx). Se marca `@pytest.mark.xfail(strict=True, reason="DT-xx → C-yy")`, sin tocar el código de producción.
- Cada falla y su clasificación quedan registradas en `tasks.md` (sección de baseline) y en el resumen del apply.

El objetivo es una suite **verde o xfail explícita**, sin fallas silenciosas. El seed de roles del conftest (incluye `COCINA`) se mantiene: lo resuelven C-07 y C-26.

### D7. Organización de los tests nuevos
- `backend/tests/unit/test_config.py`: `Settings`, sin BD. Cubre todos los escenarios de `backend-config` excepto «Entorno de tests aislado» y «Logging de SQL configurable».
- `backend/tests/unit/test_database_engine.py`: `build_engine` respeta `SQL_ECHO`. Construye el engine, no conecta.
- `backend/tests/unit/test_cloudinary_service.py`: D9. Cubre el import sin credenciales, el upload sin configurar (503), el delete sin configurar (no-op, `False`) y el camino configurado, con `cloudinary.config` y `cloudinary.uploader` mockeados. Nunca llama a la API real.
- `backend/tests/integration/test_optional_integrations.py`:
  - la app arranca y `GET /api/v1/productos/` responde sin `MP_*` ni `CLOUDINARY_*`
  - el soft delete de un producto con imágenes responde 204 sin Cloudinary
  - `POST /api/v1/pagos/crear` responde 503 «MercadoPago no configurado» sin `MP_ACCESS_TOKEN`
  - el redirect responde 503 sin `FRONTEND_URL`
- `backend/tests/unit/test_mixins_import.py`: importa `UniqueAuditableMixin` desde `app.core.mixins` y verifica que `app.core.minxins` ya no existe.
- `backend/tests/unit/test_env_example.py`: parsea `.env.example`, valida que no tenga claves retiradas y que `Settings` cargue con él.
- `backend/tests/integration/test_app_startup.py`: factory, `/openapi.json`, montaje bajo `/api/v1`, 404 y 422 uniformes y CORS. Usa `client`.
- `backend/tests/integration/test_health.py`: `GET /health` y su exclusión del rate limiting.
- `backend/tests/unit/test_test_db_guard.py`: la función pura de guardia (`is_safe_test_database_url(url) -> bool`) sobre URLs `_test` y no `_test`. Va en un módulo de soporte `backend/tests/support/db_guard.py`, para que pueda testearse sin abortar la sesión.

Las reglas de `python-testing-patterns` y `tdd` aplican: AAA, nombres `test_<unidad>_<escenario>_<esperado>`, fixtures en `conftest.py`, mocks solo en bordes externos (MP, Cloudinary), literales independientes (no recalcular el valor esperado) y tests por interfaz pública.

### D9. Cloudinary opcional, con configuración perezosa (`backend/app/core/cloudinary/service.py`)
Es un cambio mínimo, exigido por el criterio «opcional por funcionalidad». El resto del módulo queda intacto.
- Se elimina el `cloudinary.config(...)` a nivel de módulo, que hoy fuerza las credenciales al importar y, por la cadena de imports, al arrancar la app.
- Se agrega un helper privado `_asegurar_configuracion() -> bool`:
  - Si las tres `CLOUDINARY_*` están definidas, llama a `cloudinary.config(..., secure=True)` una sola vez, con un flag de módulo, y devuelve `True`.
  - Si falta alguna, devuelve `False` sin tocar el SDK.
- `subir_imagen`: después de `_validar_archivo_imagen`, para conservar el 400 por archivo inválido, si `_asegurar_configuracion()` es `False` lanza `HTTPException(503, "El servicio de imágenes no está configurado (faltan variables CLOUDINARY_*)")`.
  - Se elige **503 Service Unavailable** porque el servidor no puede atender esa funcionalidad por configuración, y el problema no es del request (400 no corresponde). 500 sugeriría un bug. El mismo criterio aplica a pagos y al redirect (decisión g).
  - El handler de errores lo devuelve como `{detail, code: "HTTP_503", field: null}`.
- `eliminar_imagen`: con `public_id` vacío sigue devolviendo `True` (sin cambios). Si no hay configuración, registra un `logger.warning` y devuelve `False`, igual que la semántica existente de «limpieza secundaria»: el soft delete de entidades nunca falla por la ausencia de Cloudinary. `eliminar_multiples_imagenes` lo hereda sin cambios.
- El `HTTPException` dentro del servicio core sigue siendo deuda (auditoría, punto 7). No se refactoriza en C-01.

### D10. Estructura del repo: raíz = gestión, código en `backend/` y `frontend/`
Decisión del usuario, posterior a la incorporación inicial: **sustituye** la elección inicial de dejar `app/` en la raíz. La raíz es solo de gestión del proyecto (`openspec/`, `knowledge-base/`, `docs/`, `design-system/`, `CHANGES.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` de proyecto, `todoAMd/`, `.atl/`, `.claude/`). El backend vive en `backend/` (`app/`, `tests/`, `pytest.ini`, `requirements.txt`, `Dockerfile`, `README.md`, `.env`, `tests/.env.test*`) y el frontend vivirá en `frontend/` (llega en C-13). Los tests nunca conviven con los directorios de gestión.
- Todos los comandos de backend (`pytest`, `uvicorn app.main:app`, `python -m app.db.seed`, `pip install -r requirements.txt`) se corren **desde `backend/`**; `docker compose` se corre desde la raíz (D11). Por eso no cambia ningún path relativo: `pythonpath = .` de `pytest.ini`, el `env_file=".env"` de `Settings`, `_ROOT` de `conftest.py` y el default de `ENV_EXAMPLES_DIR` resuelven dentro de `backend/`.
- `.gitignore` queda en la raíz; sus patrones `.env`, `.env.*`, `!.env.example`, `!.env.test.example` no están anclados, así que también aplican dentro de `backend/`. `docs/` no se ignora.
- `backend/.env(.example)` (backend) y `backend/tests/.env.test(.example)` (tests) van en `backend/`; el `.env(.example)` de compose va en la raíz (D11).

### D11. `docker-compose.yml` en la raíz orquesta todo el proyecto
Decisión del usuario, posterior a D10: `docker-compose.yml` vive en la **raíz** y orquesta todo el proyecto (`db`, `pgadmin`, `backend`; `frontend` llega en C-13); el `docker-compose.yml` de `backend/` se eliminó.
- `backend/Dockerfile` (+ `.dockerignore`) construye la imagen del backend; el servicio `backend` usa `build.context: ./backend`. En C-01 no se levanta ni se construye: solo se usa `db`.
- La `DATABASE_URL` del contenedor `backend` se declara en el propio compose (host `db:5432`) y pisa la de `backend/.env` (`localhost:5433`, para uvicorn/pytest locales).
- El `.env` de la raíz es **solo para compose** (`POSTGRES_*`, `PGADMIN_*`); no se valida contra `Settings` (un test verifica que contiene exactamente esas claves).
- Los tests leen `backend/tests/.env.test`; `pytest.ini` declara `env_files = tests/.env.test`, relativo a `backend/` (se corre desde ahí).

## Auditoría PA-09 (permisos de productos, Cloudinary e ingredientes)

Los 4 archivos auditados se incorporan tal cual. Hallazgos frente a la spec (`knowledge-base/03` RN de STOCK, RN-PR-02/03, DT-16). **No se corrigen en C-01.**

| Archivo | Cumple | Gap / deuda | Change destino |
|---|---|---|---|
| `productos/router.py` | `POST`, `PUT`, `DELETE`, `PATCH /{id}/imagenes` y `POST /{id}/ingredientes` son solo ADMIN. Existe `PATCH /{id}/disponibilidad` con ADMIN+STOCK | (1) STOCK **no** puede actualizar `stock_cantidad`: solo `PUT` (ADMIN) lo permite. (2) `PATCH /disponibilidad` es un **toggle sin body**: no es idempotente y no recibe el valor deseado. (3) La lectura pública acepta `estado` (eliminados) e `include_deleted`, y `disponible` es opcional (`None` = todos), así que el público puede ver productos no disponibles o eliminados (viola RN-PR-03) | C-08 (1, 2); C-08/C-11 (3) |
| `productos/service.py` | La limpieza de Cloudinary corre fuera del UoW, después del commit. La paginación respeta `{items,total,page,size,pages}` | (4) Lanza `HTTPException` desde el service: acopla la capa a HTTP. (5) La unicidad de nombre incluye eliminados (`include_deleted=True`) y contradice los índices parciales de DD-04. Además responde 400 donde correspondería 409 | C-08 / C-11 (contrato); regla dura 1 a revisar |
| `core/cloudinary/service.py` | Valida MIME y tamaño (5 MB). El delete es idempotente y no aborta la transacción | (6) `cloudinary.config` se ejecutaba al importarse y obligaba a tener `CLOUDINARY_*` aun en tests. **Resuelto en C-01 (D9)**: la configuración pasa a ser perezosa y opcional. (7) `HTTPException` en un servicio core. Es un extra no especificado (PA-19), y su router es solo ADMIN | (6) C-01; (7) C-28 / PA-19 |
| `ingredientes/service.py` | Las escrituras son solo ADMIN (router). La lectura es pública, así que STOCK puede leer ingredientes y alérgenos (cumple) | (8) Lectura pública con `estado` e `incluir_eliminado`: expone eliminados. (9) Mismo patrón de unicidad con eliminados, 400 y `HTTPException` en el service | C-08 / C-11 |

Conclusión PA-09: **contenido disponible y auditado**. Los permisos de escritura ADMIN son correctos. PATCH disponibilidad existe pero es un toggle, y la actualización de stock por STOCK **falta**. Se registra en CHANGES.md como insumo de C-08.

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-03
- Mockups: N/A

## Risks / Trade-offs

- [Encoding o espacios inconsistentes en los archivos incorporados] → Se usa UTF-8 sin BOM con fin de línea `\n`, y se verifica con `python -m compileall backend/app backend/tests` antes del primer test.
- [Los tests requieren Docker y Postgres levantados] → `README.md` documenta `docker compose up -d db` (desde la raíz). La guardia y la fixture de creación dan mensajes claros si no hay conexión.
- [El `create_all` en tests diverge del esquema que generará Alembic] → Es aceptable hasta C-06, que cambia la fixture por `alembic upgrade head` y agrega el test esquema == modelos.
- [Los tests existentes codifican comportamiento de deuda (403 en email duplicado, cookie)] → Se mantienen. Los changes que corrijan cada DT actualizan esas aserciones. Lo que falle se marca xfail estricto con referencia (D6).
- [`CORS_ORIGINS` en JSON rompe los `.env` existentes] → El cambio es BREAKING documentado y `.env.example` sirve de plantilla. El error de validación nombra la variable.
- [Fricción de onboarding: un `.env` sin alguna obligatoria impide arrancar, y los tests requieren un `.env.test` con las obligatorias] → Se acota: solo son obligatorias las variables que la app necesita para funcionar. MercadoPago y Cloudinary son opcionales, así que se puede probar el CRUD sin cuentas externas. `.env.example` y `.env.test.example` traen todas las variables con placeholders evidentemente falsos (`CHANGE_ME_*`) y un comentario por variable, que marca qué es opcional. El `ValidationError` enumera las faltantes, el conftest da un mensaje explícito si falta `.env.test`, y el README documenta el copiado.
- [Una integración opcional no configurada se descubre recién al usarla] → Es el comportamiento buscado. El error es específico: 503 con formato uniforme, que nombra lo faltante («MercadoPago no configurado», «servicio de imágenes no configurado», «`FRONTEND_URL` no configurada») y está cubierto por tests. El README lista qué variables habilita cada integración.
- [La consistencia entre `DATABASE_URL` y los `POSTGRES_*` de docker-compose es manual: si difieren, la app no conecta] → Es un riesgo conocido de onboarding. Se mitiga con el comentario explícito en el bloque «docker-compose» de ambos `.example` (qué campos deben coincidir, puerto host 5433) y con la sección del README que muestra un ejemplo coherente. El error de conexión de psycopg nombra usuario y base, lo que facilita el diagnóstico.
- [El test que compara `Settings` con `.env.example` puede romperse al agregar variables] → Es intencional: obliga a documentar toda variable nueva (regla del proyecto).

## Migration Plan

1. Copiar `backend/.env.example` → `backend/.env` y completar **todas las obligatorias**. No tienen default: si falta una, la app no arranca y el error la nombra. Completar las opcionales solo para usar pagos o imágenes. Copiar `backend/tests/.env.test.example` → `backend/tests/.env.test` y completar las credenciales de Postgres; copiar `.env.example` → `.env` en la raíz (compose).
2. `docker compose up -d db` (desde la raíz). La base `foodstore_test` la crea la fixture.
3. Respecto de un `.env` previo:
   - agregar las obligatorias que antes tenían default (`ENVIRONMENT`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `LOG_LEVEL`, `RATE_LIMIT_*`, `SQL_ECHO`)
   - definir `DATABASE_URL` (`postgresql+psycopg://…`) coherente con los `POSTGRES_*` del compose; la ruta alternativa por `POSTGRES_*` ya no existe en el backend
   - pasar `CORS_ORIGINS` a JSON
   - reemplazar `NGROK_URL` por `BACKEND_PUBLIC_URL=<ngrok>` y `MP_NOTIFICATION_URL=<ngrok>/api/v1/pagos/webhook` (opcionales; solo para pagos)
   - reemplazar `VITE_FRONTEND_URL` por `FRONTEND_URL` (opcional; solo para el redirect de pagos)
4. Arrancar con `uvicorn app.main:app --reload` y cargar el seed con `python -m app.db.seed`.

Rollback: no hay estado persistente nuevo. Revertir los archivos incorporados alcanza.

## Open Questions

Resueltas por el usuario (2026-11-03):

- ~~URL del frontend para el redirect post-pago~~ → **RESUELTA**: variable explícita `FRONTEND_URL`, más `BACKEND_PUBLIC_URL` para las `back_urls`. Sin derivaciones, por convención de proyecto (D3). Es una desviación de la spec y queda registrada para actualizarla. Ambas son removibles en C-12.
- ~~Renombrar módulos a la estructura objetivo~~ → **RESUELTA (opción A)**: `auth` y `refreshtokens` en C-02; `direcciones`, `admin`, `core/uow.py` y el resto en C-25. El typo `minxins` → `mixins` se corrige en C-01 (D2).
- ~~`echo=True` del engine~~ → **RESUELTA**: variable explícita `SQL_ECHO`, obligatoria y sin default (`false` en los `.example`), con test RED primero (D3, D7).
- ~~Defaults en `Settings`~~ → **RESUELTA (criterio refinado)**: sin valores por defecto ocultos. Son obligatorias (fail-fast) las variables necesarias para que la app funcione; las de integraciones opcionales son `Optional = None` y fallan con un error específico al usarse (D3).
- ~~(a) BD~~ → **RESUELTA**: `DATABASE_URL` es obligatoria y es la única variable de BD de `Settings`. Sin validador ni construcción desde `POSTGRES_*`, que quedan solo para docker-compose (D3).
- ~~(b) MercadoPago~~ → **RESUELTA en sentido contrario a la propuesta previa**: `MP_ACCESS_TOKEN` y `MP_PUBLIC_KEY` son **opcionales** (`None`). La rama «MercadoPago no configurado» es alcanzable y está testeada; responde 503 según la decisión (g). `.env.test.example` no lleva dummies de MP.
- ~~(c) `.env.test`~~ → **RESUELTA (confirmada)**: se versionan solo los `.example`; `.env` y `.env.test` reales quedan ignorados.
- ~~(d) `RATE_LIMIT_*`~~ → **RESUELTA (aprobada)**: obligatorias hasta que C-03 las retire.
- ~~Cloudinary~~ → **RESUELTA**: `CLOUDINARY_*` son opcionales, con configuración perezosa. El upload sin credenciales responde 503 y el delete es un no-op (D9).

- ~~(e) Claves extra en los `.example`~~ → **RESUELTA (aprobada)**: solo se permiten dentro de bloques rotulados de docker-compose (`POSTGRES_*`, `PGADMIN_*`) y de frontend (`VITE_*`).
- ~~(f) URLs del flujo de pago~~ → **RESUELTA (aprobada)**: `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL` son **opcionales**, del grupo pagos. Solo hacen falta para usar el módulo de pagos y se validan al usarse (D3).
- ~~(g) Códigos HTTP~~ → **RESUELTA**: **503 en todos los casos de «funcionalidad no configurada»**, con el formato uniforme `{detail, code: "HTTP_503", field}`: crear un pago sin MercadoPago o sin sus URLs, el redirect sin `FRONTEND_URL` y el upload sin Cloudinary. Para pagos es un **cambio deliberado** respecto del 400 anterior.

No quedan preguntas abiertas.
