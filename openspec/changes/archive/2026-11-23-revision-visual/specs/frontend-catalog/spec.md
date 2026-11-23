# Spec Delta — frontend-catalog

## MODIFIED Requirements

### Requirement: Listado del catálogo
La página «Catálogo» (`/catalogo`, pública) SHALL mostrar los productos del servidor en su orden, en páginas de 12, como tarjetas con imagen, nombre, categoría principal, precio y estado de stock. Cada tarjeta SHALL enlazar al detalle del producto. La categoría principal SHALL mostrarse como texto (no como badge) y SHALL omitirse cuando el listado ya está filtrado por esa misma categoría. Si el producto tiene ingredientes alérgenos, la tarjeta SHALL mostrar el ícono de alérgeno del sprite con el nombre accesible «Contiene alérgenos».

#### Scenario: Visitante anónimo con productos
- **WHEN** un visitante sin sesión abre `/catalogo` y el servidor devuelve «Hamburguesa Clásica» (`precio_base` `"1500.00"`, categoría principal «Hamburguesas») y «Limonada Natural»
- **THEN** ve dos tarjetas en ese orden; la primera muestra «Hamburguesa Clásica», «Hamburguesas» y «$ 1.500», y su nombre enlaza a `/catalogo/<id>`

#### Scenario: Solo productos visibles al público
- **WHEN** un usuario `ADMIN` con sesión abre `/catalogo`
- **THEN** el pedido de productos incluye `disponible=true` y `page=1&size=12`, y ve lo mismo que un visitante

#### Scenario: Categoría omitida al filtrar por ella
- **WHEN** el visitante abre `/catalogo?categoria=<id de Hamburguesas>` y «Hamburguesa Clásica» tiene «Hamburguesas» como categoría principal
- **THEN** su tarjeta no repite el texto «Hamburguesas»

#### Scenario: Producto con alérgenos
- **WHEN** «Hamburguesa Clásica» tiene «Pan Brioche» marcado `es_alergeno`
- **THEN** su tarjeta muestra el ícono de alérgeno con nombre accesible «Contiene alérgenos», y una tarjeta sin alérgenos no lo muestra

### Requirement: Estado de stock visible
Un producto con `stock_cantidad` 0 SHALL mostrarse «Agotado» y no SHALL poder agregarse al carrito. Con 1 a 5 unidades SHALL mostrar «Quedan N». Con más de 5 no SHALL mostrar aviso de stock. Ambas marcas SHALL usar un único estilo de marca de stock (mismo componente y forma), distinguiéndose solo por el texto y el tono del estado.

#### Scenario: Producto agotado
- **WHEN** el servidor devuelve un producto disponible con `stock_cantidad` 0
- **THEN** su tarjeta muestra la marca «Agotado», la imagen atenuada y el botón de agregar deshabilitado con el texto «Agotado»

#### Scenario: Pocas unidades
- **WHEN** un producto tiene `stock_cantidad` 2
- **THEN** su tarjeta muestra «Quedan 2»

#### Scenario: Mismo estilo de marca
- **WHEN** se renderizan un producto con `stock_cantidad` 0 y otro con 2
- **THEN** ambas marcas usan el mismo estilo de marca de stock y no los estilos de badge de estado de pedido

### Requirement: Imagen del producto con respaldo
La tarjeta y el detalle SHALL mostrar la primera URL de `imagenes_url` con texto alternativo igual al nombre del producto. Sin imágenes, o si la imagen no carga, SHALL mostrar un respaldo tipográfico sin imagen rota: la inicial del nombre del producto en la fuente de display sobre el color de marca único del design system (el mismo para todos los productos), con el nombre accesible «Sin imagen de <nombre>».

#### Scenario: Producto sin imágenes
- **WHEN** un producto «Limonada Natural» tiene `imagenes_url` `null`
- **THEN** su tarjeta muestra el respaldo con la inicial «L», el nombre accesible «Sin imagen de Limonada Natural» y ninguna imagen

#### Scenario: Imagen que no carga
- **WHEN** la imagen de un producto dispara un error de carga
- **THEN** se reemplaza por el respaldo tipográfico

#### Scenario: Respaldo de color único
- **WHEN** se renderizan sin imagen dos productos de categorías distintas
- **THEN** ambos respaldos usan el mismo color de fondo de marca y difieren solo en la inicial
