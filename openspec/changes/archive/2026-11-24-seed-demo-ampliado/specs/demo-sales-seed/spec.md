## Purpose

Define las ventas de demostración que siembra `python -m app.db.seed`: un historial de pedidos coherente con las reglas del dominio y repartido en el tiempo respecto de la fecha de la corrida, para que el dashboard de métricas, «Mis pedidos» y la gestión de pedidos muestren datos en todos sus filtros de fecha.

## ADDED Requirements

### Requirement: Ventas de demostración sembradas por defecto
Salvo que se pida omitirlas, el seed SHALL crear entre 250 y 350 pedidos de demostración, hechos por los clientes de ejemplo y por `cliente@foodstore.com`, con sus detalles, su historial de estados y, cuando corresponda, su pago. `cliente@foodstore.com` SHALL tener al menos 8 de esos pedidos.

#### Scenario: Ventas sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** hay entre 250 y 350 pedidos, todos de usuarios con el rol `CLIENT` creados por el seed, y al menos 8 son de `cliente@foodstore.com`

#### Scenario: Cada pedido con detalle e historial
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada pedido tiene al menos una línea de detalle y al menos una entrada de historial

### Requirement: Cobertura temporal relativa a la corrida
Las fechas de creación de los pedidos de demostración SHALL calcularse en UTC respecto del instante de la corrida, sin ser posteriores a él ni anteriores a 365 días. Las ventas (según `sales-metrics`) SHALL cubrir el día de la corrida, cada uno de los últimos 30 días y cada uno de los 11 meses calendario anteriores al mes en curso, con al menos 10 ventas en cada uno de esos meses.

#### Scenario: Ventas hoy
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** al menos un pedido vendido tiene fecha de creación en el día UTC de la corrida, y ninguno es posterior al instante de la corrida

#### Scenario: Cada día de los últimos 30
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada uno de los 30 días UTC que terminan en el día de la corrida tiene al menos un pedido vendido

#### Scenario: Cada mes del último año
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada uno de los 11 meses calendario anteriores al mes en curso tiene al menos 10 pedidos vendidos y el mes en curso tiene al menos uno

#### Scenario: Nada fuera del año
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** ningún pedido tiene fecha de creación anterior a 365 días antes de la corrida

### Requirement: Métricas con datos en cada período del dashboard
Después del seed, los reportes de `sales-metrics` SHALL devolver datos no vacíos para cada atajo del dashboard («Hoy», últimos 7 días, últimos 30 días, «Este mes») y para el rango de los últimos 366 días agrupado por día, semana y mes.

#### Scenario: Resumen por atajo
- **WHEN** después del seed se pide el resumen de KPIs para cada uno de los rangos «Hoy», «7 días», «30 días» y «Este mes», calculados en UTC sobre el día de la corrida
- **THEN** en cada rango la cantidad de ventas y los ingresos son mayores que cero

#### Scenario: Serie mensual del último año
- **WHEN** después del seed se piden las ventas por período de los últimos 366 días con agrupación mensual
- **THEN** cada uno de los 12 meses calendario que terminan en el mes en curso tiene ventas mayores que cero

#### Scenario: Desgloses de los últimos 30 días
- **WHEN** después del seed se piden, para los últimos 30 días, los productos más vendidos, los pedidos por estado y los ingresos por forma de pago
- **THEN** hay al menos 5 productos con ventas, los pedidos por estado incluyen `ENTREGADO` y `CANCELADO` con cantidad mayor que cero, y `MERCADOPAGO`, `EFECTIVO` y `TRANSFERENCIA` tienen ingresos mayores que cero

### Requirement: Mezcla de estados con pedidos activos recientes
Los pedidos de demostración SHALL estar mayoritariamente en `ENTREGADO`, SHALL incluir pedidos `CANCELADO`, y SHALL incluir entre 8 y 12 pedidos no terminales con al menos uno en cada estado `PENDIENTE`, `CONFIRMADO`, `EN_PREP` y `EN_CAMINO`. Todo pedido no terminal SHALL haberse creado el día UTC de la corrida o el anterior.

#### Scenario: Activos para operar en vivo
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** hay entre 8 y 12 pedidos no terminales, al menos uno en cada uno de `PENDIENTE`, `CONFIRMADO`, `EN_PREP` y `EN_CAMINO`, todos creados hoy o ayer (UTC)

#### Scenario: Mayoría entregados
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** más del 70 % de los pedidos están en `ENTREGADO` y al menos el 5 % en `CANCELADO`

### Requirement: Importes y snapshots coherentes
Cada pedido de demostración SHALL cumplir las reglas de importes del dominio: líneas con el nombre y el precio base del producto al sembrar, sin productos repetidos; subtotal igual a la suma de las líneas, descuento 0, envío fijo de $50 y total = subtotal − descuento + envío. La personalización, cuando existe, SHALL contener solo ingredientes removibles del producto, con sus nombres.

#### Scenario: Totales de cada pedido
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** en cada pedido `subtotal` = Σ `subtotal_snapshot` de sus líneas, `descuento` = 0, `costo_envio` = 50.00 y `total` = `subtotal` + 50.00

#### Scenario: Snapshot de las líneas
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada línea tiene `nombre_snapshot` igual al nombre de su producto, `precio_snapshot` igual a su precio base, `subtotal_snapshot` = `precio_snapshot` × `cantidad`, y ningún pedido repite `producto_id`

