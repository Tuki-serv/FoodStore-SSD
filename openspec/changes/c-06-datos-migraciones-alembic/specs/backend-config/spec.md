# Spec Delta

## MODIFIED Requirements

### Requirement: Entorno de tests aislado
Con `ENVIRONMENT=test`, `DATABASE_URL` SHALL apuntar a una base PostgreSQL dedicada a tests. El nombre de la base, tomado del path de la URL, SHALL terminar en `_test`. Toda base auxiliar que use la suite (por ejemplo, la de los tests de migraciones) SHALL cumplir la misma condición. La suite SHALL negarse a ejecutarse si la URL efectiva no cumple esa condición o si falta la configuración de tests, para proteger los datos de desarrollo.

#### Scenario: Base de tests válida
- **WHEN** la suite arranca con `ENVIRONMENT=test` y una URL a `foodstore_test`
- **THEN** los tests se ejecutan contra esa base

#### Scenario: Base de desarrollo rechazada
- **WHEN** la suite arranca con `ENVIRONMENT=test` y una URL a una base cuyo nombre no termina en `_test`
- **THEN** la sesión de pytest aborta antes de aplicar migraciones, crear o borrar tablas, con un mensaje que explica el motivo

#### Scenario: Base auxiliar de migraciones protegida
- **WHEN** los tests de migraciones preparan su base auxiliar
- **THEN** su nombre termina en `_test` y, si no fuera así, el test aborta antes de conectarse a ella

#### Scenario: Falta el archivo de configuración de tests
- **WHEN** la suite arranca sin `backend/tests/.env.test`
- **THEN** la sesión de pytest aborta con un mensaje que indica copiarlo desde `backend/tests/.env.test.example`
