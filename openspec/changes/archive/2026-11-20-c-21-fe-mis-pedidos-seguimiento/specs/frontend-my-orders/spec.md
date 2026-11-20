# Spec Delta — frontend-my-orders

## Purpose

Define cómo un cliente de Food Store ve sus propios pedidos en el frontend: el listado paginado y filtrable por estado, el detalle con el progreso, el estado del pago y el historial, la actualización periódica sin WebSocket y la cancelación de un pedido propio con motivo.

## ADDED Requirements

### Requirement: Acceso a Mis pedidos
Las rutas `/mis-pedidos` y `/mis-pedidos/:pedidoId` SHALL abrirse con cualquier sesión. Sin sesión SHALL llevar a `/ingresar` recordando la ruta pedida. La sección «Mis pedidos» del panel lateral SHALL abrir la pantalla real, no una página provisoria.

#### Scenario: Cliente
- **WHEN** un usuario con el rol `CLIENT` abre `/mis-pedidos`
- **THEN** ve el título «Mis pedidos» y el listado de sus pedidos

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/mis-pedidos/58`
- **THEN** la URL pasa a `/ingresar` con `/mis-pedidos/58` como ruta recordada

### Requirement: Listado de mis pedidos
El listado SHALL mostrar solo los pedidos del usuario de la sesión, aunque tenga roles de gestión, del más nuevo al más viejo, paginados de a 10, con número, fecha y hora de creación en hora local, forma de pago, total con el formato de precio del catálogo y el distintivo del estado. La página SHALL guardarse en la URL. Cada pedido SHALL enlazar a su detalle.

#### Scenario: Pedidos propios
- **WHEN** el cliente tiene el pedido 58 `EFECTIVO` `PENDIENTE` por `"3850.00"` y el 41 `MERCADOPAGO` `ENTREGADO`
- **THEN** el listado muestra primero «#58» con «Efectivo», «$ 3.850» y «Pendiente», y luego «#41» con «Entregado»

#### Scenario: Gestor que también compra
- **WHEN** un usuario con los roles `CLIENT` y `PEDIDOS` abre `/mis-pedidos`
- **THEN** el servidor recibe el pedido del listado con `propios=true` y solo se listan sus pedidos

#### Scenario: Ir al detalle
- **WHEN** el cliente pulsa el pedido «#58»
- **THEN** la URL pasa a `/mis-pedidos/58`

#### Scenario: Más de una página
- **WHEN** el cliente tiene 23 pedidos y pasa a la página 3
- **THEN** ve 3 pedidos y la URL incluye `page=3`

### Requirement: Filtro por estado de mis pedidos
El listado SHALL ofrecer un filtro «Estado» con «Todos» y los seis estados con su texto. El estado elegido SHALL guardarse en la URL como `estado` y enviarse al servidor junto con `propios=true`; un valor desconocido SHALL leerse como «Todos». Cambiar el filtro SHALL volver a la página 1. Con un filtro activo SHALL ofrecer «Limpiar filtro», que vuelve a «Todos» en la página 1. La paginación de a 10 y la marca «En curso» SHALL seguir igual.

#### Scenario: Filtrar por un estado
- **WHEN** el cliente elige «Entregado» en el filtro «Estado»
- **THEN** la URL incluye `estado=ENTREGADO`, el servidor recibe `propios=true&estado=ENTREGADO&page=1&size=10` y solo se listan pedidos «Entregado»

#### Scenario: Filtro guardado en la URL
- **WHEN** el cliente abre `/mis-pedidos?estado=CANCELADO`
- **THEN** el filtro muestra «Cancelado» y el servidor recibe `estado=CANCELADO`

#### Scenario: Estado desconocido en la URL
- **WHEN** el cliente abre `/mis-pedidos?estado=DESPACHADO`
- **THEN** el filtro muestra «Todos» y el servidor no recibe `estado`

#### Scenario: Cambiar el filtro vuelve a la página 1
- **WHEN** el cliente está en `/mis-pedidos?page=3` y elige «Pendiente»
- **THEN** la URL pasa a `estado=PENDIENTE` sin `page` y se ve la primera página

#### Scenario: Filtro con paginación
- **WHEN** el cliente tiene 12 pedidos «Entregado», filtra por ese estado y pasa a la página 2
- **THEN** ve 2 pedidos y la URL incluye `estado=ENTREGADO` y `page=2`

#### Scenario: Limpiar el filtro
- **WHEN** el cliente tiene el filtro «Entregado» activo y pulsa «Limpiar filtro»
- **THEN** el filtro vuelve a «Todos», la URL queda `/mis-pedidos` y el servidor deja de recibir `estado`

#### Scenario: Sin filtro no se ofrece limpiar
- **WHEN** el filtro está en «Todos»
- **THEN** no se ve «Limpiar filtro»

### Requirement: Estados de carga, vacío y error del listado
Mientras carga la primera vez el listado SHALL mostrar un estado de carga; sin pedidos y sin filtro SHALL mostrar «Todavía no hiciste pedidos» con el enlace «Ver catálogo»; sin resultados con un filtro de estado activo SHALL mostrar «No tenés pedidos en ese estado» con «Limpiar filtro» y sin «Ver catálogo»; ante un error de red o del servidor SHALL mostrar el error con «Reintentar». El filtro SHALL seguir visible en todos estos estados.

#### Scenario: Sin pedidos
- **WHEN** el cliente no tiene pedidos
- **THEN** ve «Todavía no hiciste pedidos» y el enlace «Ver catálogo»

#### Scenario: Sin pedidos en el estado filtrado
- **WHEN** el cliente tiene pedidos pero ninguno «En camino» y filtra por ese estado
- **THEN** ve «No tenés pedidos en ese estado» y «Limpiar filtro», y no ve «Todavía no hiciste pedidos»

#### Scenario: Error del servidor
- **WHEN** el servidor responde 500 al listado
- **THEN** ve el mensaje de error y «Reintentar», que vuelve a pedir el listado

### Requirement: Detalle de mi pedido
El detalle SHALL mostrar número, estado, fecha y hora, forma de pago, entrega (la dirección o «Retiro en el local»), ítems con cantidad, personalización «Sin …» y subtotal, subtotal, costo de envío, descuento, total y las notas si las hay. Un pedido inexistente, que el servidor rechaza con 403, o que no es del usuario de la sesión SHALL mostrar «No encontramos este pedido» con el enlace «Volver a mis pedidos».

#### Scenario: Pedido con envío
- **WHEN** el cliente abre su pedido 58 con entrega en «Av. Siempre Viva 742, Springfield»
- **THEN** ve «Pedido #58», «Efectivo», esa dirección, los ítems con «Sin cebolla» y el total «$ 3.850»

#### Scenario: Retiro en el local
- **WHEN** el pedido no tiene dirección de entrega
- **THEN** la entrega muestra «Retiro en el local»

#### Scenario: Pedido ajeno
- **WHEN** un usuario con el rol `PEDIDOS` abre `/mis-pedidos/57` y el servidor devuelve un pedido de otro usuario
- **THEN** ve «No encontramos este pedido» y no ve datos del pedido

#### Scenario: Pedido inexistente
- **WHEN** el cliente abre `/mis-pedidos/999` y el servidor responde 404
- **THEN** ve «No encontramos este pedido» y el enlace «Volver a mis pedidos»

### Requirement: Progreso del pedido
El detalle SHALL mostrar el progreso en los pasos Pendiente, Confirmado, En preparación, En camino y Entregado, marcando los pasos cumplidos y el actual, y una línea que explica qué sigue según el estado y la forma de pago. Un pedido cancelado SHALL mostrar «Pedido cancelado» con el motivo en lugar de los pasos.

#### Scenario: Pendiente en efectivo
- **WHEN** el cliente abre su pedido `PENDIENTE` `EFECTIVO`
- **THEN** el paso actual es «Pendiente» y ve que el local confirma el pedido cuando recibe el pago

#### Scenario: En preparación
- **WHEN** el cliente abre su pedido `EN_PREP`
- **THEN** «Pendiente» y «Confirmado» se ven cumplidos y el paso actual es «En preparación»

#### Scenario: Cancelado
- **WHEN** el cliente abre su pedido `CANCELADO` con el motivo «Me equivoqué de dirección»
- **THEN** ve «Pedido cancelado» con ese motivo y no ve los pasos

### Requirement: Estado del pago con Mercado Pago
En un pedido `MERCADOPAGO` el detalle SHALL mostrar el estado del último intento de pago (pendiente, aprobado, rechazado con su motivo, o a devolver). Si el pedido sigue `PENDIENTE` sin un pago aprobado ni en confirmación SHALL ofrecer ir a pagarlo («Pagar … con tarjeta», o «Reintentar el pago de …» si el último intento fue rechazado). Los pedidos `EFECTIVO` y `TRANSFERENCIA` no SHALL consultar el pago.

#### Scenario: Pago rechazado
- **WHEN** el pedido `PENDIENTE` `MERCADOPAGO` tiene un último intento rechazado por fondos insuficientes
- **THEN** ve «Último intento de pago: rechazado» con el motivo legible y «Reintentar el pago de $ 3.850», que lleva a la página de pago del pedido

#### Scenario: Pago aprobado
- **WHEN** el pedido `CONFIRMADO` `MERCADOPAGO` tiene el pago aprobado
- **THEN** ve «Pago aprobado» y no se ofrece pagar

#### Scenario: Efectivo
- **WHEN** el cliente abre su pedido `EFECTIVO`
- **THEN** no se consulta el estado del pago

### Requirement: Historial de mi pedido
El detalle SHALL mostrar el historial como una línea de tiempo en orden cronológico: por cada cambio, el estado al que pasó, quién lo hizo («Vos» si fue el usuario de la sesión, «El local» si fue otro usuario, «Automático» si no hubo usuario), fecha y hora y el motivo u observación si lo hay. El primer evento SHALL leerse como la creación del pedido. Si el historial no carga, el resto del detalle SHALL verse igual y el historial SHALL ofrecer «Reintentar».

#### Scenario: Historial completo
- **WHEN** el cliente creó el pedido 58, lo confirmó la gestora «Carla» y pasó a preparación con la observación «Sale en 20 min»
- **THEN** la línea de tiempo muestra, en ese orden, «Pedido creado» por «Vos», «Confirmado» por «El local» y «En preparación» con «Sale en 20 min», sin el nombre «Carla»

#### Scenario: Confirmado por el pago aprobado
- **WHEN** una fila del historial no tiene usuario
- **THEN** ese evento muestra «Automático» como autor

#### Scenario: Historial con error
- **WHEN** el servidor responde 500 al historial
- **THEN** el detalle se ve y el bloque de historial muestra «Reintentar»

### Requirement: Actualización periódica del seguimiento
Mientras la pestaña está visible, el detalle de un pedido no terminado (ni `ENTREGADO` ni `CANCELADO`), con su historial, SHALL volver a pedirse cada 30 segundos, y el listado SHALL volver a pedirse cada 30 segundos mientras alguno de los pedidos de la página no esté terminado, sin vaciar lo que se muestra. Ambos SHALL indicar la hora de la última actualización y ofrecer «Actualizar». Con la pestaña oculta no SHALL hacer pedidos periódicos.

#### Scenario: Cambio de estado aparece solo
- **WHEN** el cliente tiene abierto su pedido `CONFIRMADO` y el local lo pasa a preparación
- **THEN** a los 30 segundos el detalle muestra «En preparación» y el historial suma el evento sin recargar la página

#### Scenario: Pedido terminado
- **WHEN** el cliente tiene abierto su pedido `ENTREGADO`
- **THEN** pasados 30 segundos no se vuelve a pedir el pedido

#### Scenario: Actualizar a mano
- **WHEN** el cliente pulsa «Actualizar» en el detalle
- **THEN** el pedido se pide otra vez al servidor y la hora de última actualización cambia

#### Scenario: Pestaña oculta
- **WHEN** la pestaña queda oculta con un pedido en curso abierto
- **THEN** no se hacen pedidos periódicos hasta que vuelve a estar visible

### Requirement: Cancelar mi pedido con motivo
El detalle SHALL ofrecer «Cancelar pedido» solo si el pedido está `PENDIENTE` o `CONFIRMADO`; en los demás estados no terminados SHALL explicar que ya no se puede cancelar. La acción SHALL abrir un diálogo de confirmación destructiva con motivo obligatorio de hasta 300 caracteres y el aviso de que no se puede deshacer. Sin motivo SHALL mostrar «Escribí el motivo de la cancelación» y no SHALL enviar nada.

#### Scenario: Cancelar un pedido pendiente
- **WHEN** el cliente cancela su pedido 58 `PENDIENTE` con el motivo «Me equivoqué de dirección»
- **THEN** el servidor recibe `DELETE /pedidos/58` con `{"motivo": "Me equivoqué de dirección"}`, el pedido muestra «Pedido cancelado» con ese motivo, sin «Cancelar pedido», y aparece el aviso «Pedido #58 cancelado»

#### Scenario: Sin motivo
- **WHEN** el cliente confirma la cancelación con el motivo vacío o solo espacios
- **THEN** ve «Escribí el motivo de la cancelación» y no se envía nada

#### Scenario: En preparación
- **WHEN** el cliente abre su pedido `EN_PREP`
- **THEN** no ve «Cancelar pedido» y ve que el pedido ya se está preparando y no se puede cancelar

#### Scenario: Confirmado con Mercado Pago
- **WHEN** el cliente abre la cancelación de su pedido `CONFIRMADO` `MERCADOPAGO`
- **THEN** el diálogo avisa que el reintegro del pago no es automático y se gestiona con el local

#### Scenario: Doble clic
- **WHEN** el cliente pulsa dos veces seguidas «Cancelar pedido» en el diálogo
- **THEN** el servidor recibe una sola cancelación

### Requirement: Errores al cancelar mi pedido
Los errores de la cancelación SHALL decidirse por el `code` del servidor y mostrarse dentro del diálogo sin perder el motivo escrito: `INVALID_TRANSITION` SHALL avisar que el pedido ya avanzó y no se puede cancelar y volver a pedir el pedido; un error de red o 5xx SHALL ofrecer «Reintentar» con el mismo motivo; 403 y 404 SHALL mostrar que el pedido no está disponible.

#### Scenario: El local ya lo pasó a preparación
- **WHEN** el servidor responde 409 `INVALID_TRANSITION` a la cancelación
- **THEN** el diálogo muestra «Tu pedido ya avanzó y no se puede cancelar» y el detalle se vuelve a pedir y muestra el estado actual

#### Scenario: Error de conexión
- **WHEN** la cancelación falla por la red
- **THEN** el diálogo muestra «No pudimos conectar con el servidor.» con «Reintentar» y el motivo sigue escrito

### Requirement: Accesibilidad de Mis pedidos
El listado, el detalle y el diálogo de cancelación SHALL no tener violaciones de accesibilidad detectables automáticamente. El progreso SHALL anunciar el paso actual en texto. El diálogo SHALL atrapar el foco, cerrarse con Escape (salvo mientras se envía) y devolver el foco a «Cancelar pedido» o, si ya no existe, al título del pedido; los errores SHALL anunciarse con `role="alert"`.

#### Scenario: Foco al cerrar el diálogo
- **WHEN** el cliente abre la cancelación y la cierra con Escape
- **THEN** el foco vuelve a «Cancelar pedido»

#### Scenario: Sin violaciones
- **WHEN** se analizan con axe el listado con datos y filtro activo, el detalle con historial y el diálogo de cancelación con error
- **THEN** no hay violaciones
