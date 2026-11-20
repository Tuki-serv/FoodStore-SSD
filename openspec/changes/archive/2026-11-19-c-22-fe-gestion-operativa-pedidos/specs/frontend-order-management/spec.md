# Spec Delta — frontend-order-management

## Purpose

Define cómo los usuarios `PEDIDOS` y `ADMIN` operan los pedidos en el frontend de Food Store: listarlos y filtrarlos, ver su detalle e historial, confirmarlos a mano, avanzarlos por la máquina de estados hasta la entrega y cancelarlos con motivo, con las acciones que permiten la FSM, el rol y la forma de pago.

## ADDED Requirements

### Requirement: Acceso a la gestión de pedidos
Las rutas `/gestion-pedidos` y `/gestion-pedidos/:pedidoId` SHALL abrirse solo con sesión y algún rol `PEDIDOS` o `ADMIN`. Sin sesión SHALL llevar a `/ingresar` recordando la ruta pedida; con sesión sin esos roles SHALL mostrar la pantalla «Sin permiso». La sección «Gestión de pedidos» del panel lateral SHALL abrir la pantalla real, no una página provisoria.

#### Scenario: Gestor de pedidos
- **WHEN** un usuario con solo el rol `PEDIDOS` abre `/gestion-pedidos`
- **THEN** ve el título «Gestión de pedidos» y el listado de pedidos

#### Scenario: Administrador
- **WHEN** un usuario con solo el rol `ADMIN` abre `/gestion-pedidos`
- **THEN** ve el título «Gestión de pedidos» y el listado de pedidos

