# frontend-catalog Specification

## Purpose
Define cómo cualquier visitante, con o sin sesión, explora el catálogo público en el frontend (US-007, US-008, RN-PR-03, RN-PR-04): listado filtrable y paginado, navegación por el árbol de categorías, detalle de producto con ingredientes, alérgenos y stock, y agregado al carrito (con sesión; sin sesión lleva a «Ingresar» y vuelve al mismo lugar).

## Requirements

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

### Requirement: Formato de precio
Los precios SHALL mostrarse en pesos con separador de miles «.», sin decimales cuando son `,00` y con dos decimales con «,» en otro caso, a partir del string decimal del servidor y sin redondeos.

#### Scenario: Precio entero
- **WHEN** el servidor envía `precio_base` `"12000.00"`
- **THEN** se muestra «$ 12.000»

#### Scenario: Precio con centavos
- **WHEN** el servidor envía `precio_base` `"1250.50"`
- **THEN** se muestra «$ 1.250,50»

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

### Requirement: Árbol de categorías
El catálogo SHALL usar el árbol de categorías del servidor (`GET /categorias/arbol`), con «Todas» primero y las subcategorías bajo su padre. Elegir una categoría SHALL filtrar por ella y todas sus descendientes; la elegida SHALL marcarse como actual. El catálogo NO SHALL mostrar una columna lateral de filtros en ningún ancho: en escritorio las categorías se eligen con chips en la barra superior y en menos de 1024 px con los chips de primer nivel y el árbol completo de la hoja «Filtros».

#### Scenario: Elegir una categoría padre
- **WHEN** el árbol tiene «Hamburguesas» (id 1) con «Veganas» (4) y «Sin TACC» (5), y el visitante elige «Hamburguesas»
- **THEN** el pedido de productos incluye `categoria_ids` 1, 4 y 5, «Hamburguesas» queda marcada como actual y la URL contiene `categoria=1`

#### Scenario: Volver a todas
- **WHEN** hay una categoría elegida y el visitante elige «Todas»
- **THEN** el pedido de productos no incluye `categoria_ids` y la URL ya no contiene `categoria`

#### Scenario: Árbol que no carga
- **WHEN** el árbol responde 503
- **THEN** el listado de productos se sigue mostrando y en lugar de las categorías se ve «No pudimos cargar las categorías» con «Reintentar»

#### Scenario: Sin columna lateral
- **WHEN** un visitante abre `/catalogo` a 1440 px de ancho
- **THEN** no hay una región complementaria «Filtros» y la grilla ocupa todo el ancho del contenido

### Requirement: Navegación por categorías en mobile
En pantallas de menos de 1024 px las categorías de primer nivel SHALL ofrecerse como chips desplazables sobre el listado, y el árbol completo con el resto de los filtros SHALL abrirse desde «Filtros» en una hoja inferior que se cierra con «Ver resultados», Escape o el botón de cerrar.

#### Scenario: Chips de primer nivel
- **WHEN** un visitante abre `/catalogo` a 390 px de ancho
- **THEN** ve los chips «Todas», «Bebidas», «Hamburguesas» y «Postres», y no ve el árbol lateral

#### Scenario: Hoja de filtros
- **WHEN** a 390 px el visitante pulsa «Filtros», elige «Veganas» y pulsa «Ver resultados»
- **THEN** la hoja se cierra, el foco vuelve a «Filtros» y el listado queda filtrado por «Veganas»

### Requirement: Búsqueda por nombre
El catálogo SHALL ofrecer «Buscar productos». El texto, sin espacios sobrantes, SHALL enviarse como `q` 300 ms después de la última tecla; vacío SHALL quitar el filtro.

#### Scenario: Búsqueda con espera
- **WHEN** el visitante escribe «burger» de corrido
- **THEN** se hace un solo pedido con `q=burger`, 300 ms después de la última letra, y la URL contiene `q=burger`

#### Scenario: Borrar la búsqueda
- **WHEN** hay una búsqueda «burger» y el visitante vacía el campo
- **THEN** el pedido siguiente no incluye `q`

### Requirement: Filtro por rango de precio
El catálogo SHALL ofrecer «Precio mínimo» y «Precio máximo» en pesos enteros no negativos, aplicados con «Aplicar» como `precio_min`/`precio_max`. Si el mínimo supera al máximo o un valor no es un entero no negativo, SHALL mostrarse el error junto al campo y no SHALL aplicarse.

#### Scenario: Rango válido
- **WHEN** el visitante ingresa mínimo 1000 y máximo 2000 y pulsa «Aplicar»
- **THEN** el pedido incluye `precio_min=1000&precio_max=2000` y la URL contiene `min=1000&max=2000`

