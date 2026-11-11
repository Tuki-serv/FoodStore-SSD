# catalog-integrity Specification

## Purpose

Define las reglas de integridad del catálogo que la API hace cumplir al escribir: qué valores deben ser únicos y entre qué registros, y cuándo se puede dar de baja una categoría sin dejar productos ni subcategorías colgando.

## Requirements

### Requirement: Unicidad entre registros activos
El nombre de una categoría, de un producto y de un ingrediente, y el nombre y el símbolo de una unidad de medida, SHALL ser únicos solo entre registros no eliminados. Un valor usado únicamente por registros eliminados SHALL poder reutilizarse al crear o al editar.

#### Scenario: Reusar el nombre de una categoría eliminada
- **WHEN** existe la categoría «Bebidas» eliminada y un `ADMIN` crea otra categoría «Bebidas»
- **THEN** recibe 201

#### Scenario: Reusar el símbolo de una unidad eliminada
- **WHEN** existe la unidad de símbolo «kg» eliminada y un `ADMIN` edita otra unidad activa para que su símbolo sea «kg»
- **THEN** recibe 200

### Requirement: Valor duplicado responde 409
Crear o editar una categoría, un producto, un ingrediente o una unidad de medida con un valor único ya usado por otro registro activo SHALL responder 409 con `code` `DUPLICATE_VALUE` y `field` igual al campo repetido (`nombre` o `simbolo`), sin cambios en la base.

#### Scenario: Producto con nombre repetido
- **WHEN** existe el producto activo «Pizza» y un `ADMIN` crea otro producto «Pizza»
- **THEN** recibe 409 con `code` `DUPLICATE_VALUE` y `field` `nombre`, y sigue habiendo un solo producto «Pizza»

#### Scenario: Símbolo repetido
- **WHEN** existe la unidad activa de símbolo «g» y un `ADMIN` crea otra unidad con símbolo «g»
- **THEN** recibe 409 con `field` `simbolo`

#### Scenario: Editar sin cambiar el nombre
- **WHEN** un `ADMIN` edita la descripción del ingrediente «Queso» enviando también su mismo nombre
- **THEN** recibe 200

### Requirement: Baja de categoría sin dependencias activas
`DELETE /api/v1/categorias/{id}` (`ADMIN`) SHALL dar de baja lógica la categoría y responder 204 solo si no tiene productos no eliminados asociados ni subcategorías no eliminadas. Las asociaciones con productos ya eliminados no SHALL impedir la baja. Ninguna otra categoría SHALL cambiar de padre por la baja.

#### Scenario: Categoría hoja sin productos
- **WHEN** un `ADMIN` elimina una categoría sin subcategorías ni productos
- **THEN** recibe 204 y la categoría deja de aparecer en `GET /api/v1/categorias`

#### Scenario: Solo productos eliminados
- **WHEN** la única asociación de la categoría es con un producto eliminado y un `ADMIN` la elimina
- **THEN** recibe 204

### Requirement: Categoría con productos no se elimina
Si la categoría tiene al menos un producto no eliminado asociado, `DELETE /api/v1/categorias/{id}` SHALL responder 409 con `code` `CATEGORY_HAS_PRODUCTS` y no SHALL cambiar nada (ni la categoría ni sus asociaciones ni su imagen).

#### Scenario: Categoría con un producto activo
- **WHEN** un `ADMIN` elimina una categoría que tiene asociado un producto activo
- **THEN** recibe 409 con `code` `CATEGORY_HAS_PRODUCTS` y la categoría sigue activa con su producto

### Requirement: Categoría con subcategorías no se elimina
Si la categoría tiene al menos una subcategoría no eliminada, `DELETE /api/v1/categorias/{id}` SHALL responder 409 con `code` `CATEGORY_HAS_CHILDREN`, sin cambios: las subcategorías conservan su `parent_id`. Si tiene productos y subcategorías, SHALL prevalecer `CATEGORY_HAS_PRODUCTS`.

#### Scenario: Categoría con una hija activa
- **WHEN** un `ADMIN` elimina la categoría «Comidas», que tiene la subcategoría activa «Pizzas»
- **THEN** recibe 409 con `code` `CATEGORY_HAS_CHILDREN`, «Comidas» sigue activa y «Pizzas» sigue teniendo de padre a «Comidas»

#### Scenario: Hija eliminada no bloquea
- **WHEN** la única subcategoría de «Comidas» está eliminada y un `ADMIN` elimina «Comidas»
- **THEN** recibe 204 y la subcategoría eliminada conserva su `parent_id`
