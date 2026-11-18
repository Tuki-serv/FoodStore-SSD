# frontend-feedback Specification

## Purpose
Define cómo la aplicación muestra al usuario las notificaciones (toasts) y el diálogo de confirmación que guarda el estado de interfaz, para que cualquier pantalla informe resultados y pida confirmar acciones destructivas de la misma forma.

## Requirements

### Requirement: Notificaciones visibles
Cada notificación de la cola SHALL verse dentro del shell con su título, su mensaje si lo tiene y un estilo según su tipo. Las de tipo `error` SHALL anunciarse como alerta y las demás como estado, para lectores de pantalla.

#### Scenario: Notificación de éxito
- **WHEN** una pantalla encola una notificación `success` con título «Dirección guardada»
- **THEN** se ve «Dirección guardada» en un elemento con rol `status`

#### Scenario: Notificación de error
- **WHEN** se encola una notificación `error` con título «Esa dirección ya no está disponible»
- **THEN** el texto se ve en un elemento con rol `alert`

### Requirement: Descarte de notificaciones
Cada notificación SHALL poder cerrarse con un botón «Cerrar notificación» y SHALL descartarse sola a los 5 segundos. Cerrar una no SHALL afectar a las demás.

#### Scenario: Cierre manual
- **WHEN** hay dos notificaciones y el usuario cierra la primera
- **THEN** sigue visible solo la segunda

#### Scenario: Cierre automático
- **WHEN** pasan 5 segundos desde que apareció una notificación
- **THEN** deja de verse

### Requirement: Diálogo de confirmación
Si hay una confirmación pendiente SHALL verse un diálogo modal con su título, su mensaje y dos botones (por defecto «Confirmar» y «Cancelar», o los textos que indique). Al abrirse, el foco SHALL ir a «Cancelar» y SHALL quedar dentro del diálogo.

#### Scenario: Apertura
- **WHEN** una pantalla pide confirmar con título «¿Eliminar Trabajo?» y texto «Eliminar»
- **THEN** se ve un diálogo con ese título, el botón «Eliminar» y el foco en «Cancelar»

### Requirement: Respuesta del diálogo
Confirmar SHALL ejecutar la acción pedida una sola vez y cerrar el diálogo. Cancelar, la tecla Escape o pulsar fuera del diálogo SHALL cerrarlo sin ejecutarla. Al cerrarse, el foco SHALL volver al control que lo abrió. Al terminar la sesión (cierre o vencimiento) SHALL descartarse sin ejecutar su acción, junto con las notificaciones pendientes.

#### Scenario: Confirmar
- **WHEN** el usuario pulsa «Eliminar» en el diálogo
- **THEN** la acción se ejecuta una vez y el diálogo se cierra

#### Scenario: Escape
- **WHEN** el usuario pulsa Escape con el diálogo abierto
- **THEN** el diálogo se cierra, la acción no se ejecuta y el foco vuelve al botón que lo abrió

#### Scenario: Fin de sesión con el diálogo abierto
- **WHEN** la sesión se cierra o vence con el diálogo abierto
- **THEN** el diálogo desaparece, la acción no se ejecuta y las notificaciones pendientes se vacían