#### Scenario: Mínimo mayor que máximo
- **WHEN** el visitante ingresa mínimo 3000 y máximo 1000 y pulsa «Aplicar»
- **THEN** ve «El mínimo no puede superar al máximo» y no se hace ningún pedido nuevo

### Requirement: Filtro de disponibilidad
El catálogo SHALL ofrecer «Solo con stock»; activado SHALL pedir `con_stock=true` y ocultar los agotados.

#### Scenario: Solo con stock
- **WHEN** el visitante activa «Solo con stock»
- **THEN** el pedido incluye `con_stock=true` y la URL contiene `stock=1`

### Requirement: Filtros en la dirección de la página
Los filtros y la página SHALL reflejarse en la URL (`categoria`, `q`, `min`, `max`, `stock`, `page`) y abrir esa URL SHALL restaurarlos. Cambiar un filtro SHALL volver a la página 1. Valores inválidos en la URL SHALL ignorarse.

#### Scenario: Enlace con filtros
- **WHEN** un visitante abre `/catalogo?categoria=2&q=lim&page=2`
- **THEN** el pedido incluye `categoria_ids` de «Bebidas» y sus descendientes, `q=lim` y `page=2`, y el campo de búsqueda muestra «lim»

#### Scenario: Cambiar filtro reinicia la página
- **WHEN** el visitante está en la página 3 y activa «Solo con stock»
- **THEN** el pedido siguiente usa `page=1`

#### Scenario: Valores inválidos
- **WHEN** un visitante abre `/catalogo?page=-4&min=abc`
- **THEN** el pedido usa `page=1` y no incluye `precio_min`

### Requirement: Filtros activos visibles
Cada filtro aplicado SHALL mostrarse como un chip con botón para quitarlo («Quitar filtro Veganas»), y con dos o más SHALL ofrecerse «Limpiar filtros». El total de resultados SHALL anunciarse en una región de estado («6 productos»).

#### Scenario: Quitar un filtro
- **WHEN** están aplicados «Veganas» y «Solo con stock» y el visitante pulsa «Quitar filtro Veganas»
- **THEN** queda solo «Solo con stock» y el pedido siguiente no incluye `categoria_ids`

#### Scenario: Limpiar todo
- **WHEN** hay tres filtros aplicados y el visitante pulsa «Limpiar filtros»
- **THEN** la URL queda `/catalogo` y no se ven chips

### Requirement: Paginación del catálogo
El catálogo SHALL mostrar «Anterior», «Siguiente» y «Página N de M» solo cuando hay más de una página. Al cambiar de página el contenido anterior SHALL seguir visible hasta que llegue el nuevo y la vista SHALL volver al inicio del listado.

#### Scenario: Segunda página
- **WHEN** el servidor responde `total` 20 y `pages` 2, y el visitante pulsa «Siguiente»
- **THEN** se pide `page=2&size=12`, la URL contiene `page=2` y se ve «Página 2 de 2»

#### Scenario: Una sola página
- **WHEN** el servidor responde `pages` 1
- **THEN** no hay controles de paginación

### Requirement: Carga, vacío y error del catálogo
Mientras el listado carga por primera vez SHALL verse un esqueleto de tarjetas con `aria-busy`. Sin productos y sin filtros SHALL verse «Todavía no hay productos». Sin resultados con filtros SHALL verse «No encontramos productos» con los filtros aplicados y «Limpiar filtros». Si la consulta falla SHALL verse un error con «Reintentar».

#### Scenario: Sin resultados con filtros
- **WHEN** con `q=sushi` el servidor responde `total` 0
- **THEN** se ve «No encontramos productos», el texto menciona «sushi» y el botón «Limpiar filtros» vuelve a `/catalogo`

#### Scenario: Catálogo vacío
- **WHEN** sin filtros el servidor responde `total` 0
- **THEN** se ve «Todavía no hay productos» y no se ofrece «Limpiar filtros»

#### Scenario: Falla y reintento
- **WHEN** el listado responde 503 y el visitante pulsa «Reintentar» y la respuesta siguiente es 200
- **THEN** se ven los productos y ya no el error

### Requirement: Detalle de producto
La ruta pública `/catalogo/:productoId` SHALL mostrar imagen, nombre, categorías (la principal primero), precio, descripción, estado de stock e ingredientes. Los ingredientes con `es_alergeno` SHALL marcarse «Alérgeno» y resumirse en «Contiene alérgenos: …»; sin ingredientes SHALL omitirse esa sección.

#### Scenario: Detalle con alérgenos
- **WHEN** un visitante abre el detalle de «Hamburguesa Clásica» con «Pan Brioche» y «Mayonesa» alérgenos y «Lechuga» no
- **THEN** ve los tres ingredientes, «Pan Brioche» y «Mayonesa» con la marca «Alérgeno», y el resumen «Contiene alérgenos: Pan Brioche, Mayonesa»

