# Tasks — C-01 `baseline-backend`

> Strict TDD: donde hay comportamiento testeable, cada tarea sigue el ciclo RED → GREEN → TRIANGULATE → REFACTOR, y los tests se **ejecutan** en cada gate. Skills: `python-testing-patterns`, `tdd` (compact rules en `.atl/skill-registry.md`).
> Hard rules: no levantar el dev server ni hacer build por iniciativa propia; solo correr `pytest`. No commitear. Sin secretos reales.
> Estructura (D10, D11): el código vive en `backend/`; `pytest`, `uvicorn` y `pip` se corren desde `backend/`; `docker compose` desde la raíz (el `docker-compose.yml` está en la raíz). Los tests leen `backend/tests/.env.test`.
> Prerrequisito para correr tests: el contenedor `db` levantado (`docker compose up -d db` desde la raíz, puerto 5433). Si no está disponible, frenar y reportarlo; no caer a SQLite.

## 1. Incorporación del backend base (sin tests: scaffolding)

- [x] 1.1 Incorporar el backend base al repo en UTF-8 con fin de línea LF.
- [x] 1.2 Reubicar `main.py` → `backend/app/main.py`, `seed.py` → `backend/app/db/seed.py` y `reset.py` → `backend/app/db/reset.py`, y crear `backend/app/db/__init__.py`. Verificar con un listado que no quedan `main.py`, `seed.py` ni `reset.py` en la raíz.
- [x] 1.3 Ajustar solo lo que implica la reubicación: `backend/tests/conftest.py` → `from app.main import app`; el docstring de `backend/app/db/seed.py` → `python -m app.db.seed`; `pytest.ini` → agregar `pythonpath = .`. Del `.gitignore` quitar la línea `docs/`. Verificar con `python -m compileall -q app tests` sin errores y con `grep -rn "from main import\|import main" app tests` vacío.

- [x] 1.4 Corregir el typo `backend/app/core/minxins/` → `backend/app/core/mixins/` (design D2). Mover la carpeta y actualizar los 6 `from app.core.minxins.auditable_mixin import UniqueAuditableMixin` de `categorias`, `ingredientes`, `pedidos`, `productos`, `unidades_medida` y `usuarios` (`models.py`). Verificar con `grep -rn "minxins" app tests` vacío y `python -m compileall -q app` sin errores. El test de import queda en 2.6.

- [x] 1.5 Reubicar el código a `backend/` (design D10): mover `app/`, `tests/`, `pytest.ini`, `requirements.txt` y `docker-compose.yml`; `README.md` de raíz pasa a ser de proyecto y el detalle de backend a `backend/README.md`; actualizar rutas en docs y artefactos. Sin cambios de comportamiento. Verificado desde `backend/`: mismas pruebas sin Postgres verdes y `compileall backend/app` limpio.

## 2. Infraestructura de tests sobre PostgreSQL (PA-10)

