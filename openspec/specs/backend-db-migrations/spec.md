# backend-db-migrations Specification

## Purpose
Define cómo se crea y evoluciona el esquema de la base de datos del backend: siempre por migraciones versionadas y reversibles, que reproducen exactamente los modelos y que cualquier entorno (desarrollo, contenedor, tests) aplica de la misma forma.

## Requirements

### Requirement: Las migraciones son el único mecanismo que crea el esquema
El esquema de la base SHALL crearse y modificarse solo aplicando migraciones con `alembic upgrade head`, corrido desde `backend/`. Ni la aplicación al arrancar ni el seed SHALL crear, alterar o borrar tablas.

#### Scenario: Arranque sobre una base vacía
- **WHEN** la aplicación arranca contra una base sin tablas, con cualquier valor de `ENVIRONMENT`
- **THEN** el arranque no crea ninguna tabla

#### Scenario: Upgrade sobre una base vacía
- **WHEN** se ejecuta `alembic upgrade head` contra una base sin tablas
- **THEN** el comando termina sin errores y la base queda en la última versión del esquema

### Requirement: La URL de las migraciones es la de la aplicación
Las migraciones SHALL conectarse a la base indicada por `DATABASE_URL`, la misma variable que usa la aplicación. No SHALL existir una segunda configuración de URL para las migraciones.

#### Scenario: Migración con la configuración del backend
- **WHEN** se ejecuta `alembic upgrade head` desde `backend/` con `DATABASE_URL` apuntando a una base
- **THEN** las migraciones se aplican sobre esa base

#### Scenario: Falta DATABASE_URL
- **WHEN** se ejecuta un comando de Alembic sin `DATABASE_URL` definida
- **THEN** el comando falla con el error de validación de configuración que nombra `DATABASE_URL`

### Requirement: El esquema migrado coincide con los modelos
Después de aplicar todas las migraciones, la comparación entre la base y los modelos de la aplicación SHALL no encontrar diferencias en tablas, columnas, tipos, nulabilidad, claves primarias, claves foráneas, restricciones únicas ni índices.

#### Scenario: Sin diferencias tras upgrade
- **WHEN** se aplica `alembic upgrade head` sobre una base vacía y se compara la base con los modelos
- **THEN** la comparación devuelve una lista vacía de diferencias

#### Scenario: Modelo cambiado sin migración
- **WHEN** un modelo agrega o cambia una columna y no se agrega la migración correspondiente
- **THEN** la comparación informa la diferencia y el test de coincidencia falla

### Requirement: La migración inicial reproduce el esquema actual
La migración inicial SHALL crear las 17 tablas actuales, con las correcciones a la spec de esta capacidad, con sus claves primarias semánticas (`rol.codigo`, `estado_pedido.codigo`, `forma_pago.codigo`), sus arrays de PostgreSQL, sus `CHECK` y sus claves foráneas con la acción `ON DELETE` declarada en los modelos.

#### Scenario: Tablas creadas
- **WHEN** se aplica la migración inicial sobre una base vacía
- **THEN** existen exactamente las tablas `categorias`, `detalle_pedido`, `direccion_entrega`, `estado_pedido`, `forma_pago`, `historial_estado_pedido`, `ingredientes`, `pagos`, `pedidos`, `producto_categoria`, `producto_ingrediente`, `productos`, `refresh_token`, `rol`, `unidades_medida`, `usuario` y `usuario_rol`, más la tabla de control de versión

#### Scenario: Arrays de personalización
- **WHEN** se inserta un detalle de pedido con `personalizacion` `[3, 7]` y `personalizacion_snapshot` `["Cebolla", "Tomate"]`
- **THEN** al leerlo se obtienen las mismas listas, en el mismo orden

### Requirement: Unicidad solo entre registros activos
Para las entidades con baja lógica que declaran campos únicos (`usuario.email`, `categorias.nombre`, `ingredientes.nombre`, `productos.nombre`, `unidades_medida.nombre` y `unidades_medida.simbolo`), la migración SHALL crear índices únicos parciales que solo aplican a filas con `deleted_at` nulo. Ninguno de esos campos SHALL tener además una restricción única total.

#### Scenario: Duplicado de un registro eliminado
- **WHEN** existe un usuario con email `a@x.com` y `deleted_at` definido, y se inserta otro usuario activo con el mismo email
- **THEN** la inserción se acepta

#### Scenario: Duplicado entre activos
- **WHEN** existe un usuario activo con email `a@x.com` y se inserta otro usuario activo con el mismo email
- **THEN** la base rechaza la inserción por violación de unicidad

#### Scenario: Unidad de medida reutilizada tras la baja lógica
- **WHEN** existe una unidad de medida `Gramo` con símbolo `g` y `deleted_at` definido, y se inserta otra unidad activa con el mismo nombre y el mismo símbolo
- **THEN** la inserción se acepta

#### Scenario: Unidad de medida duplicada entre activas
- **WHEN** existe una unidad de medida activa con símbolo `g` y se inserta otra unidad activa con símbolo `g`
- **THEN** la base rechaza la inserción por violación de unicidad