#### Scenario: Personalización válida
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** al menos una línea tiene personalización, y en toda línea personalizada cada id es un ingrediente removible de su producto y `personalizacion_snapshot` lista sus nombres

### Requirement: Historial válido según la máquina de estados
El historial de cada pedido de demostración SHALL empezar con la creación por su dueño, recorrer solo transiciones que la máquina de estados permite al actor registrado y terminar en el estado actual, con marcas de tiempo estrictamente crecientes y no posteriores a la corrida. La confirmación SHALL registrarla el Sistema en pedidos `MERCADOPAGO` y un `ADMIN` o `PEDIDOS` en `EFECTIVO`/`TRANSFERENCIA`; toda cancelación SHALL tener motivo.

#### Scenario: Recorrido válido
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** para cada pedido, su historial ordenado empieza en `NULL → PENDIENTE` con el usuario del pedido, cada transición siguiente está permitida por la máquina de estados para los roles de su usuario (o para el Sistema si no tiene usuario) y la forma de pago del pedido, y la última llega al estado actual

#### Scenario: Tiempos crecientes
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** en cada pedido la primera entrada coincide con su fecha de creación, cada entrada es estrictamente posterior a la anterior y ninguna es posterior al instante de la corrida

#### Scenario: Cancelaciones con motivo
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** toda entrada con `estado_hacia` `CANCELADO` tiene un motivo no vacío

### Requirement: Pagos de demostración sin pasarela
Cada pedido `MERCADOPAGO` de demostración que llegó a `CONFIRMADO` SHALL tener exactamente un pago en estado `aprobado` por el total del pedido, con identificadores de MercadoPago marcados como de demostración (prefijo `SEED-`). Los pedidos `EFECTIVO` y `TRANSFERENCIA` y los `MERCADOPAGO` que nunca se confirmaron no SHALL tener pago. El seed no SHALL comunicarse con MercadoPago.

#### Scenario: Pago aprobado por cada venta con MercadoPago
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada pedido `MERCADOPAGO` cuyo historial pasa por `CONFIRMADO` tiene un único pago `aprobado` con `transaction_amount` igual a su total y `mp_order_id` y `mp_payment_id` que empiezan con `SEED-`, y ningún otro pedido de demostración tiene pagos

#### Scenario: Sin red
- **WHEN** se ejecuta el seed sin acceso a la red ni credenciales de MercadoPago
- **THEN** el seed termina sin errores y siembra los pagos de demostración

### Requirement: Stock coherente para la demo en vivo
Después del seed, ningún producto SHALL tener stock negativo, y cada producto SHALL tener stock suficiente para confirmar todos los pedidos `PENDIENTE` de demostración que lo incluyen. Las ventas históricas no SHALL modificar el stock del catálogo de demostración: el stock que queda es el declarado para cada producto.

#### Scenario: Confirmar los pendientes en vivo
- **WHEN** después del seed un usuario `PEDIDOS` confirma, uno por uno, todos los pedidos `PENDIENTE` de demostración con `EFECTIVO` o `TRANSFERENCIA`
- **THEN** todas las confirmaciones responden con éxito y ningún producto queda con stock negativo

#### Scenario: Stock no negativo
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** ningún producto tiene `stock_cantidad` menor que cero

### Requirement: Ventas sembradas una sola vez
Si al correr el seed ya existe algún pedido de un cliente de ejemplo, el seed no SHALL crear ningún pedido, detalle, historial ni pago de demostración. Las fechas de las ventas quedan fijadas por la primera corrida; para regenerarlas se recrea la base.

#### Scenario: Segunda corrida
- **WHEN** se ejecuta el seed dos veces seguidas sobre una base recién migrada
- **THEN** la segunda corrida no agrega pedidos, detalles, historial ni pagos

#### Scenario: Base con pedidos reales de un cliente de ejemplo
- **WHEN** se ejecuta el seed con la opción para omitir las ventas, un cliente de ejemplo crea un pedido por la API y después se ejecuta el seed sin esa opción
- **THEN** la base conserva solo el pedido creado por la API

### Requirement: Opción para omitir las ventas
El seed SHALL aceptar una opción (`--sin-ventas` en `python -m app.db.seed`) que siembra todo lo demás sin crear pedidos de demostración. Una corrida posterior sin la opción SHALL sembrar las ventas, si ningún cliente de ejemplo tiene pedidos.

#### Scenario: Base sin historia
- **WHEN** se ejecuta el seed con la opción para omitir las ventas sobre una base recién migrada
- **THEN** existen los catálogos, los usuarios, los clientes de ejemplo y el catálogo de demostración, y no hay pedidos

#### Scenario: Ventas en una corrida posterior
- **WHEN** después de esa corrida se ejecuta el seed sin la opción
- **THEN** se siembran las ventas de demostración

### Requirement: Generación determinística
Para un mismo instante de corrida y un mismo catálogo de demostración, la generación de las ventas SHALL producir exactamente los mismos pedidos (clientes, fechas, líneas, cantidades, estados, formas de pago e historial).

#### Scenario: Mismo instante, mismas ventas
- **WHEN** se generan las ventas de demostración dos veces con el mismo instante de corrida y el mismo catálogo
- **THEN** ambas generaciones son idénticas
