# Spec Delta

## Purpose

Define cómo la API expone y valida la unidad de medida de un ingrediente, para que quien administra el catálogo vea y cambie la unidad en la que se mide cada ingrediente.

## ADDED Requirements

### Requirement: Las lecturas de ingrediente incluyen su unidad
`GET /api/v1/ingredientes/`, `GET /api/v1/ingredientes/{id}` y las respuestas de alta (`POST`) y edición (`PATCH`) de un ingrediente SHALL incluir `unidad_medida_id` con el id de la unidad de medida del ingrediente.

#### Scenario: Listado con unidad
- **WHEN** un pedido sin `Authorization` lista los ingredientes y existe «Harina» medida en gramos
- **THEN** recibe 200 y el elemento «Harina» trae `unidad_medida_id` igual al id de la unidad «g»

#### Scenario: Alta devuelve la unidad elegida
- **WHEN** un `ADMIN` crea «Maní» con el `unidad_medida_id` de «g»
- **THEN** recibe 201 con ese mismo `unidad_medida_id`

### Requirement: Cambiar la unidad de un ingrediente
`PATCH /api/v1/ingredientes/{id}` (solo `ADMIN`) SHALL aceptar `unidad_medida_id` y fijar esa unidad en el ingrediente, sin cambiar los campos que no se envían.

#### Scenario: Cambiar a gramos
- **WHEN** un `ADMIN` envía `{"unidad_medida_id": <id de g>}` para un ingrediente medido en unidades
- **THEN** recibe 200 con ese `unidad_medida_id`, y `nombre` y `es_alergeno` no cambian

#### Scenario: STOCK no cambia la unidad
- **WHEN** un usuario con solo el rol `STOCK` envía `{"unidad_medida_id": <id de g>}`
- **THEN** recibe 403 y la unidad no cambia

### Requirement: La unidad debe existir
Al crear o editar un ingrediente, un `unidad_medida_id` que no corresponde a una unidad de medida existente y no eliminada SHALL responder 404 sin guardar nada (nunca 500).

#### Scenario: Unidad inexistente en el alta
- **WHEN** un `ADMIN` crea un ingrediente con `unidad_medida_id` 999999
- **THEN** recibe 404 y el ingrediente no se crea

#### Scenario: Unidad inexistente en la edición
- **WHEN** un `ADMIN` envía `{"unidad_medida_id": 999999}` para un ingrediente existente
- **THEN** recibe 404 y el ingrediente conserva su unidad
