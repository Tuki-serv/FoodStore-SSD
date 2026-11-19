# Spec Delta

## ADDED Requirements

### Requirement: Configurar los ingredientes al crear o editar un producto
`POST /api/v1/productos/` y `PUT /api/v1/productos/{id}` (solo `ADMIN`) SHALL aceptar `ingredientes` como lista de `{ingrediente_id, cantidad, unidad_medida_id, es_removible}` y guardar cada asociación con esos cuatro valores. En `PUT`, la lista enviada SHALL reemplazar las asociaciones anteriores; omitirla SHALL dejarlas como estaban. Todo ocurre en una sola transacción.

#### Scenario: Alta con ingredientes
- **WHEN** un `ADMIN` crea un producto con «Pan Brioche» (`cantidad` 1, unidad «u», `es_removible` false) y «Tomate» (`cantidad` 2, unidad «u», `es_removible` true)
- **THEN** recibe 201 y `ingredientes` trae ambos con esa `cantidad`, `unidad_medida_id` y `es_removible`

#### Scenario: Edición que reemplaza los ingredientes
- **WHEN** un `ADMIN` envía `PUT` con `ingredientes` solo con «Tomate» para un producto que tenía «Pan Brioche» y «Tomate»
- **THEN** recibe 200 y `GET /productos/{id}/ingredientes` devuelve solo «Tomate»

#### Scenario: Edición sin la lista de ingredientes
- **WHEN** un `ADMIN` envía `PUT` con solo `{"precio_base": "2000.00"}`
- **THEN** recibe 200 y los ingredientes del producto no cambian

### Requirement: Validación de la lista de ingredientes y categorías
Al crear o editar un producto, un ingrediente inexistente o eliminado, o una unidad de medida inexistente, SHALL responder 404; un `ingrediente_id` repetido en `ingredientes` o un id repetido en `categoria_ids` SHALL responder 422. En todos los casos no SHALL guardarse ningún cambio (nunca 500).

#### Scenario: Unidad inexistente
- **WHEN** un `ADMIN` crea un producto con un ingrediente cuyo `unidad_medida_id` es 999999
- **THEN** recibe 404 y el producto no se crea

#### Scenario: Ingrediente repetido
- **WHEN** un `ADMIN` crea un producto con «Tomate» dos veces en `ingredientes`
- **THEN** recibe 422 y el producto no se crea

#### Scenario: Categoría repetida
- **WHEN** un `ADMIN` edita un producto con `categoria_ids` `[1, 1]`
- **THEN** recibe 422 y las categorías del producto no cambian

#### Scenario: Cantidad no positiva
- **WHEN** un `ADMIN` crea un producto con un ingrediente de `cantidad` 0
- **THEN** recibe 422 y el producto no se crea
