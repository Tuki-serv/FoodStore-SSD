# Spec Delta — backend-db-migrations

## Purpose

Agrega la migración `005`, que normaliza los emails de usuario existentes y garantiza en la base que solo se guarden emails normalizados (DU-4 de C-14).

## ADDED Requirements

### Requirement: La migración 005 normaliza los emails de usuario
La migración `005`, siguiente a la `004`, SHALL pasar a minúsculas y sin espacios al borde el `email` de todos los usuarios (activos y dados de baja) y SHALL agregar la restricción `ck_usuario_email_normalizado` (`email = lower(btrim(email))`), conservando `uq_usuario_email_activo`. Pasa a ser la cabeza del historial.

#### Scenario: Esquema tras el upgrade
- **WHEN** se aplica `alembic upgrade head` sobre una base vacía
- **THEN** la versión actual es `005`, existe `ck_usuario_email_normalizado` y existe `uq_usuario_email_activo`

#### Scenario: Email sin normalizar insertado directamente
- **WHEN** se inserta directamente en la base un usuario con email `Ana@x.com`
- **THEN** la base lo rechaza por violación de `ck_usuario_email_normalizado`

#### Scenario: Emails existentes normalizados
- **WHEN** se aplica la `005` sobre una base en la `004` con un usuario activo `Ana@X.com` y uno dado de baja ` Beto@x.com`
- **THEN** el upgrade termina sin errores y los usuarios quedan con `ana@x.com` y `beto@x.com`, con sus demás datos sin cambios

### Requirement: La migración 005 no resuelve colisiones de email por su cuenta
Si dos usuarios activos quedarían con el mismo email normalizado, el `upgrade` a `005` SHALL fallar sin modificar ningún dato e informar los emails e ids en conflicto. Las coincidencias con usuarios dados de baja no SHALL impedirlo.

#### Scenario: Colisión entre usuarios activos
- **WHEN** se aplica la `005` sobre una base en la `004` con dos usuarios activos `Juan@x.com` y `juan@x.com`
- **THEN** el upgrade falla con un error que menciona `juan@x.com` y los dos ids, la versión sigue en `004` y ambos emails quedan como estaban

#### Scenario: Colisión con un usuario dado de baja
- **WHEN** se aplica la `005` sobre una base en la `004` con un usuario activo `juan@x.com` y uno dado de baja `Juan@x.com`
- **THEN** el upgrade termina sin errores y ambos quedan con `juan@x.com`

### Requirement: El downgrade de la 005 conserva los emails normalizados
El `downgrade` a `004` SHALL quitar `ck_usuario_email_normalizado` sin restaurar los emails originales (no se guardan).

#### Scenario: Downgrade a la 004
- **WHEN** sobre una base en `005` se ejecuta `alembic downgrade 004`
- **THEN** no existe `ck_usuario_email_normalizado`, existe `uq_usuario_email_activo` y los emails siguen en minúsculas
