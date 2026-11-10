# backend-db-seed Specification

## Purpose
Define qué datos iniciales siembra `python -m app.db.seed` sobre una base migrada (catálogos de la spec, admin inicial y datos de demostración) y garantiza que el seed se pueda correr las veces que haga falta, también sobre bases con datos viejos, sin duplicar ni dejar datos a medias.

## Requirements

### Requirement: Catálogo de roles
Tras el seed, el catálogo de roles SHALL contener `ADMIN`, `STOCK`, `PEDIDOS` y `CLIENT`. El seed no SHALL crear ningún otro rol.

#### Scenario: Roles sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** la tabla de roles contiene exactamente `ADMIN`, `STOCK`, `PEDIDOS` y `CLIENT`

### Requirement: Rol COCINA intacto
El seed no SHALL crear, modificar ni borrar el rol `COCINA` ni sus asignaciones a usuarios. Su incorporación o eliminación es una decisión pendiente (DD-23).

#### Scenario: Base con COCINA asignado
- **WHEN** se ejecuta el seed sobre una base que tiene el rol `COCINA` asignado a un usuario
- **THEN** el rol `COCINA` y su asignación siguen existiendo sin cambios

### Requirement: Catálogo de estados de pedido
Tras el seed, el catálogo de estados SHALL contener exactamente seis estados con este orden: `PENDIENTE`(1), `CONFIRMADO`(2), `EN_PREP`(3), `EN_CAMINO`(4), `ENTREGADO`(5) y `CANCELADO`(6). Solo `ENTREGADO` y `CANCELADO` SHALL ser terminales.

#### Scenario: Estados sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** la tabla de estados contiene exactamente los seis códigos, con `orden` 1 a 6 en ese orden y `es_terminal` verdadero solo en `ENTREGADO` y `CANCELADO`

#### Scenario: EN_CAMINO disponible
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existe el estado `EN_CAMINO` con `orden` 4 y no terminal

### Requirement: Catálogo de formas de pago
Tras el seed sobre una base sin formas de pago, el catálogo SHALL contener exactamente `MERCADOPAGO`, `EFECTIVO` y `TRANSFERENCIA`, las tres habilitadas. `TARJETA` no SHALL sembrarse: el pago con tarjeta es un medio dentro de `MERCADOPAGO`.

#### Scenario: Formas de pago sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** la tabla de formas de pago contiene exactamente `MERCADOPAGO`, `EFECTIVO` y `TRANSFERENCIA`, todas con `habilitado` verdadero

#### Scenario: Pedido con TRANSFERENCIA
- **WHEN** después del seed un cliente crea un pedido válido con `forma_pago_codigo` `TRANSFERENCIA`
- **THEN** el pedido se crea con esa forma de pago

### Requirement: Habilitación de formas de pago existentes respetada
El seed no SHALL cambiar el valor `habilitado` de una forma de pago del catálogo que ya existe: habilitar o deshabilitar una forma de pago es una decisión operativa.

#### Scenario: Forma de pago del catálogo deshabilitada
- **WHEN** se ejecuta el seed sobre una base donde `EFECTIVO` existe con `habilitado` falso
- **THEN** `EFECTIVO` sigue con `habilitado` falso

### Requirement: Reconciliación de catálogos existentes
Sobre una base que ya tiene filas de los catálogos de roles o estados, el seed SHALL dejar cada fila del catálogo con los valores de la spec (orden, carácter terminal, nombre y descripción) y SHALL agregar las que falten, sin borrar filas.

#### Scenario: Base con el catálogo de estados viejo
- **WHEN** se ejecuta el seed sobre una base con cinco estados, sin `EN_CAMINO` y con `CANCELADO` en `orden` 99
- **THEN** quedan los seis estados de la spec y `CANCELADO` tiene `orden` 6

#### Scenario: Pedidos existentes conservan su estado
- **WHEN** se ejecuta el seed sobre una base con un pedido en `CANCELADO` y el catálogo viejo
- **THEN** el pedido sigue en `CANCELADO` y su historial no cambia

### Requirement: Formas de pago fuera del catálogo deshabilitadas
Una forma de pago que existe en la base y no pertenece al catálogo (por ejemplo `TARJETA`) SHALL quedar deshabilitada y no SHALL borrarse, de modo que los pedidos que la referencian se conserven y ningún pedido nuevo pueda usarla.

