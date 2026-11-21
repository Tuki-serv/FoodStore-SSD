# frontend-checkout Specification

## Purpose

Define cómo un cliente convierte su carrito en un pedido en el frontend de Food Store: quién puede finalizar la compra, cómo elige entrega y forma de pago, qué totales ve, cómo se crea el pedido `PENDIENTE`, cómo se informan los errores y qué ve después según la forma de pago, incluido el traspaso al pago con tarjeta.

## Requirements

### Requirement: Acceso a finalizar compra
La ruta `/finalizar-compra` SHALL abrirse solo con sesión y rol `CLIENT`. Sin sesión SHALL llevar a `/ingresar` recordando `/finalizar-compra`; con sesión sin rol `CLIENT` SHALL mostrar la pantalla de «Sin permiso». Con el carrito vacío SHALL reemplazar la URL por `/carrito`.

#### Scenario: Cliente con productos
- **WHEN** un `CLIENT` con 3 unidades en el carrito abre `/finalizar-compra`
- **THEN** ve el título «Finalizar compra», los pasos «Entrega» y «Forma de pago» y el resumen del pedido

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/finalizar-compra`
- **THEN** la URL pasa a `/ingresar` con `/finalizar-compra` como ruta recordada

#### Scenario: Rol sin permiso
- **WHEN** un usuario con solo el rol `ADMIN` abre `/finalizar-compra`
- **THEN** ve la pantalla «Sin permiso»

#### Scenario: Carrito vacío
- **WHEN** un `CLIENT` con el carrito vacío abre `/finalizar-compra`
- **THEN** la URL pasa a `/carrito` y ve «Tu carrito está vacío»

### Requirement: Elegir la entrega
El paso «Entrega» SHALL ofrecer las direcciones del cliente y la opción «Retiro en el local», con la dirección principal preseleccionada (si no hay principal, la primera; sin direcciones, el retiro). SHALL ofrecer un enlace a `/direcciones` para gestionar direcciones. La elección SHALL enviarse como `direccion_id` (el id elegido, o `null` para el retiro).

#### Scenario: Principal preseleccionada
- **WHEN** el cliente tiene «Casa» (principal) y «Trabajo»
- **THEN** «Casa» aparece elegida al abrir la pantalla

#### Scenario: Sin direcciones
- **WHEN** el cliente no tiene direcciones guardadas
- **THEN** ve «No tenés direcciones guardadas» con el enlace «Agregar dirección» y «Retiro en el local» elegido

### Requirement: Elegir la forma de pago
El paso «Forma de pago» SHALL ofrecer «Tarjeta (Mercado Pago)», «Efectivo» y «Transferencia bancaria», sin ninguna elegida al abrir. Confirmar sin elegir SHALL mostrar «Elegí una forma de pago» junto al grupo, mover el foco al grupo y no SHALL enviar nada al servidor. Al elegir «Efectivo» o «Transferencia bancaria» SHALL explicar que el pedido queda pendiente hasta que el local confirme el pago a mano; al elegir «Tarjeta (Mercado Pago)» SHALL explicar que el pago con tarjeta se hace en el paso siguiente. La pantalla no SHALL mostrar campos de tarjeta.

#### Scenario: Confirmar sin forma de pago
- **WHEN** el cliente pulsa «Confirmar pedido» sin elegir forma de pago
- **THEN** ve «Elegí una forma de pago» y no se envía ningún pedido

#### Scenario: Efectivo explica la confirmación manual
- **WHEN** el cliente elige «Efectivo»
- **THEN** ve que el pedido queda pendiente hasta que el local confirme el pago y no ve campos de tarjeta

### Requirement: Resumen del pedido con envío y descuento
El resumen SHALL listar cada línea del carrito (nombre, personalización «Sin …», cantidad y subtotal) y mostrar «Subtotal», «Costo de envío» `$ 50`, «Descuento» `$ 0` y «Total estimado» = subtotal + envío − descuento, con el formato de precio del catálogo. SHALL aclarar que el total final lo confirma el servidor con los precios vigentes y que el stock se verifica al crear el pedido pero se descuenta recién cuando el pedido se confirma. El costo de envío SHALL mostrarse igual para el retiro en el local mientras PA-13 siga abierta.

#### Scenario: Totales estimados
- **WHEN** el carrito tiene 2 «Hamburguesa Clásica» a `"1500.00"` y 1 «Coca-Cola 500ml» a `"800.00"`
- **THEN** el resumen muestra subtotal «$ 3.800», costo de envío «$ 50», descuento «$ 0» y total estimado «$ 3.850»

#### Scenario: Personalización en el resumen
- **WHEN** una línea excluye «Cebolla» y «Tomate»
- **THEN** su entrada del resumen muestra «Sin cebolla, sin tomate»

### Requirement: Crear el pedido
«Confirmar pedido» con entrega y forma de pago elegidas SHALL enviar un único `POST /api/v1/pedidos/` con `direccion_id`, `forma_pago_codigo`, `notas` (solo si se escribieron, sin espacios sobrantes) e `items` con `producto_id`, `cantidad` y `personalizacion` (ids ordenados; vacío si no hay exclusiones) por línea del carrito. Mientras el pedido viaja el botón SHALL quedar deshabilitado con el texto «Creando pedido…» y los campos no SHALL poder cambiarse. Al responder 201 SHALL vaciar el carrito y navegar a `/finalizar-compra/pedido/<id>`.

#### Scenario: Pedido creado con efectivo
- **WHEN** el cliente con «Casa» (id 4) elegida, «Efectivo» y 2 «Hamburguesa Clásica» sin cebolla (ingrediente 1) pulsa «Confirmar pedido» y el servidor responde 201 con el pedido 57
- **THEN** el servidor recibe `{direccion_id: 4, forma_pago_codigo: "EFECTIVO", items: [{producto_id: 1, cantidad: 2, personalizacion: [1]}]}`, el carrito queda vacío y la URL pasa a `/finalizar-compra/pedido/57`

#### Scenario: Retiro en el local
- **WHEN** el cliente elige «Retiro en el local» y confirma
- **THEN** el servidor recibe `direccion_id: null`

#### Scenario: Doble clic
- **WHEN** el cliente pulsa «Confirmar pedido» dos veces seguidas
- **THEN** el servidor recibe un solo pedido y el botón muestra «Creando pedido…» deshabilitado hasta la respuesta

### Requirement: Errores al crear el pedido
Si el servidor rechaza la creación, la pantalla SHALL mostrar un aviso «No pudimos crear el pedido» con el mensaje del servidor, mover el foco al aviso, conservar el carrito y las elecciones, y volver a habilitar «Confirmar pedido». El caso SHALL decidirse por el `code` del error, no por el texto del mensaje: «Revisar carrito» (enlace a `/carrito`) ante `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `DUPLICATE_ITEM` o `INVALID_CUSTOMIZATION`; elegir otra forma de pago ante `PAYMENT_METHOD_UNAVAILABLE`; elegir otra entrega ante `ADDRESS_NOT_FOUND`, volviendo a pedir las direcciones; «Reintentar» cuando el servidor no respondió o falló (5xx). Un error sin código conocido SHALL mostrar el mensaje del servidor sin acción específica. Un 401 sigue el flujo de sesión existente y un 403 informa que solo las cuentas de cliente pueden hacer pedidos.

