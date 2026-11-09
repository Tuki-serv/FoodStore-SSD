# Design — C-06 `datos-migraciones-alembic`

## Context

- Motivación y alcance: ver `proposal.md`. Requisitos: `specs/backend-db-migrations/spec.md` (nueva) y `specs/backend-config/spec.md` (delta de «Entorno de tests aislado»).
- Estado del código observado (después de C-01):
  - `create_all` se llama en tres lugares: el `lifespan` de `backend/app/main.py` (salvo `ENVIRONMENT=test`), `seed()` en `backend/app/db/seed.py` y la fixture `engine_test` de `backend/tests/conftest.py` (`drop_all` + `create_all` una vez por sesión).
  - `backend/app/db/reset.py` (`nuke_database`) hace `DROP TABLE ... CASCADE` sobre una **lista fija** de 18 nombres. La lista incluye nombres que ya no existen (`unidadmedida`) y no incluye `alembic_version`.
  - `alembic` está en `requirements.txt` sin versión. No hay `alembic.ini` ni `backend/alembic/`.
  - El seed importa modelos uno por uno, tres de ellos solo para registrarlos (`# noqa: F401`).
  - `backend/Dockerfile` copia solo `app/` y arranca uvicorn directamente.
  - Los tests corren sobre PostgreSQL 15 real (`foodstore_test`, puerto host 5433), con guardia `_test` (`tests/support/db_guard.py`) y aislamiento por test con transacción externa + savepoint. Baseline: 184 tests verdes, 75 % de cobertura.
- Esquema actual, relevado de los 12 `models.py` (17 tablas). Lo que importa para Alembic:
  - **PK semánticas** de texto: `rol.codigo`, `estado_pedido.codigo`, `forma_pago.codigo` (DD-06). PK compuestas en `usuario_rol`, `producto_categoria` y `producto_ingrediente`.
  - **Índices únicos parciales** de `UniqueAuditableMixin` (`uq_<tabla>_<campo>_activo`, `WHERE deleted_at IS NULL`, DD-04): `usuario.email`, `categorias.nombre`, `ingredientes.nombre`, `productos.nombre`. `Pedido` define su propio `__table_args__` (solo `CHECK`), así que no hereda índices del mixin. `UnidadMedida` usa el mixin sin `_unique_fields`, pero declara `UNIQUE` **total** en `nombre` y `simbolo` (C-06 lo corrige, D12).
  - **Arrays**: `detalle_pedido.personalizacion` `INTEGER[]` (DD-05), `detalle_pedido.personalizacion_snapshot`, `productos.imagenes_url` e `imagenes_public_id` `VARCHAR[]`.
  - **Tipos fijos**: `usuario.password_hash` `CHAR(60)`, `refresh_token.token_hash` `CHAR(64)` único. `pagos.mp_payment_id` y `mp_merchant_order_id` `BIGINT`. `NUMERIC(10,2)` y `NUMERIC(10,3)`.
  - **`CHECK` con nombre** en `pedidos`, `detalle_pedido`, `productos` y `producto_ingrediente`. **FK con `ON DELETE`** (`CASCADE`, `RESTRICT`, `SET NULL`) en `detalle_pedido`, `historial_estado_pedido`, `pedidos`, `producto_categoria` y `producto_ingrediente`.
  - **Sin defaults de servidor**: todos los defaults son de Python (`default`, `default_factory`).
  - **Fechas sin zona**: los campos `datetime` se declaran sin tipo SQL explícito, así que son `TIMESTAMP WITHOUT TIME ZONE`, aunque los valores se generan con `datetime.now(timezone.utc)`. La spec pide `TIMESTAMPTZ` (`knowledge-base/04`). C-06 lo corrige (D11).
  - **Usos de fechas sin zona en el código**: el único es `datetime.utcnow()` en `UsuarioService.refresh_token` (`backend/app/modules/usuarios/service.py`, comparación de `expires_at`). El resto (`core/service.py`, `core/repository.py`, `core/security.py`, `productos/service.py`, `pagos/service.py`, el login de `usuarios/service.py` y los `default_factory` de los modelos) ya usa `datetime.now(timezone.utc)`. Ni el seed, ni `conftest.py`, ni los tests tienen literales de fecha sin zona. Las estadísticas agrupan por día con `func.date(created_at)` y `func.date_trunc(...)` en SQL, y `test_estadisticas.py` compara con `created_at.date()`.
  - Las restricciones sin nombre explícito (FK, `UNIQUE` de columna) toman el nombre que genera PostgreSQL (`<tabla>_<col>_fkey`, `<tabla>_<col>_key`). No hay convención de nombres en `SQLModel.metadata`.
- Restricciones: reglas duras de `CLAUDE.md` (capas, regla 9, regla 10, regla 13: el agente no levanta servidores ni construye imágenes), convención de configuración DD-18 (todo en `.env` + `Settings`, nada derivado, fail-fast), el agente no lee ni escribe archivos `.env*`, Strict TDD en apply y governance ALTO.

## Goals / Non-Goals

**Goals:**
- Que el esquema de cualquier base (desarrollo, contenedor, tests) salga de las mismas migraciones.
- Que una diferencia entre modelos y migraciones rompa un test, no una sesión de desarrollo.
- Dejar un procedimiento corto y probado para la migración siguiente (la de C-02).

