# catalog-search Specification

## Purpose

Define los filtros de búsqueda del listado público de productos (`GET /api/v1/productos`) que necesita el catálogo (US-007): rango de precio, solo con stock y resultados sin duplicados al filtrar por varias categorías o ingredientes.

## Requirements

### Requirement: Filtro por rango de precio
`GET /api/v1/productos` SHALL aceptar `precio_min` y `precio_max` opcionales (decimales >= 0) y devolver solo productos con `precio_base` dentro del rango, con ambos extremos incluidos. Cada uno SHALL poder usarse solo.

#### Scenario: Rango con ambos extremos
- **WHEN** existen productos de `"700.00"`, `"1500.00"` y `"1900.00"` y se pide `?precio_min=700&precio_max=1500`
- **THEN** `items` contiene los de 700 y 1500 y `total` es 2

#### Scenario: Solo mínimo
- **WHEN** se pide `?precio_min=1600`
- **THEN** `items` contiene solo el de 1900

### Requirement: Rango de precio inválido
Si `precio_min` es mayor que `precio_max`, o alguno es negativo, la respuesta SHALL ser 422 con el formato único de error y `code` `VALIDATION_ERROR`.

#### Scenario: Mínimo mayor que máximo
- **WHEN** se pide `?precio_min=2000&precio_max=1000`
- **THEN** la respuesta es 422 con `code` `VALIDATION_ERROR` y `field` `precio_max`

#### Scenario: Precio negativo
- **WHEN** se pide `?precio_min=-1`
- **THEN** la respuesta es 422 con `code` `VALIDATION_ERROR` y `field` `precio_min`

### Requirement: Filtro solo con stock
`GET /api/v1/productos` SHALL aceptar `con_stock` opcional; con `true` SHALL devolver solo productos con `stock_cantidad` > 0. Con `false` u omitido no SHALL filtrar por stock.

#### Scenario: Excluir agotados
- **WHEN** existe un producto disponible con stock 0 y otro con stock 5, y se pide `?con_stock=true`
- **THEN** `items` contiene solo el de stock 5 y `total` es 1

### Requirement: Resultados sin duplicados
Al filtrar por varias categorías (`categoria_ids`) o varios ingredientes (`ingrediente_ids`), cada producto SHALL aparecer una sola vez en `items` y contarse una sola vez en `total`, aunque coincida con más de un id.

#### Scenario: Producto en dos categorías pedidas
- **WHEN** «Burger Vegana» pertenece a «Hamburguesas» y «Veganas», «Hamburguesa Clásica» solo a «Hamburguesas», y se pide `?categoria_ids=<Hamburguesas>&categoria_ids=<Veganas>`
- **THEN** `items` contiene ambos productos una vez cada uno y `total` es 2

#### Scenario: Producto con dos ingredientes pedidos
- **WHEN** un producto tiene «Lechuga» y «Tomate» y se pide `?ingrediente_ids=<Lechuga>&ingrediente_ids=<Tomate>`
- **THEN** el producto aparece una sola vez y `total` es 1

### Requirement: Los filtros nuevos respetan la visibilidad
`precio_min`, `precio_max` y `con_stock` SHALL intersectar con lo que el lector puede ver y nunca ampliarlo, combinados entre sí y con los filtros existentes.

#### Scenario: Anónimo con filtros de precio y stock
- **WHEN** un producto no disponible con precio 1000 y stock 10 existe y un pedido sin `Authorization` pide `?precio_min=500&con_stock=true`
- **THEN** ese producto no aparece en `items`
