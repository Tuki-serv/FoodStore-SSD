# frontend-client-stores Specification

## Purpose
Define el estado de cliente del frontend que no viene del servidor: el carrito, el estado del pago en curso y el estado de la interfaz, con qué se guarda entre recargas y qué se descarta. Los datos del servidor no se guardan acá: viven en la caché de consultas.

## Requirements

### Requirement: Carrito persistente
El carrito SHALL guardar sus líneas en el almacenamiento local del navegador y recuperarlas al recargar, al cerrar y reabrir el navegador y tras cerrar e iniciar sesión (US-015, CE-14). Si el almacenamiento falla o tiene datos inválidos, el carrito SHALL arrancar vacío sin romper la aplicación.

#### Scenario: Recarga con carrito
- **WHEN** el carrito tiene una línea de 2 unidades del producto 7 y la página se recarga
- **THEN** el carrito tiene la misma línea con 2 unidades

#### Scenario: Datos guardados corruptos
- **WHEN** la entrada guardada del carrito no es JSON válido
- **THEN** el carrito arranca vacío y la aplicación funciona

### Requirement: Líneas del carrito por producto y personalización
Cada línea SHALL identificarse por producto y conjunto de ingredientes excluidos (sin importar su orden). Agregar un producto con la misma personalización que una línea existente SHALL sumar cantidades; con otra personalización SHALL crear una línea nueva.

#### Scenario: Mismo producto y personalización
- **WHEN** se agrega 1 unidad del producto 7 sin ingredientes `[3, 1]` y luego 2 unidades del producto 7 sin `[1, 3]`
- **THEN** el carrito tiene una sola línea del producto 7 con 3 unidades

#### Scenario: Otra personalización
- **WHEN** se agrega el producto 7 sin `[1]` y luego el producto 7 sin ingredientes excluidos
- **THEN** el carrito tiene dos líneas del producto 7

### Requirement: Cantidades del carrito
La cantidad de una línea SHALL ser un entero mayor o igual a 1. Fijar una cantidad de 0 o menos SHALL quitar la línea; una cantidad no entera SHALL rechazarse sin cambiar el carrito.

#### Scenario: Cantidad cero
- **WHEN** se fija en 0 la cantidad de la única línea
- **THEN** el carrito queda vacío

#### Scenario: Cantidad no entera
- **WHEN** se fija en 1.5 la cantidad de una línea de 2 unidades
- **THEN** la línea sigue con 2 unidades

### Requirement: Totales del carrito
El carrito SHALL exponer la cantidad total de unidades y el importe total, calculado desde el precio unitario decimal de cada línea sin errores de redondeo binario y expresado con dos decimales.

#### Scenario: Totales exactos
- **WHEN** el carrito tiene 3 unidades a «0.10» y 1 unidad a «1250.50»
- **THEN** la cantidad total es 4 y el importe total es «1250.80»

### Requirement: Estado del pago no persistente
El estado del pago en curso (pedido, estado del intento, identificador de pago de MercadoPago y error) SHALL vivir solo en memoria: al recargar la página SHALL volver al estado inicial sin intento en curso. El identificador de pago de MercadoPago SHALL guardarse como texto tal como lo devuelve el backend (p. ej. `PAY01…`) y el resultado registrado SHALL admitir `aprobado`, `rechazado`, `pendiente` y `a_devolver`. El store nunca SHALL guardar datos de tarjeta.

#### Scenario: Recarga durante un pago
- **WHEN** hay un intento de pago en curso para el pedido 12 y la página se recarga
- **THEN** el estado del pago no tiene pedido ni intento en curso

#### Scenario: Identificador de pago como texto
- **WHEN** se registra el resultado `aprobado` con identificador `"PAY01JX7"` y detalle `"accredited"`
- **THEN** el estado del pago es `aprobado`, el identificador es `"PAY01JX7"` y el detalle `"accredited"`

#### Scenario: Pago aprobado sin pedido que lo respalde
- **WHEN** se registra el resultado `a_devolver`
- **THEN** el estado del pago es `a_devolver`

### Requirement: Estado de interfaz no persistente
El estado de la interfaz SHALL incluir, además del panel lateral, si el carrito está abierto, la cola de notificaciones y el diálogo de confirmación abierto. De todo eso solo la preferencia de panel colapsado SHALL persistir entre recargas.

#### Scenario: Recarga con carrito abierto y notificación
- **WHEN** el carrito está abierto, hay una notificación en cola y la página se recarga
- **THEN** el carrito está cerrado, no hay notificaciones y la preferencia de panel colapsado se conserva

### Requirement: Notificaciones con identidad propia
Cada notificación de la cola SHALL tener un identificador único, un tipo (`success`, `error`, `warning` o `info`) y un título; descartar una por su identificador no SHALL afectar a las demás.

#### Scenario: Descartar una notificación
- **WHEN** hay dos notificaciones en cola y se descarta la primera
- **THEN** queda solo la segunda, con su mismo identificador

### Requirement: Estado de cliente reiniciable
Cada store de cliente SHALL poder volver a su estado inicial con una operación propia, y ninguno SHALL guardar datos del servidor que ya cachea la capa de consultas (listados, detalle de pedidos, perfil).

#### Scenario: Reinicio del carrito en tests
- **WHEN** el carrito tiene líneas y se lo reinicia
- **THEN** queda vacío y su copia persistida también

### Requirement: Nombres de los ingredientes excluidos en la línea
Al agregar con personalización, la línea SHALL guardar, además de los ids excluidos, el nombre de cada ingrediente excluido tal como estaba al agregar, en el mismo orden que los ids. Sumar unidades a una línea existente no SHALL cambiar sus nombres guardados.

#### Scenario: Agregar con exclusiones
- **WHEN** se agrega el producto 7 excluyendo «Tomate» (id 3) y «Cebolla» (id 1)
- **THEN** la línea tiene los ids `[1, 3]` y los nombres «Cebolla» y «Tomate», en ese orden

#### Scenario: Sumar a una línea existente
- **WHEN** la línea del producto 7 sin `[1]` guarda el nombre «Cebolla» y se vuelve a agregar el producto 7 sin `[1]` con el nombre «Cebolla morada»
- **THEN** la línea suma la cantidad y sigue guardando «Cebolla»

### Requirement: Migración del carrito guardado
El carrito guardado con el formato anterior (sin nombres de exclusiones) SHALL recuperarse con todas sus líneas, cantidades y personalizaciones, y con la lista de nombres vacía. Un carrito guardado con un formato desconocido o inválido SHALL arrancar vacío.

#### Scenario: Carrito del formato anterior
- **WHEN** el almacenamiento tiene un carrito del formato anterior con 2 unidades del producto 7 sin `[1]` y la página se recarga
- **THEN** el carrito tiene la línea del producto 7 sin `[1]` con 2 unidades y sin nombres de exclusiones

#### Scenario: Nombres que no coinciden con los ids
- **WHEN** una línea guardada tiene 2 ids excluidos y 3 nombres
- **THEN** el carrito arranca vacío

### Requirement: Subtotal de una línea
El carrito SHALL exponer el subtotal de cada línea (precio unitario por cantidad) calculado sin errores de redondeo binario y expresado con dos decimales.

#### Scenario: Subtotal exacto
- **WHEN** una línea tiene 3 unidades a «0.10»
- **THEN** su subtotal es «0.30»