### Requirement: Identificador de usuario de 64 bits
La clave primaria `usuario.id` SHALL ser un entero de 64 bits autoincremental (`BIGSERIAL`), y toda clave foránea que apunte a `usuario.id` SHALL ser del mismo tipo.

#### Scenario: Tipos de la clave y sus referencias
- **WHEN** se aplica `alembic upgrade head` y se inspeccionan `usuario.id`, `usuario_rol.usuario_id`, `usuario_rol.asignado_por_id`, `sesion.usuario_id`, `direccion_entrega.usuario_id`, `pedidos.usuario_id` y `historial_estado_pedido.usuario_id`
- **THEN** todas son `bigint`

#### Scenario: Identificador mayor que 32 bits
- **WHEN** se inserta un usuario con `id` 3000000000 y una dirección de entrega que lo referencia
- **THEN** ambas inserciones se aceptan y la dirección queda asociada a ese usuario

### Requirement: Categoría padre eliminada físicamente
La clave foránea `categorias.parent_id` SHALL declarar `ON DELETE SET NULL`: si una categoría padre se borra físicamente, sus hijas quedan como categorías raíz.

#### Scenario: Borrado físico del padre
- **WHEN** se borra con SQL una categoría que tiene una subcategoría
- **THEN** el borrado se acepta y la subcategoría queda con `parent_id` nulo

### Requirement: Stock no negativo en la base
La tabla `productos` SHALL tener la restricción `ck_producto_stock_no_negativo` (`stock_cantidad >= 0`), como última defensa además de la validación de la aplicación.

#### Scenario: Stock negativo rechazado
- **WHEN** se actualiza un producto con `stock_cantidad = -1` directamente en la base
- **THEN** la base rechaza la operación por violación de `ck_producto_stock_no_negativo`

#### Scenario: Stock cero aceptado
- **WHEN** se actualiza un producto con `stock_cantidad = 0`
- **THEN** la operación se acepta

### Requirement: Línea de dirección sin límite de longitud
La columna `direccion_entrega.linea1` SHALL ser `TEXT`.

#### Scenario: Tipo de la columna
- **WHEN** se aplica `alembic upgrade head` y se inspecciona `direccion_entrega.linea1`
- **THEN** su tipo es `text`

#### Scenario: Dirección larga
- **WHEN** se guarda una dirección con una `linea1` de 1000 caracteres
- **THEN** se acepta y se lee completa

### Requirement: Fechas con zona horaria en todas las tablas
Toda columna de fecha y hora del esquema SHALL guardar la zona horaria (`TIMESTAMPTZ`). Los valores que genera la aplicación SHALL ser instantes UTC con zona, y los que se leen de la base SHALL volver con zona UTC.

#### Scenario: Tipo de las columnas
- **WHEN** se aplica `alembic upgrade head` y se inspeccionan las columnas de fecha y hora de todas las tablas
- **THEN** todas son `timestamp with time zone` y ninguna es `timestamp without time zone`

#### Scenario: Valor leído con zona
- **WHEN** se crea un registro sin indicar `created_at` y se lo vuelve a leer de la base
- **THEN** `created_at` tiene zona horaria con desplazamiento cero respecto de UTC

#### Scenario: Comparación de vencimiento con valores de la base
- **WHEN** un usuario renueva con el refresh activo de una sesión cuyo `expires_at`, leído de la base, está en el futuro
- **THEN** la renovación responde 200 sin error de comparación entre fechas con y sin zona

#### Scenario: Agrupación por día independiente del servidor
- **WHEN** un pedido se crea el 10 de noviembre a las 01:30 UTC (22:30 del día anterior en la hora de Argentina) y se consultan las estadísticas por día
- **THEN** el pedido cuenta en la fecha UTC de su creación, cualquiera sea la zona horaria configurada en el servidor de base de datos

### Requirement: Las migraciones son reversibles
Cada migración SHALL tener un `downgrade` que deshaga su `upgrade`. Bajar todas las migraciones SHALL dejar la base sin tablas del esquema, y volver a subirlas SHALL reconstruirlo sin errores.

#### Scenario: Downgrade completo
- **WHEN** sobre una base en la última versión se ejecuta `alembic downgrade base`
- **THEN** no queda ninguna tabla del esquema y el comando termina sin errores

#### Scenario: Ida y vuelta
- **WHEN** se ejecuta upgrade a la última versión, downgrade a base y otra vez upgrade a la última versión
- **THEN** la base queda en la última versión y la comparación con los modelos no encuentra diferencias

### Requirement: Una sola línea de migraciones
El historial de migraciones SHALL tener una única cabeza. Dos migraciones que parten de la misma versión SHALL detectarse como error antes de integrarse.

#### Scenario: Historial lineal
- **WHEN** se inspecciona el historial de migraciones
- **THEN** hay exactamente una cabeza

