# Spec Delta

## MODIFIED Requirements

### Requirement: Rutas de negocio montadas bajo `/api/v1`
La aplicación SHALL montar los routers de negocio (auth, usuarios, admin, direcciones, categorías, productos, ingredientes, unidades de medida, imágenes, pedidos, estadísticas, pagos) bajo el prefijo `/api/v1`, con los paths y métodos del contrato vigente que definen las capacidades de cada recurso (`order-api` para pedidos, `product-ingredients`, `api-conventions`). Las rutas retiradas por ese contrato no SHALL seguir respondiendo como antes.

#### Scenario: Ruta pública de catálogo accesible
- **WHEN** un cliente sin autenticación hace `GET /api/v1/productos/`
- **THEN** la respuesta no es 404 y tiene la forma paginada `{items, total, page, size, pages}`

#### Scenario: Ruta inexistente
- **WHEN** un cliente hace `GET /api/v1/no-existe`
- **THEN** recibe 404 con cuerpo JSON en el formato de error de la API (`detail`, `code`)

#### Scenario: Ruta retirada de pedidos
- **WHEN** un `CLIENT` autenticado hace `PATCH /api/v1/pedidos/mis-pedidos/1/cancelar`
- **THEN** no recibe 200 y el cuerpo tiene el formato de error de la API
