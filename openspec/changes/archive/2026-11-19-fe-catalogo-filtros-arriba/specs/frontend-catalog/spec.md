## MODIFIED Requirements

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

## ADDED Requirements

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
