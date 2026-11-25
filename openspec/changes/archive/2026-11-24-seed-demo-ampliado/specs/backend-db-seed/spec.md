## MODIFIED Requirements

### Requirement: Datos de demostración
El seed SHALL crear, si no existen, los usuarios de prueba `cliente@foodstore.com` (CLIENT), `pedidos@foodstore.com` (PEDIDOS) y `stock@foodstore.com` (STOCK), y el catálogo de demostración: 7 unidades de medida, 8 categorías, 24 ingredientes y 21 productos con sus relaciones. Cada categoría raíz del catálogo de demostración SHALL tener al menos un producto activo. Las imágenes de las categorías y productos de demostración SHALL ser rutas relativas a archivos servidos por la propia aplicación o quedar vacías; no SHALL apuntar a hosts externos.

El seed SHALL crear además, si no existen, 16 clientes de ejemplo con el rol `CLIENT`, cada uno con una única dirección de entrega principal activa. Las direcciones de un cliente de ejemplo, y la dirección principal de `cliente@foodstore.com`, se crean solo junto con el usuario: el seed nunca agrega direcciones a un usuario que ya existía.

#### Scenario: Demo sobre base vacía
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existen los tres usuarios de prueba con su rol, 7 unidades de medida, 8 categorías, 24 ingredientes y 21 productos

#### Scenario: Categorías raíz con productos
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** cada categoría raíz de demostración («Hamburguesas», «Bebidas», «Postres», «Pizzas», «Acompañamientos») tiene al menos un producto activo asociado

#### Scenario: Clientes de ejemplo con dirección principal
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** existen 16 clientes de ejemplo activos con exactamente el rol `CLIENT`, cada uno con una sola dirección activa marcada como principal, y `cliente@foodstore.com` tiene una dirección principal

#### Scenario: Usuario de prueba existente sin direcciones
- **WHEN** se ejecuta el seed sobre una base donde `cliente@foodstore.com` ya existe sin direcciones
- **THEN** `cliente@foodstore.com` sigue sin direcciones

#### Scenario: Imágenes de demostración sin hosts externos
- **WHEN** se ejecuta el seed sobre una base recién migrada
- **THEN** ninguna `imagen_url` de categoría ni `imagenes_url` de producto de demostración empieza con `http://` o `https://`

### Requirement: Seed idempotente
Ejecutar el seed sobre una base que ya fue sembrada SHALL terminar sin errores y SHALL dejar el contenido de todas las tablas que siembra exactamente igual al que dejó la corrida anterior, incluidas las direcciones, los pedidos, sus detalles, su historial de estados y los pagos de demostración.

#### Scenario: Dos corridas seguidas
- **WHEN** se ejecuta el seed dos veces seguidas sobre una base recién migrada
- **THEN** la segunda corrida termina sin errores y las filas de roles, estados, formas de pago, usuarios, asignaciones de roles, direcciones, unidades, categorías, ingredientes, productos y sus relaciones, pedidos, detalles de pedido, historial de estados y pagos son idénticas a las de la primera

#### Scenario: Corrida sobre base reconciliada
- **WHEN** se ejecuta el seed sobre una base con catálogos viejos y después se ejecuta otra vez
- **THEN** la segunda corrida no cambia ninguna fila
