# Proposal — C-06 `datos-migraciones-alembic`

## Why

Hoy el esquema de la base no tiene historia: lo crea `SQLModel.metadata.create_all` en tres lugares (el `lifespan` de `backend/app/main.py`, `seed()` en `backend/app/db/seed.py` y la fixture `engine_test` de `backend/tests/conftest.py`). `create_all` solo crea tablas que faltan: no altera columnas, no borra nada y no deja registro de qué versión del esquema tiene cada base. Por eso la regla dura 9 («ningún cambio de esquema sin migración Alembic») no se puede cumplir, y la rúbrica exige `alembic upgrade head` sin errores (CE-04). Es la deuda DT-09 (parte datos), descrita en DD-15 e IN-18.

Además, el usuario decidió hacer C-06 **antes** que C-02 (`c-02-auth-sesion-tokens-bearer-refresh`, pausado con proposal y design). C-02 cambia el esquema (tabla nueva `sesion` y cambios en `refresh_token`), así que necesita Alembic listo y un procedimiento probado para agregar la migración siguiente.

## What Changes

- **Alembic inicializado en `backend/`**: `backend/alembic.ini` y `backend/alembic/` (`env.py`, plantilla `script.py.mako`, `versions/`). Una **migración** es un script versionado que lleva la base de una versión del esquema a la siguiente (`upgrade`) y la devuelve a la anterior (`downgrade`); Alembic registra en la tabla `alembic_version` cuál es la versión aplicada.
  - `env.py` toma la URL de `Settings.DATABASE_URL` (sin `sqlalchemy.url` en `alembic.ini`, así no hay una segunda fuente de verdad) y compara contra `SQLModel.metadata`.
  - Acepta también una conexión ya abierta que le pase el código (tests), sin leer otra variable.
- **Dos correcciones del esquema a la spec, antes de generar la migración** (decisión del usuario: todo sigue la spec):
  - **Fechas con zona horaria**: las 32 columnas de fecha y hora de las 14 tablas que las tienen (17 declaraciones en el código) pasan a `TIMESTAMPTZ` (`knowledge-base/04`: `deleted_at TIMESTAMPTZ`), declaradas desde una definición compartida, y los valores son siempre UTC con zona. La conexión a la base fija la zona de sesión en UTC, para que las agrupaciones por día de las estadísticas no dependan de la configuración del servidor. La única comparación con una fecha sin zona (`datetime.utcnow()` en el refresh de `usuarios/service.py`) se corrige, porque con columnas con zona lanzaría `TypeError`. **BREAKING** (API): las fechas de las respuestas JSON pasan a llevar la zona (`...Z`).
  - **`unidades_medida` con unicidad solo entre activos** (DD-04): `nombre` y `simbolo` dejan el `UNIQUE` total y pasan a los índices únicos parciales de `UniqueAuditableMixin`, como el resto de las entidades con baja lógica.
  - **Tipos y restricciones del modelo de datos** (`knowledge-base/04`), solo de esquema, sin cambio de comportamiento en los flujos actuales:
    - `usuario.id` pasa a `BIGINT` (`BIGSERIAL`), y también las seis claves foráneas que apuntan a él.
    - `categorias.parent_id` con `ON DELETE SET NULL`.
    - `productos.stock_cantidad` con `CHECK (stock_cantidad >= 0)` en la base (`ck_producto_stock_no_negativo`).
    - `direccion_entrega.linea1` como `TEXT`.
  - El resto de las reglas de base de datos de `knowledge-base/04` se revisaron una por una contra los modelos y ya se cumplen (detalle en `design.md`, D13).
- **Migración `001_esquema_inicial`**: describe el esquema actual, **antes de C-02**, con esas dos correcciones. Incluye las 17 tablas, las PK semánticas (`rol.codigo`, `estado_pedido.codigo`, `forma_pago.codigo`), las columnas de auditoría (`created_at`, `updated_at`, `deleted_at`), todas las fechas como `TIMESTAMPTZ`, los índices únicos parciales de `UniqueAuditableMixin` (`WHERE deleted_at IS NULL`, incluidos los dos nuevos de `unidades_medida`), los arrays `INTEGER[]` y `VARCHAR[]`, los `CHAR(60)`/`CHAR(64)`, los `CHECK` y las FK con su `ON DELETE`. Su `downgrade` deja la base vacía.
- **Registro único de modelos** (`backend/app/db/models.py`): importa todos los `app/modules/*/models.py` en un solo lugar. Lo usan `alembic/env.py`, el seed y los tests; desaparece la lista de imports `# noqa: F401` del seed.
- **Se quita `create_all` del código de la app**:
  - **BREAKING** (operación): el `lifespan` de `backend/app/main.py` deja de crear tablas. La app ya no toca el esquema al arrancar: hay que correr `alembic upgrade head` antes.
  - **BREAKING** (operación): `python -m app.db.seed` deja de crear tablas. Si la base no está en la última versión del esquema, termina con un error claro que indica correr `alembic upgrade head` desde `backend/`.
  - `python -m app.db.reset` borra **todas** las tablas del esquema, incluida `alembic_version`, para que después `alembic upgrade head` reconstruya desde cero.
- **Tests sobre migraciones**:
  - La fixture de sesión arma `foodstore_test` con `alembic upgrade head` en lugar de `drop_all` + `create_all`. El aislamiento por test (transacción externa + savepoint) y la guardia `_test` no cambian.
  - Tests nuevos, en una base aparte `foodstore_migrations_test` (también protegida por la guardia): upgrade desde base vacía, downgrade a base vacía, ida y vuelta, «esquema == modelos» (Alembic no encuentra diferencias entre la base migrada y los modelos), índices parciales presentes y una sola cabeza de migraciones.