#### Scenario: Producto sin ingredientes
- **WHEN** el producto «Coca-Cola 500ml» no tiene ingredientes
- **THEN** no se ve la sección de ingredientes ni el resumen de alérgenos

#### Scenario: Volver al catálogo con los filtros
- **WHEN** el visitante llegó al detalle desde `/catalogo?categoria=2&page=2` y pulsa «Volver al catálogo»
- **THEN** vuelve a `/catalogo?categoria=2&page=2`

### Requirement: Producto inexistente o no disponible
Si el detalle responde 404, o el id de la URL no es un entero positivo, SHALL verse «Este producto no está disponible» con un enlace «Ver el catálogo», sin pedir nada al servidor en el segundo caso. Otros errores SHALL mostrar un error con «Reintentar».

#### Scenario: Producto no disponible
- **WHEN** `GET /productos/99` responde 404
- **THEN** se ve «Este producto no está disponible» y el enlace «Ver el catálogo» a `/catalogo`

#### Scenario: Id inválido
- **WHEN** un visitante abre `/catalogo/abc`
- **THEN** ve «Este producto no está disponible» y no se pide ningún producto

### Requirement: Agregar al carrito
Con sesión, «Agregar» en la tarjeta (1 unidad, sin personalización) y «Agregar al carrito» en el detalle (con la cantidad elegida, de 1 al stock, y los ingredientes excluidos elegidos) SHALL sumar el producto al carrito con su precio decimal y SHALL mostrar la notificación «Agregado al carrito» con el nombre, la cantidad y, si hay exclusiones, «sin <ingrediente>» por cada una.

#### Scenario: Agregar desde la tarjeta con sesión
- **WHEN** un `CLIENT` con sesión pulsa «Agregar Hamburguesa Clásica al carrito»
- **THEN** el carrito tiene una línea de «Hamburguesa Clásica» con cantidad 1, precio `"1500.00"` y sin exclusiones, y se ve «Agregado al carrito»

#### Scenario: Agregar varias unidades desde el detalle con sesión
- **WHEN** en el detalle de un producto con stock 3 un `CLIENT` sube la cantidad a 3 y pulsa «Agregar al carrito»
- **THEN** el carrito suma 3 unidades y el botón «Sumar una unidad» quedó deshabilitado al llegar a 3

#### Scenario: Agregar personalizado desde el detalle
- **WHEN** en el detalle de «Hamburguesa Clásica» un `CLIENT` marca «Sin Cebolla», deja la cantidad en 1 y pulsa «Agregar al carrito»
- **THEN** el carrito tiene una línea de «Hamburguesa Clásica» sin «Cebolla» con cantidad 1, y la notificación dice «1 × Hamburguesa Clásica, sin cebolla»

#### Scenario: Misma personalización suma a la misma línea
- **WHEN** el carrito ya tiene 1 «Hamburguesa Clásica» sin «Cebolla» y el cliente vuelve a agregarla sin «Cebolla»
- **THEN** el carrito sigue con una sola línea de «Hamburguesa Clásica» sin «Cebolla», con cantidad 2

### Requirement: Agregar al carrito sin sesión
Sin sesión, «Agregar» y «Agregar al carrito» SHALL llevar a `/ingresar` recordando la ruta actual (path, query y hash) y NO SHALL modificar el carrito. Al iniciar sesión, la persona SHALL volver exactamente a esa ruta (el catálogo con sus filtros y página, o el detalle del producto) y el producto NO SHALL agregarse automáticamente.

#### Scenario: Visitante anónimo agrega desde el catálogo
- **WHEN** un visitante sin sesión que está en `/catalogo?categoria=2&page=2` pulsa «Agregar Hamburguesa Clásica al carrito»
- **THEN** la URL pasa a `/ingresar` con `/catalogo?categoria=2&page=2` como ruta recordada, el carrito sigue vacío y no se ve «Agregado al carrito»

#### Scenario: Vuelta al mismo catálogo tras iniciar sesión
- **WHEN** ese visitante inicia sesión como `CLIENT`
- **THEN** la URL pasa a `/catalogo?categoria=2&page=2`, se ven los mismos filtros y página, y el carrito sigue vacío

#### Scenario: Visitante anónimo agrega desde el detalle
- **WHEN** un visitante sin sesión en `/catalogo/7` pulsa «Agregar al carrito» e inicia sesión como `CLIENT`
- **THEN** pasa por `/ingresar` con `/catalogo/7` recordada, vuelve a `/catalogo/7` y el carrito sigue vacío

#### Scenario: Ruta recordada inválida
- **WHEN** la ruta recordada de `/ingresar` es `//otro-sitio.com` o `/catalogo/abc`
- **THEN** tras iniciar sesión la URL pasa a `/catalogo`

