# Spec Delta

## MODIFIED Requirements

### Requirement: El seed exige el esquema al día
El seed SHALL ejecutarse solo si la base está en la última versión del esquema. Si no lo está, SHALL terminar sin insertar datos y con un mensaje que indique correr `alembic upgrade head` desde `backend/`.

#### Scenario: Base sin migrar
- **WHEN** se ejecuta `python -m app.db.seed` contra una base sin tablas
- **THEN** termina con error, no crea tablas ni inserta filas, y el mensaje menciona `alembic upgrade head`

#### Scenario: Base migrada
- **WHEN** se ejecuta `python -m app.db.seed` contra una base en la última versión
- **THEN** siembra los catálogos de roles, estados de pedido y formas de pago definidos en `backend-db-seed`, el admin inicial y los datos de demostración, sin crear ni alterar tablas