#### Scenario: Sin stock
- **WHEN** el servidor responde 400 con `code` `INSUFFICIENT_STOCK` y el mensaje «No hay stock suficiente»
- **THEN** se ve «No pudimos crear el pedido», «No hay stock suficiente» y «Revisar carrito», y el carrito conserva sus líneas

#### Scenario: Producto no disponible
- **WHEN** el servidor responde 400 con `code` `PRODUCT_UNAVAILABLE`
- **THEN** se ve el aviso con el mensaje del servidor y «Revisar carrito»

#### Scenario: Producto inexistente
- **WHEN** el servidor responde 404 con `code` `PRODUCT_NOT_FOUND`
- **THEN** se ve el aviso con el mensaje del servidor y «Revisar carrito»

#### Scenario: Forma de pago deshabilitada
- **WHEN** el servidor responde 400 con `code` `PAYMENT_METHOD_UNAVAILABLE`
- **THEN** se ve el aviso con el mensaje del servidor, la invitación a elegir otra forma de pago, y la forma elegida sigue marcada para que el cliente la cambie

#### Scenario: Líneas duplicadas
- **WHEN** el servidor responde 400 con `code` `DUPLICATE_ITEM`
- **THEN** se ve el aviso con el mensaje del servidor y «Revisar carrito»

#### Scenario: Personalización inválida
- **WHEN** el servidor responde 400 con `code` `INVALID_CUSTOMIZATION`
- **THEN** se ve el aviso con el mensaje del servidor y «Revisar carrito»

#### Scenario: Dirección que ya no está disponible
- **WHEN** el servidor responde 404 con `code` `ADDRESS_NOT_FOUND`
- **THEN** se ve el aviso con el mensaje del servidor y la invitación a elegir otra entrega, y el selector vuelve a cargar las direcciones del cliente

#### Scenario: Mismo texto, otro código
- **WHEN** el servidor responde 400 con el mensaje «No hay stock suficiente» pero `code` `PAYMENT_METHOD_UNAVAILABLE`
- **THEN** se ofrece elegir otra forma de pago, no «Revisar carrito»

#### Scenario: Sin conexión
- **WHEN** el servidor no responde
- **THEN** se ve «No pudimos conectar con el servidor.» con «Reintentar», que vuelve a enviar el mismo pedido