#### Scenario: Dos migraciones con el mismo padre
- **WHEN** se agregan dos migraciones que declaran la misma versión anterior
- **THEN** el test de historial lineal falla e informa las cabezas encontradas

### Requirement: El seed exige el esquema al día
El seed SHALL ejecutarse solo si la base está en la última versión del esquema. Si no lo está, SHALL terminar sin insertar datos y con un mensaje que indique correr `alembic upgrade head` desde `backend/`.

#### Scenario: Base sin migrar
- **WHEN** se ejecuta `python -m app.db.seed` contra una base sin tablas
- **THEN** termina con error, no crea tablas ni inserta filas, y el mensaje menciona `alembic upgrade head`

#### Scenario: Base migrada
- **WHEN** se ejecuta `python -m app.db.seed` contra una base en la última versión
- **THEN** inserta los datos de catálogo como hasta ahora

### Requirement: El reset deja la base lista para migrar
El reset de la base de desarrollo SHALL borrar todas las tablas del esquema, incluida la tabla de control de versión de las migraciones, de modo que `alembic upgrade head` vuelva a construir el esquema desde cero.

#### Scenario: Reset seguido de upgrade
- **WHEN** se ejecuta `python -m app.db.reset` sobre una base migrada y después `alembic upgrade head`
- **THEN** el upgrade aplica todas las migraciones desde la primera y termina sin errores

#### Scenario: Reset de una base creada sin migraciones
- **WHEN** se ejecuta `python -m app.db.reset` sobre una base cuyas tablas se crearon sin migraciones
- **THEN** no queda ninguna tabla y la base acepta `alembic upgrade head`

### Requirement: La suite de tests usa el esquema migrado
La suite SHALL construir el esquema de su base de tests aplicando las migraciones, una vez por sesión y partiendo de una base vacía, de modo que los tests corran contra el mismo esquema que producción.

#### Scenario: Sesión de tests
- **WHEN** arranca una sesión de pytest con la configuración de tests válida
- **THEN** la base de tests queda en la última versión del esquema antes del primer test

#### Scenario: Migración rota
- **WHEN** una migración falla al aplicarse
- **THEN** la sesión de pytest aborta en el primer test que necesita la base de datos, con un mensaje que indica que falló `alembic upgrade head` e incluye el error original, y ningún test que use la base se ejecuta

### Requirement: El contenedor del backend migra antes de servir
El servicio `backend` de docker-compose SHALL aplicar `alembic upgrade head` antes de iniciar el servidor HTTP. Si la migración falla, el servidor no SHALL iniciar.

#### Scenario: Arranque del contenedor
- **WHEN** se inicia el servicio `backend` con la base disponible
- **THEN** se aplican las migraciones pendientes y después el servidor atiende en el puerto 8000

#### Scenario: Migración fallida en el contenedor
- **WHEN** la migración falla al iniciar el servicio `backend`
- **THEN** el contenedor termina con error y el servidor no atiende requests

### Requirement: La migración 002 agrega las sesiones
La migración `002`, siguiente a la `001`, SHALL crear la tabla `sesion` (`id` UUID, `usuario_id`, `expires_at`, `revoked_at`, `revoked_reason`, `created_at`, `ip`, `user_agent`) y SHALL ajustar `refresh_token`: agrega `sesion_id` UUID NOT NULL con FK a `sesion.id` y quita `expires_at` y `usuario_id`. Sus restricciones e índices SHALL tener nombre explícito.

#### Scenario: Esquema tras el upgrade
- **WHEN** se aplica `alembic upgrade head` sobre una base vacía
- **THEN** la versión actual es `002`, existen las 17 tablas de la `001` más `sesion`, `refresh_token` tiene `sesion_id` de tipo `uuid` y no tiene `expires_at` ni `usuario_id`

#### Scenario: Motivo de cierre acotado
- **WHEN** se actualiza una sesión con `revoked_reason` `OTRO` y `revoked_at` definido directamente en la base
- **THEN** la base rechaza la operación por violación de `ck_sesion_revoked_reason`

#### Scenario: Cierre consistente
- **WHEN** se actualiza una sesión con `revoked_at` definido y `revoked_reason` nulo directamente en la base
- **THEN** la base rechaza la operación por violación de `ck_sesion_revocacion_consistente`

#### Scenario: Refresh activo único por sesión
- **WHEN** se inserta en la base un segundo refresh sin `revoked_at` para una sesión que ya tiene uno activo
- **THEN** la base rechaza la inserción por violación de `uq_refresh_token_sesion_activo`, y un refresh adicional con `revoked_at` definido se acepta

#### Scenario: Refresh tokens previos descartados
- **WHEN** se aplica la `002` sobre una base en la `001` que tiene filas en `refresh_token`
- **THEN** el upgrade termina sin errores y `refresh_token` queda vacía

#### Scenario: Downgrade a la 001
- **WHEN** sobre una base en `002` se ejecuta `alembic downgrade 001`
- **THEN** no existe `sesion` y `refresh_token` vuelve a tener `usuario_id` y `expires_at` y no tiene `sesion_id`