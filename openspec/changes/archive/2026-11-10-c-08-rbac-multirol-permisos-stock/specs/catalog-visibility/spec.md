# Spec Delta

## Purpose

Define qué registros del catálogo ve cada lector en las lecturas públicas (productos, ingredientes, categorías y unidades de medida): el público solo ve lo disponible y no eliminado, y solo los lectores privilegiados ven productos no disponibles o eliminados.

## ADDED Requirements

### Requirement: El público solo ve productos disponibles y no eliminados
`GET /api/v1/productos` y `GET /api/v1/productos/{id}` SHALL seguir siendo públicos. Para un lector no privilegiado (sin access, o con un usuario cuyos roles no incluyen `ADMIN` ni `STOCK`), SHALL devolver solo productos con `disponible = true` y sin `deleted_at`. Los filtros `estado`, `disponible` e `include_deleted` SHALL restringir dentro de esa visibilidad y nunca ampliarla, sin error.

#### Scenario: Listado anónimo
- **WHEN** existen un producto disponible, uno no disponible y uno eliminado, y un pedido sin `Authorization` llama a `GET /api/v1/productos`
- **THEN** recibe 200 y `items` contiene solo el producto disponible, con `total` igual a 1

#### Scenario: Los filtros no amplían la visibilidad
- **WHEN** un pedido sin `Authorization` llama a `GET /api/v1/productos?estado=TODOS` y a `GET /api/v1/productos?disponible=false`
- **THEN** el primero devuelve solo productos disponibles y no eliminados, y el segundo devuelve `items` vacío con `total` 0

#### Scenario: CLIENT y PEDIDOS ven lo mismo que el público
- **WHEN** un usuario con solo el rol `CLIENT`, y otro con solo el rol `PEDIDOS`, llaman a `GET /api/v1/productos?estado=TODOS`
- **THEN** ambos reciben solo productos disponibles y no eliminados

#### Scenario: Detalle de un producto no disponible
- **WHEN** un pedido sin `Authorization` llama a `GET /api/v1/productos/{id}` de un producto con `disponible = false`
- **THEN** recibe 404

#### Scenario: Detalle de un producto eliminado
- **WHEN** un pedido sin `Authorization` llama a `GET /api/v1/productos/{id}?include_deleted=true` de un producto eliminado
- **THEN** recibe 404

### Requirement: ADMIN y STOCK ven productos no disponibles
Un usuario con el rol `ADMIN` o `STOCK`, solo o junto a otros roles, SHALL ver los productos no disponibles en el listado y en el detalle, y SHALL poder filtrarlos con `disponible`. Sin filtros, su listado incluye disponibles y no disponibles, y excluye los eliminados.

#### Scenario: STOCK lista los no disponibles
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/productos?disponible=false`
- **THEN** recibe 200 con el producto no disponible en `items`

#### Scenario: Listado sin filtros de un lector privilegiado
- **WHEN** existen un producto disponible, uno no disponible y uno eliminado, y un usuario con solo el rol `ADMIN` llama a `GET /api/v1/productos`
- **THEN** `items` contiene el disponible y el no disponible, y no el eliminado

#### Scenario: Detalle de un no disponible para un usuario multi-rol
- **WHEN** un usuario con los roles `CLIENT` y `STOCK` llama a `GET /api/v1/productos/{id}` de un producto con `disponible = false`
- **THEN** recibe 200 con ese producto

### Requirement: Solo ADMIN ve registros eliminados del catálogo
Las lecturas de productos, `/api/v1/ingredientes`, `/api/v1/categorias` y `/api/v1/unidades-medida` SHALL seguir siendo públicas. Solo un usuario con el rol `ADMIN` SHALL ver registros eliminados mediante `estado` (`ELIMINADO`, `TODOS`), `include_deleted` o `incluir_eliminado`. Para cualquier otro lector, `STOCK` incluido, esos filtros SHALL restringir a los no eliminados, sin error.

#### Scenario: ADMIN lista productos eliminados
- **WHEN** un usuario con solo el rol `ADMIN` llama a `GET /api/v1/productos?estado=ELIMINADO`
- **THEN** recibe 200 con el producto eliminado en `items`

#### Scenario: STOCK no ve productos eliminados
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/productos?estado=ELIMINADO` y a `GET /api/v1/productos/{id}?include_deleted=true` de un producto eliminado
- **THEN** el listado devuelve `items` vacío y el detalle responde 404

#### Scenario: Listado anónimo de ingredientes con eliminados pedidos
- **WHEN** existen un ingrediente activo y uno eliminado, y un pedido sin `Authorization` llama a `GET /api/v1/ingredientes?estado=ELIMINADO`
- **THEN** recibe 200 con `items` vacío y `total` 0

#### Scenario: STOCK no ve un ingrediente eliminado
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/ingredientes/{id}?incluir_eliminado=true` de un ingrediente eliminado
- **THEN** recibe 404

#### Scenario: ADMIN ve un ingrediente eliminado
- **WHEN** un usuario con solo el rol `ADMIN` llama a `GET /api/v1/ingredientes/{id}?incluir_eliminado=true` de un ingrediente eliminado
- **THEN** recibe 200 con ese ingrediente

#### Scenario: Categorías eliminadas
- **WHEN** existe una categoría eliminada, un pedido sin `Authorization` llama a `GET /api/v1/categorias?estado=TODOS` y un usuario `ADMIN` llama a `GET /api/v1/categorias?estado=ELIMINADO`
- **THEN** el pedido anónimo no recibe la categoría eliminada y el `ADMIN` sí

#### Scenario: Unidades de medida eliminadas
- **WHEN** existe una unidad de medida eliminada, y un usuario con solo el rol `CLIENT` llama a `GET /api/v1/unidades-medida/{id}?incluir_eliminado=true`
- **THEN** recibe 404

### Requirement: Un access inválido en una lectura pública es un error
Si una lectura pública del catálogo trae el header `Authorization` con un access inválido, vencido, sin `sid` o de un usuario dado de baja (`deleted_at`), la respuesta SHALL ser 401 con el mismo cuerpo que un access inválido, en lugar de tratar el pedido como anónimo. Un pedido sin el header SHALL atenderse como anónimo.

#### Scenario: Access inválido
- **WHEN** un pedido llama a `GET /api/v1/productos` con `Authorization: Bearer no-es-un-jwt`
- **THEN** recibe 401

#### Scenario: Usuario dado de baja
- **WHEN** un usuario con `deleted_at` llama a `GET /api/v1/productos` (o a cualquier listado o detalle de ingredientes, categorías o unidades de medida) con su access
- **THEN** recibe 401, con el mismo cuerpo que un access inválido (no el 404 de las rutas protegidas)

#### Scenario: Sin header
- **WHEN** un pedido sin `Authorization` llama a `GET /api/v1/productos`
- **THEN** recibe 200