**Non-Goals:**
- Corregir divergencias del esquema que cambian comportamiento o pertenecen a un dominio que reescribe otro change (`pagos.external_reference` → C-12, `refresh_token` → C-02, `imagenes_url` → PA-19). Llegan con su propia migración.
- Cambiar la validación de unicidad del service de unidades de medida (cuenta también los eliminados; gap de la auditoría PA-09, asignado a C-08/C-11). C-06 corrige la base, no el service.
- Cambiar la lógica de auth más allá de la comparación de D11 (C-02 la reescribe).
- Cambiar el contenido del seed (C-07) o el esquema de auth (C-02).
- Que la app verifique la versión del esquema al arrancar (ver D1, alternativa descartada).

## Decisions

### D1. Dónde y cuándo se aplican las migraciones

**Objetivo**: un solo mecanismo y un solo momento por contexto, sin que la app toque el esquema.

**Cómo**:
- **Desarrollo local**: a mano, `alembic upgrade head` desde `backend/`, antes de `uvicorn` y antes del seed. Es el paso 6 nuevo del README.
- **Contenedor `backend` de compose**: el `CMD` del `Dockerfile` pasa a `sh -c "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"`. El `&&` impide que uvicorn arranque si la migración falla, y `exec` deja a uvicorn como proceso principal para recibir las señales de parada. La `DATABASE_URL` del contenedor ya la declara el compose (`db:5432`), así que la migración apunta a la misma base que la app.
- **Suite de tests**: la fixture de sesión `engine_test` aplica las migraciones sobre `foodstore_test` (D6).
- **La app no migra ni crea tablas al arrancar**: se elimina el `lifespan` de `backend/app/main.py`, que hoy solo hace `create_all`.

**Qué se agrega**: el `CMD` nuevo en `backend/Dockerfile` y las líneas `COPY alembic.ini .` y `COPY alembic ./alembic`. `docker-compose.yml` no cambia.

- *Alternativa descartada*: migrar dentro del `lifespan`. Mezcla dos responsabilidades en el arranque, se corre una vez por worker (carreras con varios workers) y hace que cualquier test que levante la app toque el esquema.
- *Alternativa descartada*: que la app verifique al arrancar que la base está en `head` y falle si no. Agrega una consulta y un punto de falla al arranque sin necesidad: en el contenedor el `CMD` ya garantiza el orden, y en local el error de la primera consulta a una tabla inexistente es explícito. Se puede sumar más adelante si hace falta.
- La verificación del contenedor es **manual** (regla dura 13: el agente no construye imágenes). La tarea deja los pasos para el usuario.

### D2. Base de desarrollo creada con `create_all`

**Objetivo**: que toda base de desarrollo tenga `alembic_version` y un esquema que salió de las migraciones.

