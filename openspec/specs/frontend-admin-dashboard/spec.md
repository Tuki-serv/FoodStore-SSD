# frontend-admin-dashboard Specification

## Purpose
Define la pantalla «Dashboard» del frontend con la que un `ADMIN` sigue el negocio (US-028): período elegido en la URL, tarjetas KPI, gráficos de ventas, productos, estados y formas de pago con alternativa accesible, y sus estados de carga, vacío y error.

## Requirements

### Requirement: Acceso al Dashboard solo para ADMIN
La página «Dashboard» (`/admin/dashboard`) SHALL estar disponible solo para usuarios con el rol `ADMIN` entre sus roles. Un usuario con sesión sin ese rol SHALL ver la página de acceso denegado sin que se pida ninguna estadística; un visitante sin sesión SHALL ir a `/ingresar` con la ruta recordada.

#### Scenario: ADMIN abre el Dashboard
- **WHEN** un usuario con roles `CLIENT` y `ADMIN` abre `/admin/dashboard`
- **THEN** ve el título «Dashboard», las tarjetas KPI y no el aviso de sección en preparación

#### Scenario: PEDIDOS sin acceso
- **WHEN** un usuario con roles `CLIENT` y `PEDIDOS` abre `/admin/dashboard`
- **THEN** ve la página de acceso denegado y no se pide ningún `GET /estadisticas/*`

### Requirement: Período del dashboard en la URL
La página SHALL ofrecer los atajos «Hoy», «Últimos 7 días», «Últimos 30 días» y «Este mes», un rango «Desde»/«Hasta» personalizado y la agrupación «Día»/«Semana»/«Mes», guardados en la URL (`desde`, `hasta`, `agrupacion`). Sin parámetros SHALL usar los últimos 30 días por día. Las fechas SHALL calcularse en UTC, como el backend.

#### Scenario: Valores por defecto
- **WHEN** el 2026-11-20 un `ADMIN` abre `/admin/dashboard`
- **THEN** los reportes se piden con `desde=2026-10-22`, `hasta=2026-11-20` y la serie con `agrupacion=day`

#### Scenario: Atajo
- **WHEN** el `ADMIN` elige «Este mes» el 2026-11-20
- **THEN** la URL incluye `desde=2026-11-01&hasta=2026-11-20` y todos los bloques se vuelven a pedir con ese rango

#### Scenario: Período desde la URL
- **WHEN** el `ADMIN` abre `/admin/dashboard?desde=2026-11-01&hasta=2026-11-15&agrupacion=week`
- **THEN** el rango personalizado muestra esas fechas, la agrupación «Semana» queda elegida y la serie se pide por semana

#### Scenario: Parámetros inválidos en la URL
- **WHEN** la URL trae `agrupacion=year` o una fecha que no es válida
- **THEN** ese parámetro se reemplaza por su valor por defecto sin error visible

### Requirement: Validación del rango personalizado
Un rango con «Desde» posterior a «Hasta» SHALL mostrar «La fecha "Desde" no puede ser posterior a "Hasta"» junto a las fechas; un rango de más de 366 días SHALL mostrar «El período no puede superar un año». En ambos casos no SHALL pedirse nada al servidor y el dashboard SHALL seguir mostrando el último período válido.

#### Scenario: Rango invertido
- **WHEN** el `ADMIN` elige desde 2026-11-19 hasta 2026-11-18
- **THEN** ve el error de fechas y no se pide ningún reporte nuevo

#### Scenario: Rango mayor a un año
- **WHEN** el `ADMIN` elige desde 2025-01-01 hasta 2026-11-20
- **THEN** ve «El período no puede superar un año» y no se pide ningún reporte nuevo

### Requirement: Tarjetas KPI
La página SHALL mostrar cuatro tarjetas: «Ventas» (cantidad), «Ingresos» y «Ticket promedio» (importes en pesos con el mismo formato que los precios del catálogo: separador de miles y centavos solo si no son cero) del período, y «Pedidos activos» (ahora, sin depender del período, aclarado en la tarjeta). «Pedidos activos» SHALL enlazar a la gestión de pedidos.

#### Scenario: Importes formateados
- **WHEN** el resumen devuelve `ventas` 3, `ingresos` "4500.00", `ticket_promedio` "1500.00" y `pedidos_activos` 2
- **THEN** las tarjetas muestran «3», «$ 4.500», «$ 1.500» y «2»