#### Scenario: Cliente sin permiso
- **WHEN** un usuario con solo el rol `CLIENT` abre `/gestion-pedidos/57`
- **THEN** ve la pantalla «Sin permiso» y no se pide el pedido al servidor

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/gestion-pedidos`
- **THEN** la URL pasa a `/ingresar` con `/gestion-pedidos` como ruta recordada

### Requirement: Listado de todos los pedidos
El listado SHALL mostrar los pedidos de todos los clientes, del más nuevo al más viejo, paginados de a 20, con número, fecha y hora de creación en hora local, nombre del cliente, forma de pago, total con el formato de precio del catálogo y el distintivo del estado. Cada pedido SHALL enlazar a su detalle.

#### Scenario: Pedidos de varios clientes
- **WHEN** existen el pedido 58 de «Ana» `EFECTIVO` `PENDIENTE` por `"3850.00"` y el 57 de «Bruno» `MERCADOPAGO` `CONFIRMADO`
- **THEN** el listado muestra primero «#58» con «Ana», «Efectivo», «$ 3.850» y «Pendiente», y luego «#57» con «Bruno»

#### Scenario: Ir al detalle
- **WHEN** el gestor pulsa el pedido «#58»
- **THEN** la URL pasa a `/gestion-pedidos/58`

#### Scenario: Más de una página
- **WHEN** hay 45 pedidos y el gestor pasa a la página 3
- **THEN** ve 5 pedidos y la URL incluye `page=3`

### Requirement: Filtros por estado y fecha
El listado SHALL permitir filtrar por un estado (o «Todos») y por un rango de fechas «Desde»/«Hasta» inclusivo. Los filtros SHALL guardarse en la URL, volver a la página 1 al cambiar y poder quitarse con «Limpiar filtros». Un rango con «Desde» posterior a «Hasta» SHALL mostrar un error junto a las fechas y no SHALL pedirse al servidor.

#### Scenario: Filtrar por estado
- **WHEN** el gestor elige el estado «En preparación»
- **THEN** la URL incluye `estado=EN_PREP` y solo se listan pedidos «En preparación»

#### Scenario: Filtrar por fechas
- **WHEN** el gestor elige desde 2026-11-18 hasta 2026-11-19
- **THEN** la URL incluye `desde=2026-11-18&hasta=2026-11-19` y el servidor recibe esas fechas

#### Scenario: Rango invertido
- **WHEN** el gestor elige desde 2026-11-19 hasta 2026-11-18
- **THEN** ve «La fecha "Desde" no puede ser posterior a "Hasta"» y el listado no cambia

#### Scenario: Filtros desde la URL
- **WHEN** el gestor abre `/gestion-pedidos?estado=PENDIENTE`
- **THEN** el filtro de estado muestra «Pendiente» y se listan solo pedidos pendientes

#### Scenario: Sin resultados con filtros
- **WHEN** ningún pedido cumple los filtros elegidos
- **THEN** ve «No hay pedidos con estos filtros» y la acción «Limpiar filtros»

### Requirement: Estados de carga, vacío y error del listado
Mientras carga la primera vez el listado SHALL mostrar un estado de carga; sin pedidos y sin filtros SHALL mostrar «Todavía no hay pedidos»; ante un error de red o del servidor SHALL mostrar el error con «Reintentar».

#### Scenario: Sin pedidos
- **WHEN** no existe ningún pedido
- **THEN** ve «Todavía no hay pedidos»

#### Scenario: Error del servidor
- **WHEN** el servidor responde 500 al listado
- **THEN** ve el mensaje de error y «Reintentar», que vuelve a pedir el listado

### Requirement: Actualización periódica
El listado y el detalle abiertos SHALL volver a pedirse al servidor cada 30 segundos mientras la pestaña está visible, sin vaciar lo que se muestra mientras llega la respuesta, y SHALL ofrecer «Actualizar» para pedirlos en el momento. SHALL indicar la hora de la última actualización. Con la pestaña oculta no SHALL hacer pedidos periódicos.

#### Scenario: Pedido nuevo aparece solo
- **WHEN** el gestor tiene el listado abierto y un cliente crea un pedido
- **THEN** a los 30 segundos el pedido nuevo aparece en el listado sin recargar la página

#### Scenario: Actualizar a mano
- **WHEN** el gestor pulsa «Actualizar»
- **THEN** el listado se pide otra vez al servidor y la hora de última actualización cambia

### Requirement: Detalle operativo del pedido
El detalle SHALL mostrar número, estado, fecha y hora, cliente, forma de pago, entrega (la dirección de entrega o «Retiro en el local»), ítems con cantidad, personalización «Sin …» y subtotal, subtotal, costo de envío, descuento, total y notas del cliente si las hay. Un pedido inexistente SHALL mostrar «No encontramos este pedido» con un enlace al listado.

#### Scenario: Pedido con envío
- **WHEN** el gestor abre el pedido 58 de «Ana» con entrega en «Av. Siempre Viva 742, Springfield»
- **THEN** ve «Pedido #58», «Ana», «Efectivo», esa dirección, los ítems y el total «$ 3.850»

#### Scenario: Retiro en el local
- **WHEN** el pedido no tiene dirección de entrega
- **THEN** la entrega muestra «Retiro en el local»

#### Scenario: Pedido inexistente
- **WHEN** el gestor abre `/gestion-pedidos/999` y el servidor responde 404
- **THEN** ve «No encontramos este pedido» y el enlace «Volver a pedidos»

### Requirement: Historial del pedido
El detalle SHALL mostrar el historial como una línea de tiempo en orden cronológico: por cada cambio, el estado al que pasó, quién lo hizo (su nombre, o «Sistema» si no hubo usuario), fecha y hora y el motivo u observación si lo hay. El primer evento SHALL leerse como la creación del pedido.

#### Scenario: Historial completo
- **WHEN** el pedido 58 se creó, lo confirmó «Carla» y luego pasó a preparación con la observación «Sale en 20 min»
- **THEN** la línea de tiempo muestra, en ese orden, «Pedido creado», «Confirmado» por «Carla» y «En preparación» con «Sale en 20 min»

#### Scenario: Cambio hecho por el Sistema
- **WHEN** una fila del historial no tiene usuario (pago aprobado por Mercado Pago)
- **THEN** ese evento muestra «Sistema» como autor

### Requirement: Acciones según estado, rol y forma de pago
El detalle SHALL ofrecer solo las acciones que la FSM permite a `PEDIDOS`/`ADMIN`: en `PENDIENTE` «Confirmar pago» (solo `EFECTIVO`/`TRANSFERENCIA`) y «Cancelar pedido»; en `CONFIRMADO` «Pasar a preparación» y «Cancelar pedido»; en `EN_PREP` «Despachar» y «Cancelar pedido»; en `EN_CAMINO` «Marcar entregado». `ENTREGADO` y `CANCELADO` no SHALL ofrecer acciones.

#### Scenario: Pendiente en efectivo
- **WHEN** un `PEDIDOS` abre un pedido `PENDIENTE` `EFECTIVO`
- **THEN** ve «Confirmar pago» y «Cancelar pedido»

#### Scenario: Pendiente con Mercado Pago
- **WHEN** un `ADMIN` abre un pedido `PENDIENTE` `MERCADOPAGO`
- **THEN** no ve «Confirmar pago», ve «Cancelar pedido» y el aviso «Se confirma solo cuando Mercado Pago aprueba el pago»

#### Scenario: En preparación
- **WHEN** un `PEDIDOS` abre un pedido `EN_PREP`
- **THEN** ve «Despachar» y «Cancelar pedido»

#### Scenario: En camino
- **WHEN** un `ADMIN` abre un pedido `EN_CAMINO`
- **THEN** ve «Marcar entregado» y no ve «Cancelar pedido»

#### Scenario: Pedido terminado
- **WHEN** el gestor abre un pedido `ENTREGADO` o `CANCELADO`
- **THEN** no ve ninguna acción de cambio de estado

#### Scenario: Mismas acciones para ADMIN y PEDIDOS
- **WHEN** un `ADMIN` y un `PEDIDOS` abren el mismo pedido `CONFIRMADO`
- **THEN** ambos ven «Pasar a preparación» y «Cancelar pedido»

### Requirement: Próxima acción desde el listado
Cada fila del listado SHALL ofrecer la acción de avance que corresponde a su estado y forma de pago («Confirmar pago», «Pasar a preparación», «Despachar» o «Marcar entregado»), con el mismo diálogo que el detalle. La cancelación SHALL ofrecerse solo en el detalle.

#### Scenario: Fila confirmable
- **WHEN** el listado incluye un pedido `PENDIENTE` `TRANSFERENCIA`
- **THEN** su fila ofrece «Confirmar pago»

#### Scenario: Fila sin avance
- **WHEN** el listado incluye un pedido `PENDIENTE` `MERCADOPAGO`, uno `ENTREGADO` y uno `CANCELADO`
- **THEN** ninguna de esas filas ofrece una acción de avance

### Requirement: Avanzar el estado con observación opcional
Cada acción de avance SHALL abrir un diálogo que nombra el pedido y el estado destino, con un campo de observación opcional de hasta 300 caracteres. Al confirmar SHALL enviar `{nuevo_estado, motivo}` (sin `motivo` si la observación quedó vacía), deshabilitar el botón mientras viaja, cerrar el diálogo al terminar bien, avisar el éxito y actualizar el estado, las acciones, el historial y el listado.

#### Scenario: Pasar a preparación
- **WHEN** el gestor pulsa «Pasar a preparación» en el pedido 57 `CONFIRMADO`, escribe «Sale en 20 min» y confirma
- **THEN** el servidor recibe `{"nuevo_estado": "EN_PREP", "motivo": "Sale en 20 min"}`, el pedido muestra «En preparación», ofrece «Despachar» y el historial suma el evento con esa observación

#### Scenario: Despachar sin observación
- **WHEN** el gestor confirma «Despachar» en un pedido `EN_PREP` sin escribir observación
- **THEN** el servidor recibe `{"nuevo_estado": "EN_CAMINO"}` y el pedido muestra «En camino»

#### Scenario: Doble clic
- **WHEN** el gestor pulsa dos veces seguidas el botón de confirmar del diálogo
- **THEN** el servidor recibe un solo cambio de estado

### Requirement: Confirmación manual del pago
«Confirmar pago» SHALL explicar en su diálogo que confirma que el local recibió el pago en efectivo o por transferencia y que al confirmar se descuenta el stock. Si el servidor rechaza la confirmación por falta de stock, el diálogo SHALL mostrar el mensaje del servidor, el pedido SHALL seguir «Pendiente» y SHALL ofrecer «Cancelar por falta de stock», que abre la cancelación con el motivo «Sin stock» ya escrito.

#### Scenario: Confirmar pago en efectivo
- **WHEN** el gestor confirma el pago del pedido 58 `PENDIENTE` `EFECTIVO`
- **THEN** el servidor recibe `{"nuevo_estado": "CONFIRMADO"}` y el pedido muestra «Confirmado» con «Pasar a preparación»

#### Scenario: Sin stock al confirmar
- **WHEN** el servidor responde 409 `INSUFFICIENT_STOCK` «No hay stock suficiente para Hamburguesa Clásica»
- **THEN** el diálogo muestra ese mensaje, el pedido sigue «Pendiente» y se ofrece «Cancelar por falta de stock»

#### Scenario: Cancelar por falta de stock
- **WHEN** después del rechazo por stock el gestor pulsa «Cancelar por falta de stock»
- **THEN** se abre la cancelación con el motivo «Sin stock» escrito

### Requirement: Cancelar un pedido con motivo
«Cancelar pedido» SHALL abrir un diálogo de confirmación destructiva con un motivo obligatorio de hasta 300 caracteres y la aclaración de que la cancelación no se puede deshacer y, si el pedido ya estaba confirmado o en preparación, devuelve el stock. Sin motivo SHALL mostrar «Escribí el motivo de la cancelación» y no SHALL enviar nada. Al confirmar SHALL enviar `{nuevo_estado: "CANCELADO", motivo}`.

#### Scenario: Cancelar con motivo
- **WHEN** el gestor cancela el pedido 58 `PENDIENTE` con el motivo «El cliente no responde»
- **THEN** el servidor recibe `{"nuevo_estado": "CANCELADO", "motivo": "El cliente no responde"}`, el pedido muestra «Cancelado» sin acciones y el historial suma el evento con ese motivo

#### Scenario: Cancelar sin motivo
- **WHEN** el gestor confirma la cancelación con el motivo vacío o solo espacios
- **THEN** ve «Escribí el motivo de la cancelación» y no se envía nada

### Requirement: Errores al cambiar el estado
Los errores del cambio de estado SHALL decidirse por el `code` del servidor y mostrarse dentro del diálogo sin perder lo escrito: `INVALID_TRANSITION` SHALL mostrar el `detail`, avisar que el pedido cambió y volver a pedir el pedido; un error de red o 5xx SHALL ofrecer «Reintentar»; 403 SHALL mostrar «No tenés permiso para cambiar este pedido»; 404 SHALL mostrar «Este pedido ya no existe».

#### Scenario: Otro gestor lo movió antes
- **WHEN** el servidor responde 409 `INVALID_TRANSITION` «No se puede cambiar de EN_PREP a EN_PREP»
- **THEN** el diálogo muestra ese mensaje con «El pedido cambió mientras lo mirabas», y el detalle se vuelve a pedir y muestra el estado actual

#### Scenario: Error de conexión
- **WHEN** el cambio de estado falla por la red
- **THEN** el diálogo muestra «No pudimos conectar con el servidor.» con «Reintentar» y la observación escrita sigue en el campo

### Requirement: Accesibilidad de la gestión de pedidos
El listado, el detalle y los diálogos SHALL no tener violaciones de accesibilidad detectables automáticamente. Los diálogos SHALL atrapar el foco, cerrarse con Escape (salvo mientras se envía) y devolver el foco al botón que los abrió; los errores SHALL anunciarse con `role="alert"`. Los filtros SHALL tener etiquetas visibles.

#### Scenario: Foco al cerrar el diálogo
- **WHEN** el gestor abre «Despachar» y lo cierra con Escape
- **THEN** el foco vuelve al botón «Despachar»

#### Scenario: Sin violaciones
- **WHEN** se analizan con axe el listado con datos, el detalle con historial y el diálogo de cancelación con error
- **THEN** no hay violaciones
