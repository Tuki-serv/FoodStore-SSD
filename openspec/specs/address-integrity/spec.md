# address-integrity Specification

## Purpose
Define las garantías de integridad de las direcciones de entrega que sostiene la base de datos, independientes de la lógica del servicio, como que cada usuario tenga a lo sumo una dirección principal activa (RN-DI-01).

## Requirements

### Requirement: Una sola dirección principal activa por usuario en la base
La base de datos SHALL impedir que un usuario tenga más de una dirección con `es_principal` verdadero y sin baja lógica. Las direcciones dadas de baja no SHALL contar para esta regla. La garantía SHALL sostenerse aunque dos pedidos de marcar principal lleguen a la vez.

#### Scenario: Inserción directa de una segunda principal
- **WHEN** se intenta guardar en la base una segunda dirección activa con `es_principal` verdadero para el mismo usuario
- **THEN** la base rechaza la escritura y la primera sigue siendo la única principal

#### Scenario: Principal dada de baja no bloquea
- **WHEN** un usuario tiene una dirección principal dada de baja y marca otra como principal
- **THEN** la operación se acepta y la nueva queda como única principal activa

#### Scenario: Marcar principal concurrente
- **WHEN** el mismo usuario envía a la vez `PATCH /api/v1/direcciones/{id}/principal` para dos direcciones distintas
- **THEN** al terminar ambas respuestas el usuario tiene exactamente una dirección principal activa, y ninguna respuesta es un 500

#### Scenario: Usuarios distintos
- **WHEN** dos usuarios distintos tienen cada uno su dirección principal activa
- **THEN** ambas coexisten sin conflicto

### Requirement: Migración que preserva los datos existentes
La migración que introduce la garantía SHALL aplicarse con `alembic upgrade head` sobre una base que ya tenga usuarios con más de una principal activa, dejando como principal solo la más reciente de cada usuario, y SHALL poder revertirse con `alembic downgrade` sin perder direcciones.

#### Scenario: Datos previos inconsistentes
- **WHEN** se migra una base donde un usuario tiene dos direcciones principales activas
- **THEN** la migración termina sin error y ese usuario queda con una sola principal, la de `updated_at` más reciente

#### Scenario: Reversión
- **WHEN** se ejecuta `alembic downgrade` de esa migración
- **THEN** la garantía deja de existir y todas las direcciones siguen presentes
