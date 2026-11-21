# Spec Delta

## ADDED Requirements

### Requirement: Swagger documenta todos los endpoints de negocio
La documentación OpenAPI servida en `/docs` y `/openapi.json` SHALL describir cada operación bajo `/api/v1` con un `summary` en español, al menos un `tag` del recurso, el esquema de su respuesta exitosa y las respuestas de error de negocio que puede devolver (401, 403, 404, 409 o 422 según corresponda) con el formato de error de la API. Las operaciones que requieren sesión SHALL declarar el esquema de seguridad Bearer.

#### Scenario: Operación sin resumen
- **WHEN** se recorre `/openapi.json` y alguna operación bajo `/api/v1` no tiene `summary` o `tags`
- **THEN** el test de documentación falla nombrando el método y la ruta

#### Scenario: Errores documentados
- **WHEN** se lee en `/openapi.json` la operación `POST /api/v1/pedidos/`
- **THEN** documenta la respuesta 201 con el detalle del pedido y las respuestas 400, 401, 403, 404 y 422 con el formato `{detail, code, field}`

#### Scenario: Seguridad declarada
- **WHEN** se lee la operación `GET /api/v1/pedidos`
- **THEN** declara el esquema de seguridad Bearer, y `GET /api/v1/categorias/arbol` (catálogo público, sin autenticación obligatoria) no lo exige

#### Scenario: Swagger UI disponible
- **WHEN** un cliente hace `GET /docs` sobre la aplicación arrancada
- **THEN** recibe 200 con la interfaz de Swagger UI
