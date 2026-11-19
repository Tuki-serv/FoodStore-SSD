# product-ingredients Specification

## Purpose

Expone por API los ingredientes asociados a un producto: su lectura pública (para mostrar composición y alérgenos en el catálogo) y la quita de una asociación por parte del administrador.

## Requirements

### Requirement: Listar los ingredientes de un producto
`GET /api/v1/productos/{id}/ingredientes` SHALL ser público y responder 200 con una lista (sin paginar) de `{id, nombre, es_alergeno, es_removible, cantidad, unidad_medida_id}` de los ingredientes no eliminados asociados al producto, ordenada por nombre. Un producto sin ingredientes SHALL responder una lista vacía.

#### Scenario: Producto con dos ingredientes
- **WHEN** un pedido sin `Authorization` lista los ingredientes de un producto disponible que tiene asociados «Queso» (alérgeno) y «Tomate»
- **THEN** recibe 200 con dos elementos ordenados por nombre y `es_alergeno` verdadero en «Queso»

#### Scenario: Ingrediente eliminado
- **WHEN** uno de los dos ingredientes asociados está eliminado
- **THEN** la lista trae solo el otro

### Requirement: Los ingredientes siguen la visibilidad del producto
La lectura de ingredientes de un producto SHALL aplicar la misma visibilidad que `GET /api/v1/productos/{id}` (`catalog-visibility`): si el lector no puede ver el producto (inexistente, eliminado o no disponible para un lector no privilegiado), SHALL responder 404.

#### Scenario: Producto no disponible para el público
- **WHEN** un pedido sin `Authorization` lista los ingredientes de un producto con `disponible = false`
- **THEN** recibe 404

#### Scenario: STOCK ve un no disponible
- **WHEN** un usuario con solo el rol `STOCK` lista los ingredientes de un producto con `disponible = false`
- **THEN** recibe 200

### Requirement: Quitar un ingrediente de un producto
`DELETE /api/v1/productos/{id}/ingredientes/{ing_id}` SHALL estar disponible solo para `ADMIN` y SHALL borrar la asociación entre el producto y el ingrediente, respondiendo 204. El producto y el ingrediente no SHALL cambiar. Si el producto no existe o está eliminado, o la asociación no existe, SHALL responder 404.

#### Scenario: Quitar una asociación existente
- **WHEN** un `ADMIN` quita «Tomate» de un producto que lo tiene asociado
- **THEN** recibe 204, la lista de ingredientes del producto ya no lo incluye y el ingrediente «Tomate» sigue existiendo

#### Scenario: Asociación inexistente
- **WHEN** un `ADMIN` quita un ingrediente que el producto no tiene asociado
- **THEN** recibe 404

#### Scenario: STOCK no quita ingredientes
- **WHEN** un usuario con solo el rol `STOCK` llama a `DELETE /api/v1/productos/{id}/ingredientes/{ing_id}`
- **THEN** recibe 403 y la asociación sigue

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
