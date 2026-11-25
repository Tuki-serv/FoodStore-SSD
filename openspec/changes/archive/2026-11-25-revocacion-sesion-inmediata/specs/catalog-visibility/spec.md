# Spec Delta — catalog-visibility

## MODIFIED Requirements

### Requirement: Un access inválido en una lectura pública es un error
Si una lectura pública del catálogo trae el header `Authorization` con un access inválido, vencido, sin `sid`, de una sesión cerrada, vencida o inexistente, o de un usuario dado de baja (`deleted_at`), la respuesta SHALL ser 401 con el mismo cuerpo que un access inválido, en lugar de tratar el pedido como anónimo. Un pedido sin el header SHALL atenderse como anónimo.

#### Scenario: Access inválido
- **WHEN** un pedido llama a `GET /api/v1/productos` con `Authorization: Bearer no-es-un-jwt`
- **THEN** recibe 401

#### Scenario: Usuario dado de baja
- **WHEN** un usuario con `deleted_at` llama a `GET /api/v1/productos` (o a cualquier listado o detalle de ingredientes, categorías o unidades de medida) con su access
- **THEN** recibe 401, con el mismo cuerpo que un access inválido (no el 404 de las rutas protegidas)

#### Scenario: Sin header
- **WHEN** un pedido sin `Authorization` llama a `GET /api/v1/productos`
- **THEN** recibe 200

#### Scenario: Access de una sesión cerrada
- **WHEN** un `ADMIN` hace logout-all y después llama a `GET /api/v1/productos?estado=ELIMINADO` con el access de una de las sesiones cerradas
- **THEN** recibe 401 con el mismo cuerpo que un access inválido, sin listar productos eliminados
