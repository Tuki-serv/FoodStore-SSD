# Spec Delta — frontend-payment

## Purpose

Define cómo un cliente paga con tarjeta un pedido `MERCADOPAGO` en el frontend de Food Store: quién accede a la página de pago, cómo se tokeniza la tarjeta sin que sus datos pasen por Food Store, qué se envía al backend, qué ve según el resultado inmediato del cobro (aprobado, rechazado con reintento, pendiente, aprobado sin stock) y cómo se informan los casos donde no corresponde pagar y los errores.

## ADDED Requirements

### Requirement: Acceso a la página de pago
La ruta `/finalizar-compra/pedido/:pedidoId/pago` SHALL abrirse solo con sesión y rol `CLIENT`. Sin sesión SHALL llevar a `/ingresar` recordando la ruta; con sesión sin rol `CLIENT` SHALL mostrar «Sin permiso». Un `pedidoId` que no es un entero positivo, o un pedido que el backend responde con 404 o 403, SHALL mostrar «No encontramos este pedido» con un enlace a `/mis-pedidos`.

#### Scenario: Cliente con pedido por pagar
- **WHEN** un `CLIENT` abre `/finalizar-compra/pedido/58/pago` y el pedido 58 es `MERCADOPAGO`, `PENDIENTE`, total `"2850.00"`, sin intentos de pago
- **THEN** ve el título «Pagar pedido #58», el total «$ 2.850» y el formulario de tarjeta

#### Scenario: Sin sesión
- **WHEN** un visitante sin sesión abre `/finalizar-compra/pedido/58/pago`
- **THEN** la URL pasa a `/ingresar` con `/finalizar-compra/pedido/58/pago` como ruta recordada

#### Scenario: Pedido inexistente
- **WHEN** un `CLIENT` abre `/finalizar-compra/pedido/999/pago` y `GET /pedidos/999` responde 404
- **THEN** ve «No encontramos este pedido» y no ve el formulario de tarjeta

#### Scenario: Identificador inválido
- **WHEN** un `CLIENT` abre `/finalizar-compra/pedido/abc/pago`
- **THEN** ve «No encontramos este pedido» sin pedir nada al backend

### Requirement: Formulario de tarjeta tokenizado (PCI SAQ-A)
Cuando corresponde pagar, la página SHALL montar el brick `CardPayment` de `@mercadopago/sdk-react` con locale `es-AR` y el `total` del pedido como monto. Los datos de la tarjeta SHALL ingresarse solo en el brick: ningún componente de Food Store SHALL tener campos de número, CVV o vencimiento.

#### Scenario: Monto del pedido
- **WHEN** el pedido 58 `MERCADOPAGO` `PENDIENTE` tiene total `"2850.00"`
- **THEN** el brick se inicializa con monto `2850`

### Requirement: Clave pública obtenida del backend
El brick SHALL inicializarse con la clave pública que devuelve `GET /api/v1/pagos/config`; ninguna variable de entorno del frontend SHALL contener la clave. Si esa consulta responde 503 o no obtiene respuesta, SHALL mostrarse «El pago con tarjeta no está disponible en este momento» sin montar el brick.

#### Scenario: Clave pública del backend
- **WHEN** `GET /api/v1/pagos/config` responde `{"public_key": "APP_USR-clave-publica-de-prueba"}`
- **THEN** el brick se inicializa con la clave `APP_USR-clave-publica-de-prueba`

#### Scenario: Clave pública no disponible
- **WHEN** `GET /api/v1/pagos/config` responde 503
- **THEN** se ve «El pago con tarjeta no está disponible en este momento» y no se monta el brick

### Requirement: Carga del formulario de tarjeta
Mientras el brick carga SHALL verse un indicador de carga; si el brick informa un error al cargar SHALL mostrarse «No pudimos cargar el formulario de tarjeta» con «Reintentar», que lo vuelve a montar.

#### Scenario: Cargando
- **WHEN** el brick todavía no avisó que está listo
- **THEN** se ve «Cargando el formulario de tarjeta…»

#### Scenario: Error del brick
- **WHEN** el brick informa un error de carga
- **THEN** se ve «No pudimos cargar el formulario de tarjeta» y el botón «Reintentar» vuelve a montarlo