#### Scenario: Agotado en el detalle
- **WHEN** el producto tiene stock 0
- **THEN** el detalle muestra «Agotado», sin selector de cantidad, y el botón de agregar está deshabilitado

### Requirement: Datos públicos que sobreviven a la sesión
Las consultas de productos y categorías SHALL ser públicas: no SHALL descartarse al cerrar sesión y no SHALL exigir sesión.

#### Scenario: Cerrar sesión en el catálogo
- **WHEN** un `CLIENT` ve el catálogo y cierra sesión
- **THEN** el catálogo sigue mostrando los mismos productos sin un pedido nuevo de productos

### Requirement: Accesibilidad del catálogo
Las acciones SHALL nombrar su producto («Agregar Burger Vegana al carrito»), el árbol SHALL ser una navegación con nombre «Categorías» que marca la actual con `aria-current`, y el catálogo, el detalle y la hoja de filtros SHALL pasar la revisión automática de accesibilidad.

#### Scenario: Revisión automática
- **WHEN** se renderizan el catálogo con datos, el estado sin resultados, la hoja de filtros abierta y el detalle
- **THEN** la revisión automática no reporta violaciones

### Requirement: Personalización en el detalle
Si el producto tiene ingredientes removibles y stock, el detalle SHALL mostrar «Personalizá tu pedido» con una casilla «Sin <ingrediente>» por cada ingrediente removible, en el orden del servidor y sin marcar. Los ingredientes no removibles no SHALL poder excluirse. Sin removibles, o agotado, la sección no SHALL mostrarse.

#### Scenario: Producto con removibles
- **WHEN** un visitante abre el detalle de «Hamburguesa Clásica» con «Cebolla» y «Tomate» removibles y «Pan Brioche» no removible
- **THEN** ve «Personalizá tu pedido» con las casillas «Sin Cebolla» y «Sin Tomate» sin marcar, y ninguna casilla para «Pan Brioche»

#### Scenario: Producto sin removibles
- **WHEN** el producto «Coca-Cola 500ml» no tiene ingredientes removibles
- **THEN** no se ve «Personalizá tu pedido»

#### Scenario: Producto agotado
- **WHEN** el producto tiene ingredientes removibles y stock 0
- **THEN** no se ve «Personalizá tu pedido»

#### Scenario: Alérgeno removible
- **WHEN** «Mayonesa» es alérgeno y removible
- **THEN** la casilla «Sin Mayonesa» se ve y la mayonesa sigue listada en «Contiene alérgenos»

#### Scenario: Revisión automática
- **WHEN** se renderiza el detalle con la sección de personalización y una casilla marcada
- **THEN** la revisión automática de accesibilidad no reporta violaciones

### Requirement: Filtros en la barra superior en escritorio
Desde 1024 px el catálogo SHALL mostrar bajo el buscador los chips de categorías de primer nivel (`aria-pressed` en el actual), una segunda fila con las subcategorías de la raíz elegida, el botón «Precio» que abre un panel con el rango de precio, y el interruptor «Solo con stock». El panel SHALL cerrarse con Escape, clic afuera o un rango válido aplicado, devolviendo el foco a «Precio». En escritorio no SHALL ofrecerse «Filtros» ni la hoja.

#### Scenario: Subcategorías de la raíz elegida
- **WHEN** a 1440 px el visitante elige el chip «Hamburguesas» y luego «Veganas» en la segunda fila
- **THEN** el pedido incluye solo `categoria_ids=4`, «Veganas» queda con `aria-pressed="true"` y «Hamburguesas» sigue marcada en la primera fila

#### Scenario: Volver a la raíz desde la segunda fila
- **WHEN** con «Veganas» elegida el visitante pulsa «Todas» de la segunda fila
- **THEN** la URL contiene `categoria=1` y el pedido incluye `categoria_ids` 1, 4 y 5

#### Scenario: Precio desde el panel
- **WHEN** el visitante pulsa «Precio», ingresa mínimo 1000 y máximo 2000 y pulsa «Aplicar»
- **THEN** el pedido incluye `precio_min=1000&precio_max=2000`, el panel se cierra y el foco vuelve a «Precio»

#### Scenario: Rango inválido en el panel
- **WHEN** en el panel ingresa mínimo 3000 y máximo 1000 y pulsa «Aplicar»
- **THEN** ve «El mínimo no puede superar al máximo», el panel sigue abierto y no se hace ningún pedido nuevo

#### Scenario: Cerrar el panel con Escape
- **WHEN** el panel de precio está abierto y el visitante pulsa Escape
- **THEN** el panel se cierra sin aplicar y el foco vuelve a «Precio»
