# Spec Delta — frontend-catalog

## MODIFIED Requirements

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

## ADDED Requirements

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