### Requirement: Envío del pago sin datos de tarjeta
Al confirmar en el brick, el frontend SHALL llamar `POST /api/v1/pagos/crear` con exactamente `pedido_id`, `token`, `payment_method_id`, `payment_type_id` (tomado de `additionalData.paymentTypeId`), `installments` (número), `issuer_id` (número o `null`) y `payer` (`email` y, si el brick la entrega con número, `identification` `{type, number}`). Ningún otro campo SHALL enviarse. Mientras el pago se procesa SHALL verse «Procesando el pago…» y no SHALL poder enviarse un segundo pago.

#### Scenario: Cuerpo del pedido de pago
- **WHEN** el brick entrega token `"tok_1"`, `payment_method_id` `"visa"`, `installments` `"3"`, `issuer_id` `"310"`, email `"comprador@test.com"`, identificación `DNI 12345678` y `additionalData.paymentTypeId` `"credit_card"` para el pedido 58
- **THEN** el cuerpo enviado es `{pedido_id: 58, token: "tok_1", payment_method_id: "visa", payment_type_id: "credit_card", installments: 3, issuer_id: 310, payer: {email: "comprador@test.com", identification: {type: "DNI", number: "12345678"}}}`

#### Scenario: Sin identificación ni emisor
- **WHEN** el brick entrega `issuer_id` vacío y la identificación sin número
- **THEN** el cuerpo lleva `issuer_id: null` y `payer` solo con `email`

#### Scenario: Doble envío
- **WHEN** hay un pago en proceso y el cliente intenta confirmar de nuevo
- **THEN** no se envía un segundo `POST /pagos/crear`

### Requirement: Vista según el pedido y el resultado del pago
La página SHALL decidir qué mostrar a partir del pedido (`GET /pedidos/{id}`) y del último resultado de pago conocido (al menos la respuesta de `POST /pagos/crear` y la consulta de `GET /pagos/{pedido_id}` que sigue a un 409): formulario (sin resultado o último resultado `rechazado`, con pedido `PENDIENTE`), aprobado, pendiente, aprobado sin stock (`a_devolver`) o «no corresponde pagar». La respuesta de `POST /pagos/crear` SHALL actualizar la vista sin esperar otra consulta.

#### Scenario: Pedido por pagar sin resultado
- **WHEN** un `CLIENT` abre la página del pedido 58 `MERCADOPAGO` `PENDIENTE` y todavía no envió ningún pago en la sesión
- **THEN** ve el formulario de tarjeta

#### Scenario: Resultado sin otra consulta
- **WHEN** `POST /pagos/crear` responde 201 con `estado` `"rechazado"` para el pedido 58
- **THEN** la vista pasa a rechazado sin pedir `GET /pagos/58`

### Requirement: Pago aprobado
Con el pago `aprobado`, la página SHALL mostrar «¡Pago aprobado!», que el pedido quedó confirmado y los enlaces «Ver mi pedido» (`/finalizar-compra/pedido/<id>`) y «Seguir comprando» (`/catalogo`). SHALL invalidar las consultas del detalle del pedido y de la lista de pedidos.

#### Scenario: Aprobado al crear
- **WHEN** `POST /pagos/crear` responde 201 con `estado` `"aprobado"` para el pedido 58
- **THEN** se ve «¡Pago aprobado!» y el detalle del pedido 58 se vuelve a pedir

### Requirement: Pago rechazado y reintento
Con el pago `rechazado` y el pedido `PENDIENTE`, la página SHALL mostrar «El pago fue rechazado» con un motivo legible derivado de `mp_status_detail` (texto genérico «Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.» si el detalle es desconocido o nulo) y SHALL permitir reintentar sobre el mismo pedido volviendo a montar el brick. El carrito no interviene en el reintento.

#### Scenario: Fondos insuficientes
- **WHEN** `POST /pagos/crear` responde 201 con `estado` `"rechazado"` y `mp_status_detail` `"insufficient_amount"`
- **THEN** se ve «El pago fue rechazado», el motivo «La tarjeta no tiene fondos suficientes.» y «Intentar de nuevo»

#### Scenario: Motivo desconocido
- **WHEN** el rechazo trae `mp_status_detail` `"algo_nuevo"`
- **THEN** se ve el motivo genérico «Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.»