- [x] 2.1 RED: crear `backend/tests/unit/test_test_db_guard.py` con los casos de `is_safe_test_database_url(database_url)`, que parsea el nombre de la base del path de `DATABASE_URL` con `make_url(...).database` (design D5): URL a `foodstore_test` → True; URL a `foodstore` / `myapp_db` → False; URL con query string → evalúa solo el nombre de la base; usuario que termina en `_test` con base `foodstore` → False. Ejecutar y verificar que falla porque no existe `backend/tests/support/db_guard.py`.
- [x] 2.2 GREEN + TRIANGULATE: implementar `backend/tests/support/db_guard.py` (función pura, con type hints) y `backend/tests/support/__init__.py`. Ejecutar `pytest backend/tests/unit/test_test_db_guard.py` → verde con al menos 3 casos.
- [x] 2.3 Crear `.env.test.example` (versionado) con todas las variables **obligatorias** del contrato final de `Settings` (design D5) y placeholders evidentemente falsos: `DATABASE_URL=postgresql+psycopg://CHANGE_ME_USER:CHANGE_ME_PASSWORD@localhost:5433/foodstore_test`, `SECRET_KEY` de prueba, `SQL_ECHO=false`, rate limit alto y el resto de las obligatorias. Las opcionales (`MP_*`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`, `CLOUDINARY_*`) van comentadas, con la nota «opcional: la suite corre sin ellas». Lleva un comentario por variable.
  - **Transitorio para el baseline**: la `Settings` actual todavía exige `CLOUDINARY_*`, `VITE_FRONTEND_URL` y `VITE_API_URL`. Agregarlas con dummies **solo al `.env.test` local**, no al `.example`, marcadas `# TEMPORAL C-01: quitar en 4.7`.
  - El `.example` lleva además un bloque rotulado «docker-compose» con `POSTGRES_USER/PASSWORD/DB` y `PGADMIN_EMAIL/PASSWORD`, con la advertencia de mantener `DATABASE_URL` consistente a mano (usuario, contraseña, puerto host 5433; la base de tests es `foodstore_test`).
  - `CORS_ORIGINS` se escribe todavía separado por comas: pasa a JSON en 3.4.
  - Copiarlo a `.env.test` (**no** versionado) con las credenciales locales reales.
  - En `.gitignore`: quitar `!.env.test` y agregar `!.env.test.example`.
  - En `conftest.py`: si falta `.env.test`, `pytest.exit` con el mensaje de D5.

  Verificar:
  - `git check-ignore .env .env.test` los reporta ignorados, o, sin repo git, lo confirma la inspección de los patrones del `.gitignore`
  - `.env.test.example` no está ignorado
  - `pytest --co -q` colecta sin error de configuración
  - al renombrar `.env.test` temporalmente, la sesión aborta con el mensaje esperado
  - **Hecho (D11)**: el usuario creó las plantillas y los `.env` reales: `backend/tests/.env.test.example`, `backend/.env.example`, `.env.example` (raíz, solo compose) y los `.env` reales (ignorados). `.gitignore` (`!.env.test.example`, sin `!.env.test`). `pytest.ini` → `env_files = tests/.env.test`; `conftest.py` aborta con el mensaje de D5 (verificado renombrando temporalmente `backend/tests/.env.test`: `Exit: Falta backend/tests/.env.test: ...`). `test_env_example.py`: 30 verdes contra los archivos reales (incluye que el `.env.example` de la raíz contiene exactamente `POSTGRES_*`/`PGADMIN_*`).
- [x] 2.4 Reescribir `backend/tests/conftest.py` según design D5:
  - guardia temprana con `pytest.exit` si `ENVIRONMENT != test` o la base no es `_test`
  - fixture de sesión que crea `foodstore_test` si falta, más `drop_all` + `create_all`
  - sesión por test con `join_transaction_mode="create_savepoint"` y rollback externo
  - quitar los parches SQLite y `StaticPool`
  - mantener `client`, el seed de catálogos, los helpers de auth por cookie y los fixtures de datos

  Verificar con un test de humo temporal o el primer test incorporado: dos tests consecutivos que insertan el mismo email no colisionan, lo que prueba el rollback.
  - **Hecho**: `backend/tests/conftest.py` reescrito (guardia, `foodstore_test`, savepoint, sin SQLite). Test de humo `backend/tests/integration/test_session_isolation.py` (dos tests insertan el mismo email, sin colisión; caracterización: pasó a la primera) -> 2 verdes contra Postgres real. Nuevos fixtures `direccion_db` y `unidad_medida_db`; `pedido_db` usa `direccion_db`.
- [x] 2.5 SAFETY NET / baseline: correr `pytest` completo sobre Postgres y clasificar cada falla según design D6:
  - (a) fixture o infraestructura: corregir el fixture, p. ej. `pedido_db` con una dirección real
  - (b) deuda de producto: `@pytest.mark.xfail(strict=True, reason="DT-xx → C-yy")`, sin tocar producción

  Registrar la tabla de baseline (test → clasificación → acción) en la sección «Baseline» de abajo. Verificar que el resultado es verde + xfail explícitos y 0 fallas.
  - **Hecho**: primera corrida sobre Postgres: 173 passed / 9 failed, todas de clase (a) (ver Baseline). Tras corregir fixtures/tests: **184 passed, 0 failed, 0 xfail**.
- [x] 2.6 Crear `backend/tests/unit/test_mixins_import.py`. Primero un test de caracterización: importar `UniqueAuditableMixin` desde `app.core.mixins.auditable_mixin` pasa después de 1.4. Después, triangular: `importlib.util.find_spec("app.core.minxins")` es `None`. Ejecutar y verificar en verde.

## 3. Configuración alineada a la spec (DT-22) — `backend-config`

- [x] 3.1 RED: crear `backend/tests/unit/test_config.py` con las fixtures `required_env` (solo las obligatorias, con placeholders falsos) y `full_env` (que agrega las opcionales con dummies), más aislamiento del entorno (design D3: limpiar las claves de `Settings.model_fields` y aplicar la fixture). Instancia `Settings(_env_file=None)` y cubre los escenarios de `specs/backend-config`:
  - **Obligatoria faltante → `ValidationError` que la nombra**, triangulado con al menos 4 obligatorias distintas (`DATABASE_URL`, `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `SQL_ECHO`) vía `pytest.mark.parametrize`
  - **Opcionales**: con `required_env` solo, la carga es exitosa y `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` y las tres `CLOUDINARY_*` valen `None`. Triangular con una opcional definida con valor vacío (`KEY=`), que también vale `None` (`env_ignore_empty=True`).
  - una obligatoria faltante con todas las opcionales presentes sigue fallando
  - entorno vacío → error que enumera solo obligatorias
  - configuración completa (`full_env`) → cada valor efectivo es el provisto
  - `ENVIRONMENT` válido e inválido
  - `CORS_ORIGINS` JSON válido y con comas rechazado
  - variables retiradas presentes o ausentes, sin rellenar opcionales
  - BD:
    - falta `DATABASE_URL` aunque existan `POSTGRES_*` → error que menciona `DATABASE_URL`
    - `DATABASE_URL` se usa exactamente tal cual
    - `Settings.model_fields` no contiene ninguna clave `POSTGRES_*`
    - con `POSTGRES_USER` y `POSTGRES_DB` presentes en el entorno, la URL efectiva no cambia

  Ejecutar y verificar que fallan los casos nuevos: los faltantes de variables que hoy tienen default, la carga sin `CLOUDINARY_*` (hoy obligatorias), `DATABASE_URL` faltante con `POSTGRES_*` presentes, `POSTGRES_*` en `model_fields`, CORS JSON y `MP_NOTIFICATION_URL`.
- [x] 3.2 GREEN: editar `backend/app/core/config.py` según design D3:
  - **obligatorias sin default**: `ENVIRONMENT`, `DATABASE_URL: str`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `LOG_LEVEL`, `RATE_LIMIT_*`, `CORS_ORIGINS: list[str]`
  - **opcionales `Optional[str] = None`**: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_NOTIFICATION_URL` y las tres `CLOUDINARY_*`
  - eliminar el `model_validator` `fix_database_url` y los 5 campos `POSTGRES_*`
  - quitar `MP_WEBHOOK_URL`, `NGROK_URL`, `VITE_FRONTEND_URL` y `VITE_API_URL`
  - `extra="ignore"` y `env_ignore_empty=True`
  - singleton de módulo `settings`, sin `Depends`

  Ejecutar `pytest backend/tests/unit/test_config.py` → verde. Verificar con grep que el único default en `config.py` es `= None`, en campos opcionales, y que no hay `POSTGRES_` ni `model_validator`.
- [x] 3.3 RED → GREEN → TRIANGULATE de `FRONTEND_URL` y `BACKEND_PUBLIC_URL`, **opcionales del grupo pagos** (`Optional[str] = None`; decisión f, aprobada). Escenarios «URLs explícitas del flujo de pago actual» y «Toda variable es explícita»:
  - valores provistos
  - ausentes → `None`
  - `FRONTEND_URL` independiente de `CORS_ORIGINS`
  - `BACKEND_PUBLIC_URL` independiente de `MP_NOTIFICATION_URL`

  Verificar en verde y que `config.py` no tenga propiedades calculadas (los alias `rate_limit_*` sin lógica se conservan).
- [x] 3.4 Adaptar los consumidores:
  - `backend/app/main.py`: `allow_origins=settings.CORS_ORIGINS`
  - `pagos/service.py`: `notification_url=settings.MP_NOTIFICATION_URL`; `back_urls` con `settings.BACKEND_PUBLIC_URL`; se quita la normalización `https://` de `NGROK_URL`
  - `pagos/router.py`: el redirect usa `settings.FRONTEND_URL`, sin `getattr`
  - `.env.test.example` y `.env.test` local: `CORS_ORIGINS` en JSON

  El chequeo «no configurado» se agrega en 4.6. Verificar con `grep -rn "NGROK_URL\|VITE_FRONTEND_URL\|MP_WEBHOOK_URL" app tests` vacío y `pytest` completo sin regresiones contra el baseline de 2.5 (incluye `test_pago.py`).
  - Hecho: `main.py`, `pagos/service.py` y `pagos/router.py` adaptados; `grep NGROK_URL|VITE_FRONTEND_URL|MP_WEBHOOK_URL backend/app backend/tests` vacío. `CORS_ORIGINS` en JSON en `.env.test`/`.env.test.example` (los tests de `Settings` y la suite completa cargan con él) y `pytest` completo en verde (184 passed) sin regresiones vs. baseline.
- [x] 3.5 RED: crear `backend/tests/unit/test_database_engine.py` (escenarios «Logging de SQL configurable»): `build_engine(cfg)` con `SQL_ECHO=false` → `engine.echo is False`. Con `SQL_ECHO=true` → `engine.echo is True`. Usa la fixture `required_env` y no conecta a la BD. Ejecutar y verificar que falla porque no existen `SQL_ECHO` ni `build_engine`.
- [x] 3.6 GREEN: agregar `SQL_ECHO: bool` (obligatoria, sin default) a `Settings` y extraer `build_engine(cfg: Settings) -> Engine` en `backend/app/core/database.py` con `echo=cfg.SQL_ECHO`. El `engine` de módulo queda como `build_engine(settings)`, y se conservan el `ValueError` si falta `DATABASE_URL`, `get_session` y `SessionDep`. Ejecutar `pytest backend/tests/unit/test_database_engine.py` → verde, y `pytest` completo sin regresiones.
  - Hecho: `SQL_ECHO` + `build_engine` + `backend/tests/unit/test_database_engine.py` verdes (3). `pytest` completo: 184 passed, sin regresiones.
- [x] 3.7 REFACTOR: revisar nombres, type hints y docstrings de `config.py` y `database.py`. Re-ejecutar `pytest backend/tests/unit/test_config.py backend/tests/unit/test_database_engine.py` → verde.


## 4. Arranque de la app y `/health` — `backend-runtime`

- [x] 4.1 RED: crear `backend/tests/integration/test_health.py`, con `GET /health` → 200 `{"status":"ok"}` sin credenciales, y N+1 requests por encima de `RATE_LIMIT_DEFAULT_PER_MINUTE` → ninguna 429. Ejecutar y verificar que falla con 404.
- [x] 4.2 GREEN: crear `backend/app/modules/health/router.py` y montarlo sin prefijo en `create_app()` (design D4). Ejecutar `pytest backend/tests/integration/test_health.py` → verde.
- [x] 4.3 RED → GREEN: crear `backend/tests/integration/test_app_startup.py`, que cubre:
  - `create_app()` devuelve una instancia nueva por llamada
  - `/openapi.json` con título `FoodStoreAPI`
  - `GET /api/v1/productos/` con forma paginada
  - `GET /api/v1/no-existe` → 404 `{detail, code}`
  - `POST /api/v1/auth/register` vacío → 422 `VALIDATION_ERROR`
  - preflight CORS con origen permitido y no permitido

  Solo se espera RED donde falte comportamiento. Si un escenario ya pasa con el código base, documentarlo como test de caracterización. Verificar en verde.
  - Hecho: 6 de 7 tests corren y pasan (todos de caracterización: ya pasaban con el código base). Con Postgres: los 7 pasan (incluye `test_listado_de_productos_bajo_api_v1_devuelve_forma_paginada`).
- [x] 4.4 REFACTOR: revisar que `backend/app/main.py` no tenga lógica de negocio y que se respete la dirección de dependencias (reglas duras 1 y 2). Re-ejecutar `pytest backend/tests/integration/test_health.py backend/tests/integration/test_app_startup.py` → verde.
  - Revisado: `backend/app/main.py` sin lógica de negocio, dirección de dependencias respetada. Ambos archivos re-ejecutados con Postgres: verdes.
- [x] 4.5 Cloudinary opcional (design D9; escenarios «Arranque sin integraciones opcionales», «Subida de imágenes sin Cloudinary configurado» y «Borrado de imágenes sin Cloudinary configurado»):
  - **RED**: crear `backend/tests/unit/test_cloudinary_service.py`, con `cloudinary.config` y `cloudinary.uploader` mockeados con `monkeypatch`/`unittest.mock`. **Nunca** llama a la API real.
    - (a) importar `app.core.cloudinary.service` sin `CLOUDINARY_*` no llama a `cloudinary.config` ni lanza
    - (b) `subir_imagen` sin credenciales y con un archivo válido → `HTTPException` 503 cuyo `detail` menciona que el servicio no está configurado, sin llamar a `uploader.upload`
    - (c) `subir_imagen` con un archivo inválido sin credenciales → sigue siendo 400
    - (d) `eliminar_imagen("x")` sin credenciales → `False`, una advertencia en el log y sin llamar a `uploader.destroy`
    - (e) `eliminar_imagen(None)` → `True`
    - (f) con las tres variables definidas, `subir_imagen` llama a `cloudinary.config` una sola vez y a `upload`, y devuelve la URL y el `public_id` del mock

    Ejecutar y verificar que fallan (a), (b) y (d).
  - **GREEN**: aplicar D9 en `backend/app/core/cloudinary/service.py`: quitar el `config` a nivel de módulo y agregar `_asegurar_configuracion()` con un flag. Ejecutar → verde.
  - **TRIANGULATE**: crear `backend/tests/integration/test_optional_integrations.py`, sin `CLOUDINARY_*`:
    - `GET /api/v1/productos/` → 200
    - un ADMIN hace soft delete de un producto con `imagenes_public_id` → 204, el producto queda con `deleted_at`, y el mock de `destroy` no se llama
    - `POST /api/v1/imagen` con un archivo válido → 503 `{code: "HTTP_503"}`

    Ejecutar → verde.
  - **REFACTOR**: revisar la duplicación entre `eliminar_imagen` y `subir_imagen` al chequear la configuración. Re-ejecutar → verde.
  - Hecho: RED (fallaban (a), (b), (d), (f)) → GREEN (D9 en `core/cloudinary/service.py`) → `backend/tests/unit/test_cloudinary_service.py` 9 verdes. `backend/tests/integration/test_optional_integrations.py` escrito; ejecutado con Postgres: los 9 casos del archivo pasan. Nota: la ruta real de subida es `POST /api/v1/uploads/imagen` (no `/api/v1/imagen`).
- [x] 4.6 MercadoPago opcional (escenarios «Pagos sin MercadoPago configurado»; URLs opcionales, decisión f; 503, decisión g):
  - **RED**: en `backend/tests/integration/test_optional_integrations.py`, sin `MP_*`:
    - `POST /api/v1/pagos/crear` para un pedido existente, sin `MP_ACCESS_TOKEN` → **503** `{code: "HTTP_503"}`, con un `detail` que dice que MercadoPago no está configurado y nombra `MP_ACCESS_TOKEN`. Es un **cambio deliberado** respecto del 400 anterior (decisión g): hoy el test falla, porque el backend responde 400, y ese es el RED esperado.
    - triangular con `MP_ACCESS_TOKEN` definido pero sin `MP_NOTIFICATION_URL` → 503, con un `detail` que nombra la faltante
    - `GET /api/v1/pagos/redirect/1/success` sin `FRONTEND_URL` → 503

    El SDK de MercadoPago queda mockeado: nunca se llama a la API real. Ejecutar y verificar que fallan los casos nuevos.
  - **GREEN**: cambiar el código del chequeo existente de `crear_pago` de 400 a 503, nombrando las faltantes, y extenderlo a `MP_NOTIFICATION_URL` y `BACKEND_PUBLIC_URL` antes de contactar a MP, y agregar el 503 del redirect en `pagos/router.py`. Es el cambio mínimo; la lógica de pago no se toca. Ejecutar → verde.
  - **TRIANGULATE**: con todo configurado y `mercadopago.SDK` mockeado, `crear_pago` arma `notification_url` y `back_urls` exactamente con los valores de las variables. Ejecutar → verde.
  - Hecho: tests escritos; RED observado en el caso de redirect (sin DB) y GREEN con 503 en `crear_pago` (nombrando faltantes) y redirect. Verificado con un script desechable (sesión falsa + SDK mockeado) los 503 y el armado de `notification_url`/`back_urls`. Ejecución real con Postgres: los 9 tests de `test_optional_integrations.py` (incluidos los de `crear_pago` con `pedido_db`) pasan.

- [x] 4.7 Quitar del `.env.test` local las variables transitorias de 2.3 (`CLOUDINARY_*`, `VITE_FRONTEND_URL`, `VITE_API_URL`). Verificar que `pytest` completo sigue verde sin ellas, lo que prueba que la suite corre sin integraciones opcionales. Se hace al final del grupo 4 porque las `CLOUDINARY_*` dejan de ser necesarias recién después de 4.5.
  - **Hecho**: verificado (solo nombres de claves, sin leer valores) que `backend/tests/.env.test` no contiene `CLOUDINARY_*`, `VITE_*` ni `MP_*`; la suite completa corre en verde (184 passed) sin integraciones opcionales.

## 5. `.env.example` como contrato

- [x] 5.1 RED: crear `backend/tests/unit/test_env_example.py`, parametrizado sobre `.env.example` y `.env.test.example`. Verifica:
  - `Settings(_env_file=<archivo>)`, con el entorno aislado, carga solo con sus valores
  - toda clave de `Settings.model_fields` aparece en el archivo. En `.env.test.example` las opcionales pueden estar comentadas (`# KEY=`), y se cuentan como presentes.
  - las opcionales están marcadas como «opcional», con un comentario sobre la funcionalidad que habilitan
  - las claves extra pertenecen solo a los bloques rotulados de docker-compose (`POSTGRES_*`, `PGADMIN_*`) o de frontend (`VITE_*`)
  - no aparecen `MP_WEBHOOK_URL`, `NGROK_URL` ni `VITE_FRONTEND_URL`

  Ejecutar y verificar que falla porque `.env.example` no existe.
- [x] 5.2 GREEN: crear `.env.example` con **todas** las variables de `Settings`, con placeholders evidentemente falsos (`CHANGE_ME_*`), un comentario por variable y sin secretos reales.
  - Incluye `CORS_ORIGINS` en JSON, `MP_NOTIFICATION_URL`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL` y `SQL_ECHO=false`.
  - `BACKEND_PUBLIC_URL` y `FRONTEND_URL` se comentan como «removible en C-12».
  - Una cabecera explica la convención: las obligatorias no tienen default y, si falta una, la app no arranca. Las opcionales (bloques «Pagos — MercadoPago (opcional)» y «Imágenes — Cloudinary (opcional)») pueden quedar vacías, y la funcionalidad responde con un error específico al usarse.
  - `DATABASE_URL` con esquema `postgresql+psycopg://`. Se usa tal cual: el backend no la construye.
  - Bloque rotulado «docker-compose — solo lo lee docker-compose, no el backend» con `POSTGRES_USER/PASSWORD/DB` y `PGADMIN_EMAIL/PASSWORD`, más el comentario «mantener `DATABASE_URL` consistente a mano: usuario, contraseña y base, puerto host 5433».
  - Bloque rotulado frontend con `VITE_API_URL` y `VITE_MP_PUBLIC_KEY`.

  Ejecutar `pytest backend/tests/unit/test_env_example.py` → verde para ambos archivos.
  - **Hecho (D11)**: `backend/.env.example` (contrato de `Settings`) y `backend/tests/.env.test.example` creados por el usuario; `test_env_example.py` 30 verdes contra los archivos reales. Las variables de compose (`POSTGRES_*`/`PGADMIN_*`) están en el `.env.example` de la raíz, verificado por un test dedicado (claves exactas, placeholders `CHANGE_ME` en las contraseñas).

## 6. Documentación

- [x] 6.1 `README.md` existente: actualizar los comandos (`docker compose up -d db`, `uvicorn app.main:app`, `python -m app.db.seed`, `pytest`), la nota de que los tests usan `foodstore_test` en Postgres 5433, el copiado de `.env.example` → `.env` y de `.env.test.example` → `.env.test` (las obligatorias no tienen default: si falta una, la app no arranca; MercadoPago y Cloudinary son opcionales y solo hacen falta para pagos e imágenes; una tabla indica qué variables habilita cada integración), un ejemplo coherente de `DATABASE_URL` frente a los `POSTGRES_*` del compose, con la advertencia de que su consistencia es manual, y la migración de variables (CORS JSON; `NGROK_URL` → `BACKEND_PUBLIC_URL` + `MP_NOTIFICATION_URL`; `VITE_FRONTEND_URL` → `FRONTEND_URL`; `SQL_ECHO`). Verificar que los comandos del README coinciden con los paths reales.
- [x] 6.2 Corregir «SQLite en memoria» → «PostgreSQL 15 real, base `foodstore_test` (`.env.test`)» en `CLAUDE.md` y `AGENTS.md`, con el mismo texto en ambos. Verificar que `grep -n "SQLite" CLAUDE.md AGENTS.md` queda vacío.
- [x] 6.3 KB:
  - `knowledge-base/02`: fila de tests.
  - `knowledge-base/08`:
    - fila `TEST_DATABASE_URL` y §Testing
    - tabla de variables con los nombres nuevos (`MP_NOTIFICATION_URL`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `SQL_ECHO`) y las retiradas marcadas
    - fila de `DATABASE_URL`: obligatoria, única variable de BD del backend, sin normalización ni construcción desde `POSTGRES_*`
    - filas de `POSTGRES_*` y `PGADMIN_*` marcadas «solo docker-compose», con consistencia manual con `DATABASE_URL`
    - la convención «toda variable explícita, sin derivaciones, **sin defaults ocultos**: obligatorias = necesarias para funcionar (fail-fast); integraciones opcionales = `None`, con error específico al usarse, singleton `settings`»
    - estructura con `backend/app/main.py`, `backend/app/db/seed.py` y `core/mixins/`
  - `knowledge-base/09`: DD-05 y SU-07 con la estrategia Postgres. Nueva decisión DD-18, «Convención de configuración explícita», que registra tres reglas:
    1. toda variable en `.env` / `.env.example` y en `Settings`, sin derivaciones
    2. **sin valores por defecto ocultos**: una variable es obligatoria (sin default, fail-fast con un error que la nombra) cuando la app la necesita para funcionar. Las de integraciones opcionales (MercadoPago, Cloudinary) se declaran `Optional = None`, que significa «no configurada»; no son necesarias para arrancar ni para correr los tests, y la funcionalidad falla con un error específico solo al usarse. Motivo: accesibilidad para probar el CRUD sin cuentas externas; `DATABASE_URL` es la única variable de BD del backend, y `POSTGRES_*` y `PGADMIN_*` son solo de docker-compose, con consistencia manual
    3. **desviación deliberada de la spec**: DT-22 retira `VITE_FRONTEND_URL` sin prever una variable de backend, por lo que se agregan `FRONTEND_URL` y `BACKEND_PUBLIC_URL`, con la nota «pendiente de reflejar en una futura actualización de la spec»

    Actualizar también la columna «Ejemplo» de la tabla de variables de `08` con placeholders y quitar las menciones a valores por defecto.
  - `knowledge-base/10`: PA-09 y PA-10 marcadas como resueltas, con un resumen de la auditoría de `design.md`.

  Verificar con grep que no quedan menciones a SQLite como estrategia vigente y que DD-18 existe.
- [x] 6.4 `CHANGES.md`:
  - C-06: quitar la salvedad «excepto `ENVIRONMENT=test` si se mantiene SQLite» y anotar que la fixture de tests debe pasar a `alembic upgrade head`.
  - C-08: agregar como insumo los gaps de la auditoría PA-09 (stock por STOCK, toggle vs set de `disponible`, lectura pública de eliminados).
  - C-02: agregar al scope el renombre de los módulos `auth` y `refreshtokens`.
  - C-25: agregar al scope el renombre de `direcciones`, `admin`, `core/uow.py` y el resto de los módulos a la estructura de la spec.
  - C-12: anotar que, al retirar el redirect, se eliminan `FRONTEND_URL` y `BACKEND_PUBLIC_URL`, y que el chequeo «MercadoPago no configurado» (503, formato uniforme) debe conservarse en el flujo nuevo.
  - C-28: anotar que la configuración perezosa y opcional de Cloudinary ya se resolvió en C-01 (D9). Queda pendiente el `HTTPException` en el servicio core (auditoría, punto 7).

  No marcar C-01 como `[x]` (eso es del archive). Verificar con un diff de las secciones C-02, C-06, C-08, C-12, C-25 y C-28.

## 7. Verificación integral

- [x] 7.1 Correr `pytest --cov=app --cov-report=term-missing` completo sobre `foodstore_test`. Verificar 0 fallas (solo verdes + xfail estrictos documentados en Baseline) y anotar la cobertura de referencia.
  - **Hecho**: `pytest --cov=app --cov-report=term-missing` -> **184 passed, 0 failed, 0 xfail; cobertura total de `app`: 75 %** (2880 stmts, 721 sin cubrir).
- [x] 7.2 Revisar SOLID/DRY y las reglas duras sobre los archivos editados en C-01 (`config.py`, `database.py`, `core/cloudinary/service.py`, `core/mixins/` y sus 6 imports, `main.py`, `health/router.py`, `pagos/*` solo por las lecturas de config y el chequeo «no configurado», `conftest.py`, `backend/tests/support/`). Confirmar que no hay secretos en `.env.example` ni en `.env.test.example`, que `.env` y `.env.test` están ignorados, que `Settings` no tiene defaults salvo `None` en las opcionales ni campos `POSTGRES_*`, que ningún test llama a la API real de MP o Cloudinary, y que no se tocó lógica de negocio. Verificar con un checklist en el resumen del apply.
  - **Checklist**: sin secretos en los templates (placeholders `CHANGE_ME`, verificado por test); `.env`/`.env.test` ignorados; `Settings` solo con defaults `None` y sin `POSTGRES_*`; ningún test llama a APIs reales de MP/Cloudinary; sin cambios de lógica de negocio (solo config, `build_engine`, Cloudinary perezoso, chequeo 503 de pagos, `/health`); capas respetadas (`main.py` sin lógica); verificación integral 7.1 en verde. Observaciones fuera de alcance, no corregidas en producción: `IngredienteCreate.unidad_medida_id` tiene `default=1` oculto en el schema (contradice DD-18 en espíritu; candidato a C-08). Corregido en infra: `docker-compose.yml` tenía `PGADMIN_DEFAULT_PASSWORD: ${postgres}` (variable inexistente) -> ahora `${PGADMIN_PASSWORD}`.

## Baseline (se completa en 2.5)

| Test | Clasificación (a/b) | Acción | DT → Change |
|------|---------------------|--------|-------------|
| `test_estadisticas::TestEstadisticasResumen::test_resumen_kpis_excluye_cancelados` | (a) fixture: `direccion_id=1` hardcodeado (FK; en Postgres las secuencias no se revierten con el rollback) | usa el nuevo fixture `direccion_db` | - |
| `test_pedidos::TestCrearPedido::test_crear_pedido_valido` | (a) fixture: `direccion_id=1` hardcodeado | usa `direccion_db.id` | - |
| `test_ingrediente::TestIngredienteCRUD::{crear, get_por_id, actualizar, eliminar}` (4 tests) | (a) fixture: el schema asume `unidad_medida_id=1` y esa fila no existe | nuevo fixture `unidad_medida_db`; los tests envían `unidad_medida_id` explícito | - |
| `test_rate_limit::TestRateLimitDefault::{test_429_when_burst_exhausted, test_429_includes_retry_after}` y `TestRateLimitAuth::test_auth_endpoint_has_stricter_limit` | (a) setup: asumían ráfaga 10/5 pero `.env.test` usa límites altos (1000) por diseño | fixture `strict_limits` fija limiters 10/5 dentro del test | - |
| Resto (173 heredados + 11 nuevos de C-01) | verdes | - | - |

Resultado final: **184 passed, 0 failed, 0 xfailed**. No hubo fallas de clase (b) (deuda de producto), por lo que no se agregó ningún `xfail`. Cobertura de `app`: 75 %.

## Workflow follow-up

- Correr `openspec-verify` sobre el change.
- `/opsx:archive c-01-baseline-backend` y marcar `[x]` en CHANGES.md.
