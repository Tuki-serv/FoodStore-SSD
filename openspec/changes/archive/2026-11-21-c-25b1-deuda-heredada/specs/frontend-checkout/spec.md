# Spec Delta

## MODIFIED Requirements

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