#### Scenario: Base con TARJETA y un pedido que la usa
- **WHEN** se ejecuta el seed sobre una base con la forma de pago `TARJETA` y un pedido que la referencia
- **THEN** `TARJETA` sigue existiendo con `habilitado` falso y el pedido conserva `forma_pago_codigo` `TARJETA`

#### Scenario: Pedido nuevo con TARJETA rechazado
- **WHEN** después de ese seed un cliente intenta crear un pedido con `forma_pago_codigo` `TARJETA`
- **THEN** recibe 400 con el detalle «Forma de pago no está habilitada» y no se crea el pedido

### Requirement: Administrador inicial
El seed SHALL crear, si no existe, el usuario `admin@foodstore.com` con el rol `ADMIN` y la contraseña `Admin1234!`, credencial de desarrollo fijada por la spec que se cambia en producción.

#### Scenario: Admin sembrado con la contraseña de la spec
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existe un único usuario activo `admin@foodstore.com`, con exactamente el rol `ADMIN`, y `Admin1234!` verifica contra su hash de contraseña

#### Scenario: La contraseña vieja no sirve
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** `admin123` no verifica contra el hash de contraseña de `admin@foodstore.com`

### Requirement: Usuarios existentes no se modifican
Si un usuario que el seed crearía ya existe con ese email (activo o dado de baja), el seed no SHALL cambiar su contraseña, sus datos ni sus roles.

#### Scenario: Admin existente con otra contraseña
- **WHEN** se ejecuta el seed sobre una base donde `admin@foodstore.com` ya existe con otra contraseña
- **THEN** su hash de contraseña queda igual y no se crea un segundo admin

### Requirement: Datos de demostración
El seed SHALL crear, si no existen, los usuarios de prueba `cliente@foodstore.com` (CLIENT), `pedidos@foodstore.com` (PEDIDOS) y `stock@foodstore.com` (STOCK), y el catálogo de demostración: 7 unidades de medida, 6 categorías, 12 ingredientes y 6 productos con sus relaciones.

#### Scenario: Demo sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existen los tres usuarios de prueba con su rol, 7 unidades de medida, 6 categorías, 12 ingredientes y 6 productos

### Requirement: Bajas lógicas respetadas
El seed no SHALL volver a crear un dato de demostración que existe dado de baja lógica: un registro con el mismo nombre (o email, o símbolo) cuenta como existente aunque tenga `deleted_at`.

#### Scenario: Producto de demo dado de baja
- **WHEN** se da de baja lógica el producto «Hamburguesa Clásica» y se vuelve a ejecutar el seed
- **THEN** no aparece un producto activo «Hamburguesa Clásica» nuevo

### Requirement: Seed idempotente
Ejecutar el seed sobre una base que ya fue sembrada SHALL terminar sin errores y SHALL dejar el contenido de todas las tablas que siembra exactamente igual al que dejó la corrida anterior.

#### Scenario: Dos corridas seguidas
- **WHEN** se ejecuta el seed dos veces seguidas sobre una base recién migrada
- **THEN** la segunda corrida termina sin errores y las filas de roles, estados, formas de pago, usuarios, asignaciones de roles, unidades, categorías, ingredientes, productos y sus relaciones son idénticas a las de la primera

#### Scenario: Corrida sobre base reconciliada
- **WHEN** se ejecuta el seed sobre una base con catálogos viejos y después se ejecuta otra vez
- **THEN** la segunda corrida no cambia ninguna fila

### Requirement: Seed atómico
El seed SHALL aplicar todos sus cambios en una sola transacción: si falla en cualquier punto, la base SHALL quedar como estaba antes de la corrida.

#### Scenario: Falla a mitad de la corrida
- **WHEN** se ejecuta el seed sobre una base recién migrada donde ya existe una unidad de medida activa «Kilogramo» con otro símbolo, de modo que crear la unidad de demostración `kg` viola la unicidad del nombre después de haber sembrado catálogos y usuarios
- **THEN** el seed termina con error y la base no tiene ningún rol, estado, forma de pago ni usuario, y conserva solo esa unidad de medida