- **Contenedor `backend` de compose**: corre `alembic upgrade head` antes de iniciar uvicorn. La imagen incluye `alembic.ini` y `alembic/`.
- **Versión de Alembic fijada** en `requirements.txt` (`==`, 1.13 o superior).
- **Procedimiento para la próxima migración** documentado en `backend/README.md` (crear, revisar, nombrar constraints y probar), pensado para la migración 002 de C-02.
- **Documentación y roadmap**: `CHANGES.md` (C-02 pasa a depender de C-06; árbol y paralelismo; nota sobre la numeración de la migración de C-07), `knowledge-base/04`, `08`, `09` (DT-09, DD-15), `10` (IN-18, PA-15, nota en PA-10) y `13` (fila «sin Alembic»), `backend/README.md`, y `CLAUDE.md`/`AGENTS.md` (sumar `alembic upgrade head` a los comandos de backend).

Fuera de alcance: otras divergencias del esquema frente a la spec que ya tienen change asignado o decisión pendiente: `refresh_token` (C-02), `productos.imagenes_url` como array en vez de una URL (PA-19) y `pagos.external_reference` como UUID único y obligatorio, que cambia cómo se crean los pagos (governance CRÍTICO) y se asigna explícitamente a C-12 (la 001 deja la columna como está hoy); el contenido del seed (C-07), los cambios de esquema de C-02 y la validación de unicidad del service de unidades de medida, que hoy cuenta también los registros eliminados (gap de la auditoría PA-09, asignado a C-08/C-11). Tampoco cambia ninguna otra lógica de auth: C-02 reescribe ese código.

## Capabilities

### New Capabilities
- `backend-db-migrations`: cómo se crea y evoluciona el esquema de la base. Cubre: Alembic como único mecanismo (sin `create_all` en la app ni en el seed), la URL tomada de `DATABASE_URL`, la migración inicial reversible que reproduce los modelos, las fechas con zona horaria en todas las tablas, la unicidad solo entre activos (incluida `unidades_medida`), la coincidencia «esquema migrado == modelos», una sola cabeza de migraciones, el seed que exige el esquema al día, el reset que deja la base vacía, la suite de tests construida con migraciones y el contenedor que migra antes de servir.

### Modified Capabilities
- `backend-config`: el requisito «Entorno de tests aislado» se amplía. La guardia `_test` también protege la base auxiliar de los tests de migraciones, y aborta antes de aplicar migraciones (no solo antes de crear o borrar tablas).

## Impact

- **Código** (todo bajo `backend/`): nuevos `alembic.ini`, `alembic/env.py`, `alembic/script.py.mako`, `alembic/versions/001_esquema_inicial.py`, `app/db/models.py` (registro de modelos) y `app/db/migrations.py` (helpers de Alembic para la app y los tests). Cambian `app/main.py` (sin `create_all` ni `lifespan`), `app/db/seed.py` (sin `create_all`, chequeo de esquema), `app/db/reset.py` (borra todas las tablas, incluida `alembic_version`), `tests/conftest.py` (`alembic upgrade head`), `requirements.txt` (versión fija) y `Dockerfile` (copia Alembic y migra antes de uvicorn). Correcciones del esquema: nuevo `app/core/timestamps.py` (definición compartida de fecha con zona y `utc_now()`), `app/core/mixins/auditable_mixin.py` y los `models.py` de `detalles_pedido`, `direcciones_entrega`, `historiales_estado_pedido`, `pagos`, `productos`, `unidades_medida` y `usuarios`; `app/core/database.py` (zona de sesión UTC en `build_engine`); una línea de `app/modules/usuarios/service.py` (comparación de vencimiento con zona). Correcciones de tipos y restricciones: `usuarios/models.py` (`Usuario.id`, `UsuarioRol.usuario_id`, `UsuarioRol.asignado_por_id`, `RefreshToken.usuario_id`), `direcciones_entrega/models.py` (`usuario_id`, `linea1`), `pedidos/models.py` (`usuario_id`), `historiales_estado_pedido/models.py` (`usuario_id`), `categorias/models.py` (`parent_id`) y `productos/models.py` (`CHECK` de stock). Ninguna otra capa de negocio cambia.
- **Operación**: `alembic upgrade head` (desde `backend/`) pasa a ser obligatorio antes de arrancar la app y antes del seed. Una base de desarrollo creada con `create_all` se recrea: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed` (se pierden los datos, que en desarrollo son solo los del seed).
- **API**: las fechas de las respuestas (`created_at` de pedidos, detalles e historial) se serializan con zona (`2026-11-09T12:00:00Z`). Los valores no cambian: ya se generaban en UTC.
- **Dependencias**: ninguna nueva; `alembic` ya está en `requirements.txt` y solo se le fija la versión.
- **Roadmap**: **C-02 pasa a depender de C-06** (además de C-01). Su migración será la siguiente después de 001, y toda clave foránea nueva hacia `usuario` (por ejemplo `sesion.usuario_id`) tiene que ser `BIGINT`. C-07 deja de dar por sentado el número «002». C-12 recibe explícitamente `pagos.external_reference` (deuda nueva DT-26 en `knowledge-base/09`).
- **Governance**: ALTO. El usuario revisa estos artefactos antes de escribir código.