**Cómo**: se **recrea**: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed`. En desarrollo los datos son solo los del seed, así que no se pierde nada que no se pueda regenerar.

**Qué se agrega**: una sección «Migraciones» en `backend/README.md` con ese procedimiento y con la advertencia de que el reset borra todos los datos.

- *Alternativa descartada*: `alembic stamp 001`, que marca la base como migrada sin tocarla. Supone, sin comprobarlo, que el esquema que creó `create_all` es idéntico a la migración 001. Una base vieja puede tener restos (la lista del reset menciona `unidadmedida`) o columnas de una versión anterior de los modelos, y el error aparecería recién en la migración 002. El README la menciona solo como lo que **no** hay que hacer.

### D3. Cómo se produce la migración 001

**Objetivo**: una migración fiel a los modelos, ya corregidos a la spec en D11 y D12 (esas correcciones se hacen **antes** de generar la 001), revisada a mano, cuyo criterio de aceptación es un test y no una lectura.

**Cómo**:
1. **RED**: el test «esquema == modelos» (D7) falla con una migración 001 vacía (`alembic revision -m "esquema inicial" --rev-id 001`), porque la base queda sin tablas.
2. **Borrador con autogenerate**: se corre `alembic revision --autogenerate` contra una base **vacía** auxiliar. Como el agente no puede leer `.env`, el borrador se genera con un script descartable (fuera del repo, en el scratchpad) que reutiliza `settings.DATABASE_URL` cargado por `Settings`, crea una base vacía `foodstore_autogen_test` en el mismo servidor, le pasa la conexión a Alembic por `config.attributes["connection"]` (D4) y la borra al terminar. El contenido del borrador reemplaza el cuerpo de la 001 vacía.
3. **Revisión manual** con esta lista, porque son los puntos que autogenerate suele resolver mal o de forma poco legible en este esquema:
   - **Índices parciales**: cada `op.create_index("uq_..._activo", ..., unique=True, postgresql_where=sa.text("deleted_at IS NULL"))` tiene que estar y llevar el `postgresql_where`. Autogenerate lo copia del `Index`, pero la comparación posterior **no** compara la condición `WHERE`, así que un índice sin ella pasaría el test D7. Por eso hay un test específico (D7).
   - **Arrays**: `postgresql.ARRAY(sa.Integer())` y `postgresql.ARRAY(sa.String())`, sin `AutoString`.
   - **`AutoString` de SQLModel**: autogenerate escribe `sqlmodel.sql.sqltypes.AutoString(length=...)`. Se resuelve una sola vez en `env.py` con un hook `render_item` que lo escribe como `sa.String(length=...)`, así ninguna migración depende de clases internas de SQLModel.
   - **`CHAR(60)`/`CHAR(64)`**: `sa.CHAR(length=60)` y `sa.CHAR(length=64)`; nunca `String`.
   - **`TIMESTAMPTZ`**: las 32 columnas de fecha y hora (D11) son `sa.DateTime(timezone=True)`; ninguna `sa.DateTime()` sin zona.
   - **`unidades_medida`**: sin `sa.UniqueConstraint` en `nombre` ni `simbolo`, y con los índices parciales `uq_unidades_medida_nombre_activo` y `uq_unidades_medida_simbolo_activo` (D12).
   - **D13**: `usuario.id` como `sa.BigInteger()` y las seis FK hacia él también `sa.BigInteger()`; `categorias.parent_id` con `ondelete="SET NULL"`; `sa.CheckConstraint("stock_cantidad >= 0", name="ck_producto_stock_no_negativo")` en `productos`; `direccion_entrega.linea1` como `sa.Text()`; `pagos.external_reference` sin cambios (C-12).
   - **PK semánticas y compuestas**: `sa.PrimaryKeyConstraint("codigo")` en las tres tablas de catálogo y las PK de dos columnas en las tablas intermedias.
   - **Defaults de servidor**: no tiene que aparecer ningún `server_default`. Los modelos no los declaran y agregarlos cambiaría el comportamiento.
   - **`ON DELETE`** de cada FK y **nombres de `CHECK`** iguales a los de los modelos.
   - **Orden**: `upgrade` crea las tablas en orden de dependencias y `downgrade` las borra en el orden inverso.
4. **GREEN**: el test D7 pasa, y también los de reversibilidad, índices parciales y arrays.

**Qué se agrega**: `backend/alembic/versions/001_esquema_inicial.py` con `revision = "001"`, `down_revision = None`.

- **Numeración**: ids cortos y secuenciales (`001`, `002`, ...) con `--rev-id`, y nombre de archivo `NNN_descripcion.py` (`file_template` en `alembic.ini`). Son legibles en revisión y en la tabla `alembic_version`. El número lo toma la primera migración que se integra; por eso C-07 deja de dar por hecho el «002» (tarea en `CHANGES.md`).
- *Alternativa descartada*: escribir la 001 entera a mano. Más lento y más propenso a omisiones; el borrador más la lista de revisión y el test cubren lo mismo con menos riesgo.

### D4. `alembic/env.py` y registro único de modelos

**Objetivo**: una sola fuente para la URL y una sola lista de modelos.

**Cómo**:
- **URL**: `env.py` usa `build_engine(settings)` de `app/core/database.py` (misma URL, mismo `SQL_ECHO`). `alembic.ini` **no** tiene `sqlalchemy.url`. Si falta `DATABASE_URL`, `Settings` falla antes con el error que la nombra (spec «Falta DATABASE_URL»).
- **Conexión inyectada**: si `config.attributes["connection"]` trae una conexión, `env.py` la usa en lugar de crear un engine (receta de Alembic «sharing a connection»). Así los tests migran cualquier base `_test` sin otra variable de entorno ni otra URL.
- **Modo offline** (`alembic upgrade head --sql`): toma la URL de `settings.DATABASE_URL`; queda disponible para generar SQL de revisión.
- **Metadata**: `target_metadata = SQLModel.metadata`, después de llamar a `import_all_models()`.
- **Registro de modelos** (`backend/app/db/models.py`): `import_all_models()` recorre los subpaquetes de `app.modules` con `pkgutil` e importa cada `models` que exista. No hay lista que mantener: un módulo nuevo con `models.py` queda registrado solo. Devuelve `SQLModel.metadata`. Lo usan `env.py`, el seed (reemplaza los imports `# noqa: F401`) y los tests.
- **Logging**: `fileConfig(config.config_file_name, disable_existing_loggers=False)`, para que correr Alembic dentro de pytest no apague los loggers de la app.
- **Comparación**: `compare_type=True` y `compare_server_default=True` en `context.configure`, para que autogenerate y el test D7 detecten también cambios de tipo y de default.
- **`alembic.ini`**: `script_location = %(here)s/alembic` y `prepend_sys_path = .`, para que funcione desde `backend/` y desde el código de tests sin depender del directorio actual.