#### Scenario: Reintentar
- **WHEN** el cliente pulsa «Intentar de nuevo» tras un rechazo
- **THEN** vuelve a ver el formulario de tarjeta del mismo pedido y un nuevo envío llama `POST /pagos/crear` con el mismo `pedido_id`

#### Scenario: Datos rechazados por MercadoPago
- **WHEN** `POST /pagos/crear` responde 400
- **THEN** se ve «El pago fue rechazado» con el motivo genérico y se puede reintentar

### Requirement: Pago pendiente
Con el pago `pendiente`, la página SHALL mostrar «Estamos esperando la confirmación de Mercado Pago», explicar que el pedido se confirmará cuando Mercado Pago apruebe el pago y ofrecer «Ver mi pedido», sin formulario de tarjeta ni opción de reintentar.

#### Scenario: Pendiente al crear
- **WHEN** `POST /pagos/crear` responde 201 con `estado` `"pendiente"` para el pedido 58
- **THEN** se ve «Estamos esperando la confirmación de Mercado Pago», el enlace «Ver mi pedido» y no se ve el formulario de tarjeta

### Requirement: Pago aprobado sin stock
Con el pago `a_devolver` (aprobado en MercadoPago pero el pedido quedó `CANCELADO` por falta de stock, DD-20), la página SHALL explicar que el pago se aprobó pero el pedido se canceló porque algún producto se quedó sin stock, que la devolución del dinero se gestiona manualmente y SHALL ofrecer «Ver mi pedido» y «Seguir comprando». No SHALL ofrecer reintentar.

#### Scenario: Cancelado por stock
- **WHEN** `POST /pagos/crear` responde `estado` `"a_devolver"` y el pedido 58 está `CANCELADO`
- **THEN** se ve «Tu pago se aprobó, pero no pudimos confirmar el pedido» con la explicación de la devolución y sin formulario de tarjeta

### Requirement: Pedido que no corresponde pagar
Si el pedido no es `MERCADOPAGO`, ya no está `PENDIENTE` (sin pago `aprobado`/`a_devolver` que explique el estado) o está `CANCELADO`, la página SHALL mostrar «Este pedido no se paga con tarjeta» o «Este pedido ya no se puede pagar» según el caso, con el enlace «Ver mi pedido», sin montar el brick.

#### Scenario: Pedido en efectivo
- **WHEN** el pedido 60 es `EFECTIVO` y el cliente abre su página de pago
- **THEN** se ve «Este pedido no se paga con tarjeta» y no se monta el brick

#### Scenario: Pedido cancelado sin pago
- **WHEN** el pedido 61 `MERCADOPAGO` está `CANCELADO` y no tiene intentos de pago
- **THEN** se ve «Este pedido ya no se puede pagar»

### Requirement: Errores al pagar
Los errores de `POST /pagos/crear` SHALL informarse con un mensaje propio por caso (409, 502, 503 y sin respuesta) sin perder el pedido, y el mensaje SHALL anunciarse a lectores de pantalla. Ante 409 SHALL volver a pedirse el pedido y el pago y mostrarse la vista que corresponda; ante 502 SHALL ofrecerse «Reintentar» (el backend reutiliza el intento sin cobrar dos veces).

#### Scenario: Resultado desconocido
- **WHEN** `POST /pagos/crear` responde 502
- **THEN** se ve «No pudimos confirmar el resultado con Mercado Pago» y «Reintentar»

#### Scenario: Pedido ya pagado
- **WHEN** `POST /pagos/crear` responde 409 y la nueva consulta del pago devuelve `aprobado`
- **THEN** se ve «¡Pago aprobado!»

#### Scenario: Pago no disponible
- **WHEN** `POST /pagos/crear` responde 503
- **THEN** se ve «El pago con tarjeta no está disponible en este momento»

#### Scenario: Sin conexión
- **WHEN** `POST /pagos/crear` no obtiene respuesta
- **THEN** se ve «No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.»

### Requirement: Accesibilidad de la página de pago
Cada cambio de vista (procesando, aprobado, rechazado, pendiente, error) SHALL anunciarse en una región viva o moviendo el foco al título del resultado; los botones y enlaces SHALL tener nombre accesible; la página SHALL tener un único `h1`.

#### Scenario: Anuncio del resultado
- **WHEN** el pago pasa de procesando a rechazado
- **THEN** el título «El pago fue rechazado» recibe el foco
