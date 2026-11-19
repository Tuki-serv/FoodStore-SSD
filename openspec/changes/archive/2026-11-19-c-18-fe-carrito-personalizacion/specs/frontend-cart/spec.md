# Spec Delta — frontend-cart

## Purpose

Define la pantalla del carrito del frontend de Food Store: cómo la persona con sesión ve sus líneas con la personalización elegida, cambia cantidades, quita líneas o vacía el carrito, ve los totales, y cómo la navegación muestra cuántas unidades lleva.

## ADDED Requirements

### Requirement: Página del carrito
La ruta `/carrito` SHALL mostrar, solo con sesión, el título «Carrito», una lista con una entrada por línea del carrito en el orden en que se agregaron y un resumen con la cantidad total de unidades y el importe total. Cada entrada SHALL mostrar imagen (o su respaldo), nombre, precio unitario, cantidad y subtotal de la línea, con importes en el formato de precio del catálogo.

#### Scenario: Carrito con dos líneas
- **WHEN** un `CLIENT` con 2 «Hamburguesa Clásica» a `"1500.00"` y 1 «Coca-Cola 500ml» a `"800.00"` abre `/carrito`
- **THEN** ve dos entradas en ese orden, con subtotales «$ 3.000» y «$ 800», y el resumen «3 unidades» y total «$ 3.800»

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/carrito`
- **THEN** la URL pasa a `/ingresar` con `/carrito` como ruta recordada

### Requirement: Personalización visible en la línea
Cada entrada SHALL listar los ingredientes excluidos de su línea como «Sin <ingrediente>» separados por coma; una línea sin exclusiones no SHALL mostrar texto de personalización. Dos líneas del mismo producto con distinta personalización SHALL verse como entradas separadas, cada una con su propia cantidad.

#### Scenario: Mismo producto con y sin exclusiones
- **WHEN** el carrito tiene 1 «Hamburguesa Clásica» sin «Cebolla» y «Tomate», y 2 «Hamburguesa Clásica» sin exclusiones
- **THEN** se ven dos entradas de «Hamburguesa Clásica»: una con «Sin cebolla, sin tomate» y cantidad 1, y otra sin texto de personalización y cantidad 2

#### Scenario: Línea guardada sin nombres de exclusiones
- **WHEN** una línea tiene 2 ingredientes excluidos de los que no se conocen los nombres
- **THEN** la entrada muestra «Sin 2 ingredientes»

### Requirement: Cambiar la cantidad de una línea
Cada entrada SHALL tener «Restar una unidad» y «Sumar una unidad» que cambian la cantidad de esa línea en 1 y actualizan subtotal y totales al instante. «Restar una unidad» SHALL estar deshabilitado con cantidad 1 y «Sumar una unidad» con cantidad 99. El carrito no SHALL validar la cantidad contra el stock.

#### Scenario: Sumar una unidad
- **WHEN** la línea de 2 «Hamburguesa Clásica» a `"1500.00"` es la única y el cliente pulsa «Sumar una unidad de Hamburguesa Clásica»
- **THEN** la cantidad pasa a 3, el subtotal a «$ 4.500» y el total a «$ 4.500»

#### Scenario: Restar en cantidad 1
- **WHEN** una línea tiene cantidad 1
- **THEN** su botón «Restar una unidad» está deshabilitado y la línea no se quita

### Requirement: Quitar una línea
Cada entrada SHALL tener una acción «Quitar <producto>» que elimina solo esa línea, sin confirmación, y avisa «Quitado del carrito» con el nombre del producto. Las demás líneas del mismo producto con otra personalización no SHALL cambiar.

#### Scenario: Quitar una de dos líneas del mismo producto
- **WHEN** hay una «Hamburguesa Clásica» sin «Cebolla» y otra sin exclusiones, y el cliente quita la primera
- **THEN** queda solo la línea sin exclusiones y se ve «Quitado del carrito»

### Requirement: Vaciar el carrito
«Vaciar carrito» SHALL pedir confirmación con el diálogo global («¿Vaciar el carrito?», acción destructiva). Confirmar SHALL quitar todas las líneas; cancelar no SHALL cambiar el carrito.

#### Scenario: Confirmar vaciar
- **WHEN** el carrito tiene 3 líneas y el cliente pulsa «Vaciar carrito» y confirma
- **THEN** el carrito queda vacío y se ve el estado vacío

#### Scenario: Cancelar vaciar
- **WHEN** el cliente pulsa «Vaciar carrito» y cancela
- **THEN** las 3 líneas siguen en el carrito

### Requirement: Carrito vacío
Sin líneas, `/carrito` SHALL mostrar «Tu carrito está vacío» con un enlace «Ver catálogo» a `/catalogo`, sin resumen de totales ni «Vaciar carrito».

#### Scenario: Abrir el carrito vacío
- **WHEN** un `CLIENT` con el carrito vacío abre `/carrito`
- **THEN** ve «Tu carrito está vacío» y el enlace «Ver catálogo», y no ve «Vaciar carrito»

### Requirement: Contador del carrito en la navegación
Con sesión y al menos una unidad, el ítem «Carrito» del panel lateral (expandido o colapsado) y un botón «Carrito» en la barra superior mobile SHALL mostrar la cantidad total de unidades, con nombre accesible «Carrito, N productos». Con el carrito vacío no SHALL mostrarse el número. El botón de la barra superior SHALL llevar a `/carrito` y no SHALL existir sin sesión.

#### Scenario: Contador tras agregar
- **WHEN** un `CLIENT` con el carrito vacío agrega 2 unidades de un producto
- **THEN** el ítem «Carrito» del panel muestra «2» y su nombre accesible es «Carrito, 2 productos»

#### Scenario: Carrito vacío
- **WHEN** el carrito no tiene líneas
- **THEN** el ítem «Carrito» no muestra ningún número

#### Scenario: Barra superior mobile
- **WHEN** un `CLIENT` con 3 unidades en el carrito usa la app con ventana menor a 1024 px y pulsa «Carrito, 3 productos» en la barra superior
- **THEN** la URL pasa a `/carrito`

#### Scenario: Visitante sin sesión
- **WHEN** un visitante sin sesión ve la barra superior mobile
- **THEN** no hay botón «Carrito»

### Requirement: Accesibilidad del carrito
Las acciones de cada entrada SHALL nombrar su producto («Sumar una unidad de Hamburguesa Clásica», «Quitar Hamburguesa Clásica»), la cantidad SHALL anunciarse al cambiar y la página con datos y vacía SHALL pasar la revisión automática de accesibilidad.

#### Scenario: Revisión automática
- **WHEN** se renderizan el carrito con dos líneas (una personalizada) y el carrito vacío
- **THEN** la revisión automática no reporta violaciones
