# Spec Delta — frontend-cart

## MODIFIED Requirements

### Requirement: Página del carrito
La ruta `/carrito` SHALL mostrar, solo con sesión, el título «Carrito», una lista con una entrada por línea del carrito en el orden en que se agregaron y un resumen con la cantidad total de unidades y el importe total. Cada entrada SHALL mostrar imagen (o su respaldo), nombre, precio unitario, cantidad y subtotal de la línea, con importes en el formato de precio del catálogo. El resumen SHALL aclarar que se suma un costo de envío de `$ 50` y que los precios finales se confirman al crear el pedido. Para un usuario con rol `CLIENT` el resumen SHALL ofrecer «Finalizar compra», que lleva a `/finalizar-compra`; para un usuario sin rol `CLIENT` SHALL mostrar, en su lugar, que solo las cuentas de cliente pueden hacer pedidos.

#### Scenario: Carrito con dos líneas
- **WHEN** un `CLIENT` con 2 «Hamburguesa Clásica» a `"1500.00"` y 1 «Coca-Cola 500ml» a `"800.00"` abre `/carrito`
- **THEN** ve dos entradas en ese orden, con subtotales «$ 3.000» y «$ 800», y el resumen «3 unidades» y total «$ 3.800»

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/carrito`
- **THEN** la URL pasa a `/ingresar` con `/carrito` como ruta recordada

#### Scenario: Finalizar compra
- **WHEN** un `CLIENT` con productos en el carrito pulsa «Finalizar compra»
- **THEN** la URL pasa a `/finalizar-compra`

#### Scenario: Usuario sin rol de cliente
- **WHEN** un usuario con solo el rol `ADMIN` y productos en el carrito abre `/carrito`
- **THEN** no ve «Finalizar compra» y ve que solo las cuentas de cliente pueden hacer pedidos
