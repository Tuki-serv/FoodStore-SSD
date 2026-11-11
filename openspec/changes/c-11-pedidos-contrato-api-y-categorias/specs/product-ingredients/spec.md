# Spec Delta

## Purpose

Expone por API los ingredientes asociados a un producto: su lectura pública (para mostrar composición y alérgenos en el catálogo) y la quita de una asociación por parte del administrador.

## ADDED Requirements

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