### Requirement: Confirmación del pedido creado
`/finalizar-compra/pedido/<id>` (solo `CLIENT`) SHALL mostrar «Pedido #<id> recibido», el estado «Pendiente», la entrega (dirección o «Retiro en el local»), la forma de pago y los totales devueltos por el servidor (subtotal, costo de envío, descuento, total). Si el total del servidor difiere del total estimado del checkout SHALL avisarlo («Los precios se actualizaron»). Al recargar la página SHALL obtener el pedido del servidor; si no existe o no es del cliente SHALL mostrar «No encontramos este pedido» con un enlace al catálogo. SHALL ofrecer «Ver mis pedidos» (`/mis-pedidos`) y «Seguir comprando» (`/catalogo`). Todas las variantes SHALL advertir que, si un producto se agota antes de la confirmación, el pedido puede cancelarse por falta de stock.

#### Scenario: Confirmación tras crear
- **WHEN** se crea el pedido 57 con total `"3850.00"`
- **THEN** la confirmación muestra «Pedido #57 recibido», «Pendiente» y total «$ 3.850»

#### Scenario: Precio actualizado
- **WHEN** el total estimado era «$ 3.850» y el servidor devolvió `"4050.00"`
- **THEN** la confirmación muestra total «$ 4.050» y el aviso «Los precios se actualizaron»

#### Scenario: Recarga
- **WHEN** el cliente recarga `/finalizar-compra/pedido/57`
- **THEN** la pantalla pide `GET /api/v1/pedidos/57` y muestra el pedido

### Requirement: Efectivo y transferencia quedan pendientes de confirmación manual
Para un pedido `EFECTIVO` o `TRANSFERENCIA` la confirmación SHALL explicar que el pedido queda pendiente hasta que el local confirme el pago a mano, con los pasos siguientes (el local confirma el pago, el pedido pasa a «Confirmado» y se prepara; se puede seguir en «Mis pedidos»), y no SHALL mostrar formulario de tarjeta ni acción de pago.

#### Scenario: Transferencia
- **WHEN** la confirmación es de un pedido `TRANSFERENCIA`
- **THEN** se ve la explicación de confirmación manual y no se ve «Pagar»

### Requirement: Traspaso al pago con tarjeta
Para un pedido `MERCADOPAGO` en estado `PENDIENTE`, la confirmación SHALL explicar que falta pagar con tarjeta para que el pedido se confirme y SHALL ofrecer «Pagar $ <total> con tarjeta», que navega a `/finalizar-compra/pedido/<id>/pago`. Esa ruta (solo `CLIENT`) SHALL mostrar la página de pago con tarjeta (capability `frontend-payment`).

#### Scenario: Pagar con tarjeta
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` con total `"2850.00"` y el cliente pulsa «Pagar $ 2.850 con tarjeta»
- **THEN** la URL pasa a `/finalizar-compra/pedido/58/pago`

#### Scenario: Ruta de pago provisoria
- **WHEN** el cliente abre `/finalizar-compra/pedido/58/pago`
- **THEN** ve el título «Pagar pedido #58» y no la página provisoria (el nombre del escenario se conserva de C-19; la página provisoria ya no existe)

### Requirement: Accesibilidad del checkout
Los pasos SHALL ser grupos con leyenda, los errores de campo SHALL asociarse a su grupo, el aviso de error SHALL anunciarse y recibir el foco, y la pantalla de checkout (con y sin error) y la confirmación SHALL pasar la revisión automática de accesibilidad.

#### Scenario: Revisión automática
- **WHEN** se renderizan el checkout con datos, el checkout con el aviso de error y la confirmación de efectivo
- **THEN** la revisión automática no reporta violaciones

### Requirement: Estado del pago en la confirmación
Para un pedido `MERCADOPAGO`, la confirmación `/finalizar-compra/pedido/<id>` SHALL mostrar el estado del último intento de pago (`GET /pagos/{pedido_id}`), con el motivo legible si fue rechazado, y SHALL mantener el CTA «Pagar $ <total> con tarjeta» mientras el pedido esté `PENDIENTE` y el pago no esté `pendiente` ni `aprobado` (tras un rechazo el CTA es «Reintentar el pago de $ <total>», como en el mockup aprobado). Sin intentos no SHALL mostrar nada extra.

#### Scenario: Último intento rechazado
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` `PENDIENTE` y su último intento es `rechazado` con detalle `insufficient_amount`
- **THEN** se ve «Último intento de pago: rechazado», el motivo «La tarjeta no tiene fondos suficientes.» y el CTA «Reintentar el pago de $ 2.850»

#### Scenario: Pago en confirmación
- **WHEN** el último intento del pedido 58 es `pendiente`
- **THEN** se ve «Pago en confirmación» y no se ve «Pagar»

#### Scenario: Sin intentos de pago
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` `PENDIENTE` y `GET /pagos/58` devuelve `estado` `null`
- **THEN** se ve «Pagar $ 2.850 con tarjeta» y ninguna línea de estado del pago

#### Scenario: Pedido que no es con tarjeta
- **WHEN** la confirmación es del pedido 60 `EFECTIVO`
- **THEN** no se pide `GET /pagos/60`
