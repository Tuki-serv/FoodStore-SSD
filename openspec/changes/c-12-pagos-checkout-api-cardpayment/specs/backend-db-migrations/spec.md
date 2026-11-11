## MODIFIED Requirements

### Requirement: La migración 002 agrega las sesiones
La migración `002`, siguiente a la `001`, SHALL crear la tabla `sesion` (`id` UUID, `usuario_id`, `expires_at`, `revoked_at`, `revoked_reason`, `created_at`, `ip`, `user_agent`) y SHALL ajustar `refresh_token`: agrega `sesion_id` UUID NOT NULL con FK a `sesion.id` y quita `expires_at` y `usuario_id`. Sus restricciones e índices SHALL tener nombre explícito.

#### Scenario: Esquema tras el upgrade
- **WHEN** se aplica `alembic upgrade 002` sobre una base vacía
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

## ADDED Requirements

### Requirement: La migración 003 adapta los pagos a Checkout API
La migración `003`, siguiente a la `002`, SHALL convertir `pagos.external_reference` en un UUID obligatorio con unicidad de nombre explícito `uq_pagos_external_reference`, y SHALL quitar de `pagos` las columnas de Checkout Pro `mp_preference_id` y `mp_init_point`. Pasa a ser la cabeza del historial.

#### Scenario: Esquema tras el upgrade
- **WHEN** se aplica `alembic upgrade head` sobre una base vacía
- **THEN** la versión actual es `003`, `pagos.external_reference` es de tipo `uuid` y no admite nulos, existe la restricción `uq_pagos_external_reference` y `pagos` no tiene `mp_preference_id` ni `mp_init_point`

#### Scenario: Referencia externa duplicada
- **WHEN** se insertan directamente en la base dos pagos con la misma `external_reference`
- **THEN** la base rechaza el segundo por violación de `uq_pagos_external_reference`

#### Scenario: Pagos existentes reciben una referencia
- **WHEN** se aplica la `003` sobre una base en la `002` con un pago de `external_reference` `"42"` y otro con `external_reference` nula
- **THEN** el upgrade termina sin errores y cada pago queda con un UUID propio y distinto en `external_reference`, sin perder sus demás datos

#### Scenario: Downgrade a la 002
- **WHEN** sobre una base en `003` se ejecuta `alembic downgrade 002`
- **THEN** `pagos.external_reference` vuelve a ser texto de hasta 100 caracteres que admite nulos, sin `uq_pagos_external_reference`, y `pagos` vuelve a tener `mp_preference_id` y `mp_init_point` vacíos