#### Scenario: Ir a pedidos activos
- **WHEN** el `ADMIN` activa la tarjeta «Pedidos activos»
- **THEN** navega a `/gestion-pedidos`

### Requirement: Gráfico de ventas por período
La página SHALL graficar la serie de ventas del período con un punto por período (incluidos los de 0), con el eje temporal rotulado según la agrupación (día `dd/mm`, semana «Sem. dd/mm», mes nombre y año) y los ingresos en el eje de valores; el detalle de cada punto SHALL indicar ingresos y cantidad de pedidos.

#### Scenario: Serie por día
- **WHEN** la serie devuelve tres días, uno con ventas de "1000.00"
- **THEN** el gráfico tiene tres períodos rotulados `09/11`, `10/11` y `11/11`

#### Scenario: Serie por mes
- **WHEN** la agrupación es «Mes» y la serie trae `fecha` 2026-11-01
- **THEN** el período se rotula «nov 2026»

### Requirement: Gráficos de productos, estados y formas de pago
La página SHALL mostrar: el top 5 de productos como barras horizontales por cantidad vendida con sus ingresos; los pedidos por estado como barras con el nombre visible de cada estado (de los seis, en el orden de la FSM) y el color de su distintivo; y los ingresos por forma de pago con el nombre visible de cada forma y su porcentaje del total.

#### Scenario: Nombres visibles de estados
- **WHEN** el reporte de estados trae `EN_PREP` con 3 pedidos
- **THEN** el gráfico muestra «En preparación» con 3

#### Scenario: Porcentaje por forma de pago
- **WHEN** los ingresos son `EFECTIVO` "1500.00" y `MERCADOPAGO` "500.00"
- **THEN** se ve «Efectivo» con 75 % y «Tarjeta (Mercado Pago)» con 25 %

#### Scenario: Estado enlazado a la gestión
- **WHEN** el `ADMIN` activa el estado «Pendiente» en la tabla del gráfico de estados
- **THEN** navega a `/gestion-pedidos?estado=PENDIENTE`

### Requirement: Alternativa accesible de cada gráfico
Cada gráfico SHALL tener un título visible y una tabla de datos equivalente asociada, accesible para lectores de pantalla y mostrable con «Ver como tabla»; el gráfico en sí SHALL quedar oculto a la tecnología asistiva. La página SHALL pasar la revisión automática de accesibilidad (axe) sin violaciones.

#### Scenario: Tabla de top productos
- **WHEN** el `ADMIN` activa «Ver como tabla» en «Productos más vendidos»
- **THEN** ve una tabla con columnas «Producto», «Cantidad» e «Ingresos» con las mismas filas del gráfico

#### Scenario: Sin violaciones de accesibilidad
- **WHEN** se renderiza el dashboard con datos
- **THEN** axe no informa violaciones

### Requirement: Estados de carga, vacío y error por bloque
Cada bloque (KPI, serie, productos, estados, formas de pago) SHALL cargar de forma independiente: un esqueleto mientras carga, un mensaje de vacío cuando el período no tiene datos («Sin ventas en este período» o el que corresponda al bloque) y, ante un error, un mensaje con «Reintentar» que vuelve a pedir solo ese bloque, sin afectar a los demás.

#### Scenario: Error en un solo bloque
- **WHEN** `GET /estadisticas/productos-top` responde 500 y los demás reportes responden 200
- **THEN** el bloque «Productos más vendidos» muestra el error con «Reintentar» y los demás muestran sus datos

#### Scenario: Período sin ventas
- **WHEN** el período no tiene ventas
- **THEN** la serie, los productos y las formas de pago muestran «Sin ventas en este período» y las tarjetas muestran 0 y «$ 0»

#### Scenario: Reintentar
- **WHEN** el bloque con error se reintenta y el servidor responde 200
- **THEN** el bloque muestra sus datos

### Requirement: Actualización manual
La página SHALL mostrar cuándo se actualizaron los datos por última vez y una acción «Actualizar» que vuelve a pedir todos los bloques del período actual, indicando que la actualización está en curso. Los datos de un período ya visto SHALL mostrarse al volver a él mientras se actualizan.

#### Scenario: Actualizar
- **WHEN** el `ADMIN` activa «Actualizar»
- **THEN** se vuelven a pedir los cinco reportes y la marca de actualización cambia al terminar
