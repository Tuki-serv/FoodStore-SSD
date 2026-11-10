# Spec Delta

## MODIFIED Requirements

### Requirement: Identificador de usuario de 64 bits
La clave primaria `usuario.id` SHALL ser un entero de 64 bits autoincremental (`BIGSERIAL`), y toda clave foránea que apunte a `usuario.id` SHALL ser del mismo tipo.

#### Scenario: Tipos de la clave y sus referencias
- **WHEN** se aplica `alembic upgrade head` y se inspeccionan `usuario.id`, `usuario_rol.usuario_id`, `usuario_rol.asignado_por_id`, `sesion.usuario_id`, `direccion_entrega.usuario_id`, `pedidos.usuario_id` y `historial_estado_pedido.usuario_id`
- **THEN** todas son `bigint`

#### Scenario: Identificador mayor que 32 bits
- **WHEN** se inserta un usuario con `id` 3000000000 y una dirección de entrega que lo referencia
- **THEN** ambas inserciones se aceptan y la dirección queda asociada a ese usuario

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

## ADDED Requirements

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
