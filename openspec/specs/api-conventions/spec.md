# api-conventions Specification

## Purpose

Fija las convenciones transversales del contrato HTTP de la API de Food Store: cómo se paginan los listados de colección y con qué forma y códigos se devuelve cualquier error, para que el frontend los maneje de un solo modo.

## Requirements

### Requirement: Parámetros de paginación
Todo listado de colección SHALL aceptar `page` (entero ≥ 1, por defecto 1) y `size` (entero entre 1 y 100, por defecto 20). Un valor fuera de rango SHALL responder 422 `VALIDATION_ERROR` con `field` igual al nombre del parámetro. Los listados no SHALL aceptar `offset` ni `limit` como paginación.

#### Scenario: Valores por defecto
- **WHEN** un usuario `ADMIN` llama a `GET /api/v1/pedidos` sin `page` ni `size`
- **THEN** recibe 200 con `page` 1 y `size` 20

#### Scenario: Tamaño fuera de rango
- **WHEN** un cliente llama a `GET /api/v1/productos?size=101`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `size`

#### Scenario: Página cero
- **WHEN** un cliente llama a `GET /api/v1/categorias?page=0`
- **THEN** recibe 422 con `field` `page`

### Requirement: Forma de la respuesta paginada
Todo listado de colección SHALL responder 200 con `{items, total, page, size, pages}`: `items` es la página pedida, `total` la cantidad de registros que cumplen los filtros y la visibilidad del lector, y `pages` es `ceil(total / size)` (0 si `total` es 0). Aplica a pedidos (incluido el de cocina), direcciones, categorías, productos, ingredientes, unidades de medida y usuarios de administración.

#### Scenario: Tres páginas
- **WHEN** existen 5 pedidos de un cliente y ese cliente llama a `GET /api/v1/pedidos?page=2&size=2`
- **THEN** recibe `items` con 2 pedidos, `total` 5, `page` 2, `size` 2 y `pages` 3

#### Scenario: Colección vacía
- **WHEN** un cliente sin direcciones llama a `GET /api/v1/direcciones/`
- **THEN** recibe `{"items": [], "total": 0, "page": 1, "size": 20, "pages": 0}`

#### Scenario: Página posterior a la última
- **WHEN** existen 3 categorías activas y un cliente llama a `GET /api/v1/categorias?page=5&size=2`
- **THEN** recibe 200 con `items` vacío, `total` 3 y `pages` 2

### Requirement: Respuestas que no son listados de colección
El árbol de categorías, el historial de un pedido, los ingredientes de un producto y los reportes de estadísticas SHALL conservar su forma sin paginar: no son listados de colección y no aceptan `page` ni `size`.

#### Scenario: Historial sin paginar
- **WHEN** un usuario `ADMIN` llama a `GET /api/v1/pedidos/{id}/historial` de un pedido con tres transiciones
- **THEN** recibe una lista JSON con las cuatro filas, sin claves `items` ni `total`

### Requirement: Formato único de error
Toda respuesta de error de la API (4xx y 5xx), incluidas las rutas inexistentes y los métodos no permitidos, SHALL tener cuerpo JSON `{detail, code, field}`: `detail` es un texto legible, `code` un código estable en mayúsculas y `field` el campo afectado o `null`.

#### Scenario: Recurso inexistente
- **WHEN** un usuario `ADMIN` llama a `GET /api/v1/pedidos/999999`
- **THEN** recibe 404 con `code` `HTTP_404`, un `detail` no vacío y `field` nulo

#### Scenario: Ruta inexistente
- **WHEN** un cliente llama a `GET /api/v1/no-existe`
- **THEN** recibe 404 con las tres claves `detail`, `code` y `field`

### Requirement: Códigos de error por defecto
Un error sin código de negocio SHALL usar `HTTP_<status>` (por ejemplo `HTTP_401`, `HTTP_403`, `HTTP_404`, `HTTP_409`). Un error de validación de entrada SHALL responder 422 con `code` `VALIDATION_ERROR` y `field` igual al último elemento de la ubicación del primer error.

#### Scenario: Sin autenticación
- **WHEN** un cliente sin `Authorization` llama a `GET /api/v1/auth/me`
- **THEN** recibe 401 con `code` `HTTP_401`

#### Scenario: Validación de body
- **WHEN** un usuario `ADMIN` llama a `PATCH /api/v1/pedidos/{id}/estado` con body `{}`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `nuevo_estado`

### Requirement: Códigos de error de negocio
Los errores que el cliente debe distinguir SHALL usar códigos de negocio estables: `INVALID_TRANSITION` (409, transición no permitida o pedido terminal), `INSUFFICIENT_STOCK` (409, confirmación sin stock), `DUPLICATE_VALUE` (409, con `field`), `CATEGORY_HAS_PRODUCTS` (409) y `CATEGORY_HAS_CHILDREN` (409).

#### Scenario: Transición inválida
- **WHEN** un usuario `ADMIN` pide pasar a `ENTREGADO` un pedido en `EN_PREP`
- **THEN** recibe 409 con `code` `INVALID_TRANSITION`

#### Scenario: Confirmación sin stock
- **WHEN** un usuario `PEDIDOS` confirma un pedido `EFECTIVO` de 2 unidades de un producto con stock 1
- **THEN** recibe 409 con `code` `INSUFFICIENT_STOCK` y el pedido sigue en `PENDIENTE`

### Requirement: Límite de peticiones con el formato de error
Superar el límite de peticiones SHALL responder 429 con `{detail, code, field}`, `code` `RATE_LIMIT_EXCEEDED` y `field` nulo, conservando el header `Retry-After` con un entero positivo de segundos. El cuerpo no SHALL tener la clave `error`.

#### Scenario: Ráfaga agotada
- **WHEN** un cliente supera la ráfaga permitida de peticiones a `GET /api/v1/productos/`
- **THEN** recibe 429 con `code` `RATE_LIMIT_EXCEEDED`, header `Retry-After` mayor que 0 y sin clave `error` en el cuerpo

### Requirement: Error interno sin detalles técnicos
Una excepción no controlada SHALL responder 500 con `{detail, code, field}`, `code` `INTERNAL_ERROR`, un `detail` genérico y `field` nulo. El cuerpo no SHALL incluir la traza, el tipo de excepción ni su mensaje; el error SHALL quedar registrado en el log del servidor.

#### Scenario: Falla inesperada
- **WHEN** un endpoint lanza una excepción no prevista con el mensaje «boom»
- **THEN** el cliente recibe 500 con `code` `INTERNAL_ERROR` y el cuerpo no contiene «boom»