**Qué se agrega**: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/script.py.mako` (plantilla estándar, sin `import sqlmodel`), `backend/app/db/models.py` y `backend/app/db/migrations.py` con tres funciones tipadas que usan la app y los tests:
  - `build_alembic_config(connection: Connection | None = None) -> Config`: arma la configuración desde `backend/alembic.ini` (ruta absoluta) y, si se pasa, inyecta la conexión.
  - `upgrade_to_head(connection: Connection) -> None` y `current_and_head(connection: Connection) -> tuple[str | None, str]`.
  - `drop_all_tables(connection: Connection) -> None`: refleja las tablas existentes (incluida `alembic_version`) y las borra con `CASCADE` (D8).

`app/db/` es infraestructura de datos: solo depende de `app/core` y de los modelos, la capa más baja, así que no rompe la regla 1.

### D5. Constraints nombrados en las migraciones siguientes

**Objetivo**: que todo `downgrade` futuro pueda borrar lo que su `upgrade` creó.

**Cómo**: sin convención global de nombres en `SQLModel.metadata` por ahora. Toda restricción que agregue una migración **posterior** a la 001 (FK, `UNIQUE`, `CHECK`, índice) lleva nombre explícito en el modelo y en la migración, con este formato: `fk_<tabla>_<columna>_<tabla_ref>`, `uq_<tabla>_<columna>`, `ck_<tabla>_<regla>`, `ix_<tabla>_<columna>`. Autogenerate escribe `op.drop_constraint(None, ...)` cuando la restricción no tiene nombre, y ese `downgrade` falla.

**Qué se agrega**: la regla en la sección «Cómo agregar una migración» del README (D10).

- *Alternativa descartada*: definir `naming_convention` global ahora. Cambiaría el nombre de todas las restricciones existentes, y como la convención se aplica al momento de definir cada tabla, obliga a garantizar que se configure antes del primer import de cualquier modelo. Es un cambio transversal que excede C-06; si se quiere, va en su propio change con su migración de renombre.

### D6. Fixture de sesión de tests con migraciones

**Objetivo**: que la suite use el esquema migrado sin perder el aislamiento por test ni la guardia.

**Cómo**: `engine_test` (scope de sesión) hace, en este orden:
1. la guardia `_test` existente (sin cambios; corre antes de importar `app.*`);
2. `_ensure_database_exists` (sin cambios);
3. dentro de `engine.begin()`: `drop_all_tables(conn)` y después `upgrade_to_head(conn)`. Arrancar de una base vacía en cada sesión prueba la cadena completa de migraciones, también cuando quedó un esquema viejo de una corrida anterior o de `create_all`;
4. si el upgrade lanza una excepción, `pytest.exit("Falló alembic upgrade head sobre foodstore_test: <error>", returncode=2)`.

PostgreSQL ejecuta el DDL dentro de la transacción, así que una migración que falla no deja el esquema a medias. El resto de la fixture (sesión con `join_transaction_mode="create_savepoint"` y rollback externo) no cambia: las migraciones ya se confirmaron antes del primer test.

**Qué se agrega**: el cambio de `engine_test` en `backend/tests/conftest.py`. Se quitan los imports de `SQLModel` que queden sin uso.

### D7. Tests de migraciones

**Objetivo**: probar upgrade, downgrade y «esquema == modelos» sin tocar `foodstore_test` ni las transacciones de los otros tests.

**Cómo**:
- **Base auxiliar** `foodstore_migrations_test`: una fixture de módulo deriva su URL de `settings.DATABASE_URL` cambiando solo el nombre de la base (`make_url(...).set(database=...)`), verifica el nombre con `is_safe_test_database_url` (spec delta de `backend-config`), la crea si falta reutilizando `_ensure_database_exists`, y antes y después de cada test llama a `drop_all_tables`. Al ser otra base, los upgrades y downgrades no interfieren con la sesión de `foodstore_test`. Es infraestructura de tests: no es una variable de configuración nueva ni un valor de la app.
- **Tests** en `backend/tests/integration/test_migrations.py` (marcados `slow`):
  - upgrade sobre base vacía → `current_and_head` devuelve la misma revisión en las dos posiciones (hoy `("001", "001")`);
  - tablas creadas = las 17 esperadas (literal en el test) + `alembic_version`;
  - **esquema == modelos**: `alembic.autogenerate.compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True, "compare_server_default": True}), import_all_models())` devuelve `[]`;
  - triangulación: con una copia de la metadata que agrega una columna, la comparación **no** está vacía (prueba que el test detecta divergencias);
  - **índices parciales**: para los seis `uq_*_activo` (los cuatro de antes más los dos de `unidades_medida`), `pg_indexes.indexdef` contiene `UNIQUE` y `WHERE (deleted_at IS NULL)`; y un caso de comportamiento: dos usuarios con el mismo email, uno con `deleted_at`, se aceptan; dos activos, no;
  - **arrays**: un detalle con `personalizacion=[3, 7]` y `personalizacion_snapshot=["Cebolla", "Tomate"]` se lee igual;
  - downgrade a `base` → no queda ninguna tabla salvo `alembic_version` vacía; ida y vuelta (upgrade, downgrade, upgrade) → comparación vacía;
  - **una sola cabeza**: `ScriptDirectory.from_config(cfg).get_heads()` tiene un solo elemento (no necesita BD).
- **Arranque sin `create_all`** (`backend/tests/integration/test_app_startup.py`): con `settings.ENVIRONMENT` parcheado a `"development"` y `MetaData.create_all` reemplazado por un espía, levantar `TestClient(create_app())` no llama al espía. Con el código actual el test falla (RED), porque fuera de `test` el `lifespan` llama a `create_all`.
- **Seed** (`backend/tests/integration/test_seed_schema_check.py`): contra la base auxiliar vacía, `seed(engine)` lanza el error de «esquema no está al día» que menciona `alembic upgrade head` y no crea tablas; contra la base migrada, el chequeo pasa. Requiere que `seed` reciba el engine como parámetro opcional (D9).
- **Reset**: contra la base auxiliar migrada, `drop_all_tables` deja cero tablas (incluida `alembic_version`) y un `upgrade_to_head` posterior funciona; triangulado con una tabla creada a mano fuera de las migraciones, que también se borra.

**Qué se agrega**: los tres archivos de test y una fixture `migrations_db` en `backend/tests/conftest.py` o en un `conftest.py` local de `integration`.

### D8. Reset

**Objetivo**: que `python -m app.db.reset` deje la base lista para `alembic upgrade head`, sin una lista de tablas que se desactualiza.

**Cómo**: `nuke_database(engine: Engine | None = None) -> None` abre una transacción y llama a `drop_all_tables` (D4), que refleja lo que realmente hay en la base. Así borra `alembic_version`, las tablas que agreguen migraciones futuras y los restos de bases viejas. El parámetro opcional permite probarlo contra la base auxiliar; por defecto usa el `engine` de la app.

**Qué se agrega**: el cambio en `backend/app/db/reset.py`; desaparece la lista fija.

### D9. Seed sin `create_all`

**Objetivo**: que el seed no cree esquema y que falle claro si falta migrar.

**Cómo**: `seed(engine: Engine | None = None) -> None` empieza con `import_all_models()` y con `current_and_head(conn)`. Si la versión actual no es la cabeza (incluye base vacía, sin `alembic_version`), lanza `SchemaNotReadyError` con el mensaje «La base no está en la última versión del esquema (actual: X, esperada: Y). Corré `alembic upgrade head` desde `backend/` y volvé a ejecutar el seed.». Al ejecutarse como módulo (`__main__`), el error se imprime y el proceso sale con código 1, sin traceback. El resto del seed no cambia (su contenido es C-07).

**Qué se agrega**: el cambio en `backend/app/db/seed.py` y la excepción en `backend/app/db/migrations.py`.

- *Alternativa descartada*: chequear solo que existan las tablas. Una base en una versión vieja pasaría el chequeo y el seed fallaría a mitad de camino con un error de SQL.

### D10. Versión de Alembic y procedimiento para la próxima migración

**Objetivo**: builds reproducibles y una receta corta para C-02.

**Cómo**:
- `requirements.txt`: `alembic==<versión>`, la versión exacta instalada en el entorno del apply, con piso 1.13 (la tabla de stack de `CLAUDE.md`). Si el entorno tiene una menor, se actualiza antes de fijarla. Mismo estilo `==` que el resto de las dependencias fijadas.
- **«Cómo agregar una migración»** en `backend/README.md`:
  1. cambiar el modelo (con nombres explícitos de restricciones, D5);
  2. `alembic revision --autogenerate -m "<descripcion>" --rev-id <NNN siguiente>` contra una base de desarrollo en `head`;
  3. revisar el archivo con la lista de D3;
  4. `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head` en desarrollo;
  5. correr `pytest`: «esquema == modelos», ida y vuelta y «una sola cabeza» tienen que pasar.

### D11. Fechas con zona horaria (spec: `TIMESTAMPTZ`)

**Objetivo**: que toda fecha y hora de la base sea un instante UTC con zona, como pide la spec, declarado en un solo lugar.

**Cómo**:
- **Definición compartida** en `backend/app/core/timestamps.py` (infraestructura de `core`, sin dependencias de `modules`):
  - `utc_now() -> datetime`: devuelve `datetime.now(timezone.utc)`. Reemplaza las `lambda` repetidas de los `default_factory` de los modelos.
  - `aware_datetime_field(*, default_now: bool = False, nullable: bool = False) -> Any`: devuelve un `Field(sa_type=DateTime(timezone=True), ...)` con `default_factory=utc_now` si `default_now`, o `default=None` si `nullable`. Se usa `sa_type` (un tipo, que se puede compartir entre tablas) y no `sa_column` (un objeto `Column` solo puede pertenecer a una tabla).
- **Campos que cambian** (17 declaraciones, 32 columnas en 14 tablas):

  | Dónde se declara | Campos | Tablas resultantes |
  |---|---|---|
  | `core/mixins/auditable_mixin.py` (`UniqueAuditableMixin`) | `created_at`, `updated_at`, `deleted_at` | `categorias`, `ingredientes`, `pedidos`, `productos`, `unidades_medida`, `usuario` (18 columnas) |
  | `direcciones_entrega/models.py` (`DireccionEntrega`) | `created_at`, `updated_at`, `deleted_at` | `direccion_entrega` |
  | `pagos/models.py` (`Pago`) | `created_at`, `updated_at` | `pagos` |
  | `detalles_pedido/models.py` (`DetallePedido`) | `created_at` | `detalle_pedido` |
  | `historiales_estado_pedido/models.py` (`HistorialEstadoPedido`) | `created_at` | `historial_estado_pedido` |
  | `productos/models.py` (`ProductoCategoria`, `ProductoIngrediente`) | `created_at` en cada una | `producto_categoria`, `producto_ingrediente` |
  | `usuarios/models.py` (`UsuarioRol`) | `expires_at`, `created_at` | `usuario_rol` |
  | `usuarios/models.py` (`RefreshToken`) | `expires_at`, `revoked_at`, `created_at` | `refresh_token` |

  `rol`, `estado_pedido` y `forma_pago` no tienen fechas.
- **Zona de sesión UTC**: `build_engine` (`backend/app/core/database.py`) agrega `connect_args={"options": "-c timezone=UTC"}`. Con `TIMESTAMPTZ`, PostgreSQL calcula `date()` y `date_trunc()` en la zona de la sesión; fijarla en UTC mantiene el comportamiento actual de las estadísticas (días UTC) y evita que dependa de la configuración del servidor. No es una variable de configuración ni un default oculto: es un invariante del sistema («todas las fechas son UTC»), igual que `timezone.utc` en el código. `env.py` usa `build_engine`, así que las migraciones heredan la misma zona.
- **Código que se rompería con valores con zona**: solo `rt_db.expires_at < datetime.utcnow()` en `UsuarioService.refresh_token`. Se reemplaza por `utc_now()`. Nada más de auth cambia (C-02 reescribe ese servicio).
- **Serialización**: los schemas Pydantic con `created_at: datetime` pasan a emitir la zona (`...Z`). Es un cambio observable, compatible con ISO 8601, y queda en el proposal como **BREAKING** de API.

**Qué se agrega**: `backend/app/core/timestamps.py`; los cambios en el mixin y en los 6 `models.py` de la tabla; `connect_args` en `build_engine`; una línea en `usuarios/service.py`. Tests: tipo de las 32 columnas en la base migrada, valor leído con zona UTC, `SHOW timezone` = `UTC` aun con la base configurada en otra zona, refresh con `expires_at` leído de la base (futuro → 200, pasado → 401), y el test de estadísticas existente sigue verde.

- *Alternativa descartada*: declarar `sa_column=Column(DateTime(timezone=True), ...)` en cada campo. Repite la definición 17 veces y obliga a una `Column` nueva por tabla para los campos del mixin.
- *Alternativa descartada*: dejar la zona de sesión a la configuración del servidor. La imagen `postgres:15` usa UTC por defecto, pero otro servidor (o un cambio en `postgresql.conf`) movería los días de las estadísticas sin aviso.

### D12. `unidades_medida` con unicidad solo entre activos (DD-04)

**Objetivo**: que `unidades_medida` siga la misma regla de unicidad que las otras entidades con baja lógica.

**Cómo**: en `backend/app/modules/unidades_medida/models.py`, `nombre` y `simbolo` pierden `unique=True` en su `Column` y se declaran en `_unique_fields: ClassVar[List[str]] = ["nombre", "simbolo"]`. El mixin genera `uq_unidades_medida_nombre_activo` y `uq_unidades_medida_simbolo_activo` con `WHERE deleted_at IS NULL`, y la migración 001 los crea así. La validación del service (`_validar_unicidad` con `include_deleted=True`) no cambia: por API sigue rechazando un nombre usado por una unidad eliminada, que es el gap de PA-09 asignado a C-08/C-11. La base deja de ser la que bloquea.

**Qué se agrega**: el cambio del modelo. Tests a nivel de base: reutilizar nombre y símbolo de una unidad eliminada se acepta; duplicar entre activas se rechaza.

### D13. Tipos y restricciones del modelo de datos (spec: `knowledge-base/04`)

**Objetivo**: que la 001 no congele ninguna diferencia de esquema con la spec que se pueda corregir sin cambiar comportamiento. Las que cambian comportamiento o pertenecen a un dominio que otro change reescribe se asignan a ese change.

**Cómo**: se revisó cada regla de base de datos de `knowledge-base/04` contra los modelos. Se corrigen en C-06 (solo esquema, antes de generar la 001):
- **`usuario.id` como `BIGINT`** (spec: `BIGSERIAL`). `Usuario.id` se declara con `sa_type=BigInteger` (PostgreSQL lo crea como `BIGSERIAL`), y también las seis claves foráneas que apuntan a él:

  | Tabla | Columna | Modelo |
  |---|---|---|
  | `usuario_rol` | `usuario_id` (parte de la PK) | `UsuarioRol` |
  | `usuario_rol` | `asignado_por_id` | `UsuarioRol` |
  | `refresh_token` | `usuario_id` | `RefreshToken` |
  | `direccion_entrega` | `usuario_id` | `DireccionEntrega` |
  | `pedidos` | `usuario_id` | `Pedido` |
  | `historial_estado_pedido` | `usuario_id` | `HistorialEstadoPedido` |

  En Python siguen siendo `int`, así que no cambia ningún schema ni el `sub` del JWT. Regla para C-02 y siguientes: toda FK nueva hacia `usuario.id` es `BIGINT`. El test de metadata (tarea 5.12) enumera las FK hacia `usuario.id` y exige que todas sean `BigInteger`, así que una FK nueva lo hace fallar hasta que se la agrega a la lista con el tipo correcto.
- **`categorias.parent_id` con `ON DELETE SET NULL`**: `sa_column=Column(Integer, ForeignKey("categorias.id", ondelete="SET NULL"), nullable=True)`, como las otras FK con acción de borrado. Solo actúa en un borrado físico; la app hace baja lógica, y la regla de qué pasa con las hijas en esa baja es de C-11 (DT-19).
- **`productos.stock_cantidad` con `CHECK >= 0`**: se suma `CheckConstraint("stock_cantidad >= 0", name="ck_producto_stock_no_negativo")` al `__table_args__` de `Producto`, junto al de `precio_base`. Hoy el `ge=0` del modelo no se aplica en los modelos de tabla, y el servicio de pedidos ya verifica el stock antes de descontar, así que los flujos actuales no cambian.
- **`direccion_entrega.linea1` como `TEXT`**: `sa_type=Text`.

**Comparación completa con `knowledge-base/04`** (reglas de base de datos; «sí» = el modelo ya la cumple):

| Regla de la spec | ¿En el modelo? | Quién la cubre |
|---|---|---|
| `usuario.id` `BIGSERIAL` | no | C-06 (D13) |
| `usuario.nombre`/`apellido` `VARCHAR(80)`, `email` `VARCHAR(254)`, `celular` `VARCHAR(20)` | sí | — |
| `usuario.email` único entre activos | sí | — |
| `usuario.password_hash` `CHAR(60)` | sí | — |
| `rol.codigo` PK `VARCHAR(20)`, `nombre` único | sí | — |
| `usuario_rol` PK `(usuario_id, rol_codigo)`, `asignado_por_id` FK opcional | sí | — |
| `refresh_token.token_hash` `CHAR(64)` único; `revoked_at` | sí | — (C-02 cambia la tabla) |
| `direccion_entrega.linea1` `TEXT` NN | no (`VARCHAR` NN) | C-06 (D13) |
| `direccion_entrega.alias` `VARCHAR(50)`, `ciudad` `VARCHAR(100)` NN, `codigo_postal` `VARCHAR(10)` | sí | — |
| `categorias.nombre` `VARCHAR(100)` único entre activas | sí | — |
| `categorias.parent_id` `ON DELETE SET NULL` | no | C-06 (D13) |
| `productos.nombre` `VARCHAR(150)` único entre activos | sí | — |
| `productos.precio_base` `NUMERIC(10,2)` `CHECK >= 0` | sí (`ck_producto_precio_no_negativo`) | — |
| `productos.stock_cantidad` `CHECK >= 0` | no (solo `ge=0` de Pydantic) | C-06 (D13) |
| `productos.imagenes_url` una URL | no (array) | PA-19 / C-28 |
| `ingredientes.nombre` único entre activos; `unidad_medida_id` FK NN | sí | — |
| `unidades_medida.nombre`/`simbolo` únicos entre activos | no | C-06 (D12) |
| `producto_categoria` PK compuesta; FK producto `CASCADE`, categoría `RESTRICT` | sí | — |
| `producto_ingrediente.cantidad` `NUMERIC(10,3)` `CHECK > 0` | sí (`ck_producto_ingrediente_cantidad_positiva`) | — |
| `forma_pago.codigo` PK `VARCHAR(20)`, `descripcion` `VARCHAR(80)` | sí | — |
| `estado_pedido.codigo` PK `VARCHAR(20)`, `orden` INT | sí | — |
| `pedidos.direccion_id` `ON DELETE SET NULL` | sí | — |
| `pedidos.subtotal`/`descuento`/`costo_envio`/`total` `NUMERIC(10,2)` `CHECK >= 0` | sí (cuatro `chk_pedido_*`) | — |
| `pedidos.descuento` default 0, `costo_envio` default 50.00 | sí, como default de la aplicación (sin default en la base) | — (ver abajo) |
| `pedidos.notas` `TEXT` | sí | — |
| `detalle_pedido.cantidad` `SMALLINT` `CHECK >= 1` | sí (`chk_detalle_cantidad_positiva`) | — |
| `detalle_pedido.precio_snapshot`/`subtotal_snapshot` `NUMERIC(10,2)` `>= 0` | sí | — |
| `detalle_pedido.pedido_id` `ON DELETE CASCADE`, `producto_id` `ON DELETE RESTRICT` | sí | — |
| `detalle_pedido.nombre_snapshot` `VARCHAR(200)`; `personalizacion` `INTEGER[]`; `personalizacion_snapshot` `VARCHAR[]` | sí | — |
| `historial_estado_pedido.pedido_id` `CASCADE`; `estado_desde` FK NULL; `estado_hacia` FK NN; `usuario_id` FK NULL; `motivo` `TEXT`; `created_at` NN | sí | — |
| `pagos.mp_payment_id` `BIGINT` único NULL; `mp_merchant_order_id` `BIGINT`; `estado` `VARCHAR(20)`; `mp_status` `VARCHAR(30)`; `mp_status_detail` `VARCHAR(100)`; `idempotency_key` `VARCHAR(100)` único NN; `transaction_amount` `NUMERIC(10,2)` | sí | — |
| `pagos.external_reference` UUID único NN | no (nullable, sin unicidad, id numérico) | **C-12** (DT-26) |
| Fechas `TIMESTAMPTZ` | no | C-06 (D11) |
| `total = subtotal − descuento + costo_envio`, snapshots inmutables, historial append-only, una dirección principal por usuario | reglas de la aplicación, no de la base en la spec | C-09/C-11 (pedidos e historial), servicio de direcciones |

**Defaults de la spec** (`descuento` 0, `costo_envio` 50.00, `stock_cantidad` 0, `disponible` true, `es_principal` false, `habilitado` true, `es_alergeno` false): se cumplen como defaults de la aplicación (los modelos los fijan al crear cada fila). No se agregan defaults en la base: duplicarían la fuente de verdad (el `costo_envio` es una constante de `PedidoService`, DD-10) y todas las altas pasan por el ORM. Coherente con el «ningún `server_default`» de D3.

**`pagos.external_reference`** no entra en C-06: pasar a UUID único y obligatorio cambia cómo se crea un pago (hoy se guarda el id del pedido y la preferencia de Checkout Pro lo usa), un dominio CRÍTICO que reescribe C-12. La 001 deja la columna como hoy; se registra como DT-26 con dueño C-12 y se agrega a su scope en `CHANGES.md`.

**Qué se agrega**: los cambios de los modelos listados; tests de metadata (sin BD) y de base para cada corrección, antes de generar la 001; y las verificaciones correspondientes en los tests de la 001.

## Decisiones para revisar

Resumen de lo que conviene que el usuario confirme o cambie antes del apply. Cada punto remite a su decisión.

| # | Tema | Recomendación | Motivo |
|---|------|---------------|--------|
| 1 | Cuándo se migra (D1) | Local: `alembic upgrade head` a mano. Contenedor: el `CMD` corre el upgrade y después uvicorn. Tests: la fixture de sesión. La app nunca migra al arrancar. | Un único momento por contexto; sin carreras entre workers; los tests no dependen del arranque. |
| 2 | Base de desarrollo existente (D2) | Recrear (`reset` → `upgrade head` → `seed`); no usar `alembic stamp`. | Los datos de desarrollo son del seed; `stamp` asume sin probar que el esquema viejo es igual a la 001. |
| 3 | Producción de la 001 (D3) | Autogenerate contra una base vacía auxiliar + revisión manual con lista + test «esquema == modelos» como criterio. `AutoString` se resuelve en `env.py`. | Rápido y verificable; los puntos débiles conocidos (índices parciales, arrays, `CHAR`) tienen chequeo propio. |
| 4 | `env.py` y modelos (D4) | URL de `Settings.DATABASE_URL` vía `build_engine`, conexión inyectable para tests, registro de modelos por descubrimiento en `app/db/models.py`. | Una sola fuente de URL y ninguna lista de modelos que mantener. |
| 5 | Tests de migraciones (D6, D7) | La suite migra `foodstore_test` desde vacío en cada sesión; upgrade/downgrade y comparación en una base aparte `foodstore_migrations_test` con guardia `_test`. | No se mezcla con el aislamiento por savepoint; la guardia sigue cubriendo toda base que toca la suite. |
| 6 | Seed sin esquema (D9) | Chequea que la base esté en `head`; si no, error claro que pide `alembic upgrade head` y sale con código 1. | Falla antes de insertar nada y con la acción a seguir. |
| 7 | Versión de Alembic (D10) | `alembic==<exacta>`, piso 1.13. | Reproducible, alineado con `CLAUDE.md`. |
| 8 | Nombres de restricciones (D5) | Sin convención global ahora; nombres explícitos en toda restricción nueva desde la 002. | Evita renombrar todo el esquema en este change y deja los `downgrade` futuros funcionando. |
| 9 | Reset (D8) | Borra lo que encuentra por reflexión, incluida `alembic_version`. | Sin lista fija que se desactualiza; deja la base lista para migrar. |
| 10 | Fechas (D11) | Las 32 columnas de fecha pasan a `TIMESTAMPTZ` desde una definición compartida (`aware_datetime_field`, `utc_now`); sesión en UTC; se corrige el `utcnow()` del refresh. | Lo pide la spec (`knowledge-base/04`); una sola definición; las estadísticas siguen agrupando por día UTC. Decidido por el usuario: todo sigue la spec. |
| 11 | `unidades_medida` (D12) | Unicidad parcial (`_unique_fields`) en `nombre` y `simbolo`, sin `UNIQUE` total. | DD-04. Decidido por el usuario: todo sigue la spec. |
| 12 | Tipos y restricciones (D13) | `usuario.id` y sus 6 FK como `BIGINT`; `categorias.parent_id` `ON DELETE SET NULL`; `ck_producto_stock_no_negativo`; `direccion_entrega.linea1` `TEXT`. `pagos.external_reference` se asigna a C-12. | Lo pide `knowledge-base/04`; son solo de esquema y más baratos antes de que exista la 001. Decidido por el usuario: todo sigue la spec. |
| 13 | Defaults de la spec (D13) | Se cumplen como defaults de la aplicación; no se agregan `server_default`. | Una sola fuente de verdad (DD-10); todas las altas pasan por el ORM. |

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-09
- Mockups: N/A

## Risks / Trade-offs

- [La comparación de Alembic no mira la condición `WHERE` de los índices parciales] → Test específico sobre `pg_indexes` y test de comportamiento con dos registros (D7).
- [Migrar `foodstore_test` desde vacío en cada sesión suma tiempo a la suite] → Son 17 tablas; se espera poco más de un segundo. Si crece, se puede saltear cuando `current == head`, pero hoy se prefiere probar la cadena completa.
- [La base auxiliar de migraciones queda en el servidor de desarrollo] → Su nombre termina en `_test`, la guardia la valida y los tests la vacían antes y después. No guarda datos.
- [El script descartable de autogenerate crea una base `foodstore_autogen_test`] → Se borra al terminar y vive fuera del repo. Si quedara, no afecta a nada: ninguna configuración apunta a ella.
- [Autogenerate puede omitir o reescribir detalles en migraciones futuras] → La lista de revisión de D3 queda en el README y los tests «esquema == modelos» e ida y vuelta corren en cada `pytest`.
- [Dos changes en paralelo (C-02 y C-07) pueden crear migraciones con el mismo padre] → El test «una sola cabeza» falla en el segundo que se integre; se rebasa cambiando su `down_revision` y su número.
- [Las respuestas JSON cambian el formato de las fechas (agregan `Z`)] → Es ISO 8601 válido y todavía no hay frontend (C-13). Queda como BREAKING en el proposal.
- [Un `datetime` sin zona asignado a mano se guardaría interpretado en la zona de la sesión] → La sesión está fijada en UTC (D11), así que se interpreta como UTC; el código nuevo usa `utc_now()`.
- [Algún test existente compara fechas sin zona] → Relevado: no hay. La suite completa corre después de D11 (tarea de cierre del grupo).
- [C-02 agrega `sesion.usuario_id` y podría declararla `INTEGER`] → «Esquema == modelos» no lo detecta si el modelo y la migración coinciden en `INTEGER`; lo detecta el test de metadata de 5.12, y la regla queda además en el README («Cómo agregar una migración») y en la nota de C-02 en `CHANGES.md`.
- [Dos pedidos concurrentes sobre el último stock] → Antes el stock podía quedar negativo; con `ck_producto_stock_no_negativo` el segundo commit falla con `IntegrityError` (500). No es un flujo nuevo: la concurrencia de stock es de C-10, que la traduce a un error de negocio.
- [`ON DELETE SET NULL` en `parent_id` solo actúa con borrados físicos] → Es lo que pide la spec; la baja lógica y sus reglas siguen en C-11 (DT-19).
- [El `CMD` del contenedor no se prueba en apply (regla 13)] → Verificación manual del usuario, con pasos en la tarea correspondiente.
- [Quien tenga una base de desarrollo vieja y no lea el README verá errores de tablas o columnas] → El seed lo detecta y pide `alembic upgrade head`; el README explica el reset.

## Migration Plan

1. Actualizar dependencias: `pip install -r requirements.txt` (desde `backend/`).
2. Base de desarrollo existente: `python -m app.db.reset`, `alembic upgrade head`, `python -m app.db.seed`. Se pierden los datos actuales (son los del seed).
3. Base nueva: `docker compose up -d db` (raíz), `alembic upgrade head`, `python -m app.db.seed` (desde `backend/`).
4. Contenedor: `docker compose up -d --build backend` (raíz) migra solo antes de servir.
5. Tests: sin pasos nuevos; la suite migra sola y crea `foodstore_migrations_test` si falta.

No hay variables de entorno nuevas ni cambios en `.env*`.

Rollback: `alembic downgrade base` deja la base vacía; revertir el código restaura el `create_all`.

## Open Questions

No quedan preguntas abiertas. La única que había (qué hacer con las dos divergencias del esquema que la 001 iba a congelar) la resolvió el usuario: todo sigue la spec, y se corrigen en C-06 (D11, D12).
