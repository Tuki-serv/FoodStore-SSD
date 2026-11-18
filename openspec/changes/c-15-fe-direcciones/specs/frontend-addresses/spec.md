## Purpose

Define cómo el cliente gestiona sus propias direcciones de entrega en el frontend (US-006, RN-DI-01..03): verlas, crearlas, editarlas, marcar la principal, eliminarlas y elegir una al pedir con un selector reutilizable.

## ADDED Requirements

### Requirement: Listado de direcciones propias
La página «Direcciones» (`/direcciones`, solo con sesión) SHALL mostrar las direcciones activas del usuario en el orden del servidor (la principal primero). Cada dirección SHALL mostrar su alias (o «Sin alias»), la línea 1, la línea 2 si existe, y ciudad, provincia y código postal presentes. La principal SHALL llevar la marca visible «Principal».

#### Scenario: Cliente con dos direcciones
- **WHEN** un `CLIENT` abre `/direcciones` y el servidor devuelve «Casa» (principal) y «Trabajo»
- **THEN** ve dos direcciones, «Casa» primero con la marca «Principal» y «Trabajo» sin marca

#### Scenario: Dirección sin datos opcionales
- **WHEN** una dirección no tiene alias, línea 2, provincia ni código postal
- **THEN** se muestra «Sin alias», la línea 1 y la ciudad, sin separadores vacíos

### Requirement: Estado vacío, carga y error del listado
Mientras el listado carga SHALL verse un indicador de carga. Sin direcciones SHALL verse un estado vacío que explica para qué sirven y ofrece «Agregar dirección». Si la consulta falla SHALL verse un mensaje de error con «Reintentar», que repite la consulta. Si falla una actualización y hay datos previos, SHALL verse un aviso no bloqueante con «Reintentar» sobre el listado.

#### Scenario: Usuario sin direcciones
- **WHEN** el servidor devuelve una página vacía (`total` 0)
- **THEN** se ve «Todavía no tenés direcciones» y el botón «Agregar dirección»

#### Scenario: Falla y reintento
- **WHEN** la consulta responde 503 y el usuario pulsa «Reintentar» y la siguiente responde 200 con una dirección
- **THEN** se ve esa dirección y ya no se ve el mensaje de error

#### Scenario: Falla la actualización con datos previos
- **WHEN** el usuario elimina una dirección y el nuevo pedido del listado responde 503
- **THEN** se ve el aviso «No pudimos actualizar tus direcciones» con «Reintentar» y el listado anterior; al reintentar con 200 el aviso desaparece

### Requirement: Paginación del listado
El listado SHALL pedir páginas de 20 direcciones y SHALL mostrar controles «Anterior»/«Siguiente» solo cuando hay más de una página. Al cambiar de página el contenido anterior SHALL seguir visible hasta que llegue el nuevo.

#### Scenario: Una sola página
- **WHEN** el servidor responde `pages` 1
- **THEN** no hay controles de paginación

#### Scenario: Segunda página
- **WHEN** el servidor responde `pages` 2 y el usuario pulsa «Siguiente»
- **THEN** se pide `page=2&size=20` y se ven las direcciones de esa página

### Requirement: Alta de dirección
«Agregar dirección» SHALL abrir el formulario vacío. Al guardar datos válidos SHALL enviarse la dirección al servidor; al confirmarse, el formulario SHALL cerrarse, el listado SHALL actualizarse y SHALL verse la notificación «Dirección guardada».

#### Scenario: Primera dirección
- **WHEN** un usuario sin direcciones crea «Casa» y el servidor la devuelve con `es_principal` verdadero
- **THEN** el listado muestra «Casa» con la marca «Principal»

#### Scenario: Segunda dirección
- **WHEN** un usuario con «Casa» principal crea «Trabajo»
- **THEN** «Casa» sigue principal y «Trabajo» aparece sin marca

### Requirement: Validación del formulario de dirección
Línea 1 y ciudad SHALL ser obligatorias (texto no vacío tras quitar espacios). Alias SHALL tener como máximo 50 caracteres, ciudad y provincia 100 y código postal 10. Los errores SHALL mostrarse junto a su campo después de tocarlo o al intentar guardar, y con errores no SHALL enviarse nada al servidor.

#### Scenario: Obligatorios vacíos
- **WHEN** el usuario pulsa «Guardar dirección» con línea 1 «   » y ciudad vacía
- **THEN** ve «Ingresá la calle y el número» y «Ingresá la ciudad» y no se envía ningún pedido

#### Scenario: Código postal largo
- **WHEN** el usuario escribe un código postal de 11 caracteres y sale del campo
- **THEN** ve «Máximo 10 caracteres» junto al código postal

### Requirement: Normalización de los datos enviados
Antes de enviar, los textos SHALL recortarse y los campos opcionales vacíos SHALL enviarse como `null`. Los campos obligatorios nunca SHALL enviarse como `null`.

#### Scenario: Opcionales vacíos
- **WHEN** el usuario guarda alias « Casa », línea 1 «Av. Siempre Viva 742», ciudad «Mendoza» y el resto vacío
- **THEN** el cuerpo enviado tiene `alias` «Casa», `linea2`, `provincia` y `codigo_postal` en `null`

### Requirement: Errores del servidor en el formulario
Si el servidor rechaza el guardado con un error de validación que nombra un campo, el mensaje SHALL mostrarse junto a ese campo y el formulario SHALL seguir abierto con lo escrito. Cualquier otro error SHALL mostrarse como mensaje general del formulario.

#### Scenario: Validación del servidor
- **WHEN** el servidor responde 422 `VALIDATION_ERROR` con `field` `codigo_postal`
- **THEN** el mensaje aparece junto al código postal y los datos escritos se conservan

#### Scenario: Servidor caído
- **WHEN** guardar no obtiene respuesta del servidor
- **THEN** se ve «No pudimos conectar con el servidor.» y el formulario sigue abierto

### Requirement: Edición de dirección
«Editar» en una dirección SHALL abrir el formulario con sus datos. Al guardar SHALL enviarse la dirección completa al servidor; al confirmarse, el listado SHALL mostrar los datos nuevos. Cancelar SHALL volver al listado sin enviar nada.

#### Scenario: Cambiar ciudad
- **WHEN** el usuario edita «Trabajo», cambia la ciudad a «Godoy Cruz» y guarda
- **THEN** «Trabajo» muestra «Godoy Cruz» en el listado

#### Scenario: Cancelar edición
- **WHEN** el usuario cambia la ciudad y pulsa «Cancelar»
- **THEN** no se envía ningún pedido y el listado muestra la ciudad original

### Requirement: Marcar dirección principal
Cada dirección que no es principal SHALL ofrecer «Marcar como principal». Al confirmarse en el servidor, esa dirección SHALL ser la única con la marca «Principal» y SHALL listarse primero. Mientras se procesa, la acción SHALL quedar deshabilitada.

#### Scenario: Cambio de principal
- **WHEN** «Casa» es principal y el usuario marca «Trabajo»
- **THEN** «Trabajo» aparece primero con la marca y «Casa» queda sin marca

#### Scenario: La principal no ofrece la acción
- **WHEN** se muestra la dirección principal
- **THEN** no tiene el botón «Marcar como principal»

### Requirement: Eliminación con confirmación
«Eliminar» SHALL pedir confirmación nombrando la dirección. Confirmar SHALL eliminarla en el servidor, sacarla del listado y mostrar «Dirección eliminada»; cancelar no SHALL enviar nada. Si es la principal y hay otras, el aviso SHALL decir que ninguna quedará como principal. Tras eliminar, el foco SHALL pasar al título de la página. Cada eliminación SHALL avisar su propio resultado aunque haya otra en curso.

#### Scenario: Eliminar con confirmación
- **WHEN** el usuario pulsa «Eliminar» en «Trabajo» y confirma
- **THEN** se envía un solo `DELETE` y «Trabajo» ya no está en el listado

#### Scenario: Cancelar eliminación
- **WHEN** el usuario pulsa «Eliminar» y luego «Cancelar»
- **THEN** no se envía ningún `DELETE` y la dirección sigue en el listado

#### Scenario: Eliminar la principal con otras
- **WHEN** el usuario pulsa «Eliminar» en «Casa», principal, y existe «Trabajo»
- **THEN** el diálogo avisa que ninguna dirección quedará como principal

#### Scenario: Foco tras eliminar
- **WHEN** el usuario confirma la eliminación y la dirección desaparece del listado
- **THEN** el foco queda en el título «Direcciones»

#### Scenario: Eliminaciones superpuestas
- **WHEN** el usuario confirma eliminar «Trabajo» y, con ese pedido en curso, eliminar «Abuela»
- **THEN** se ve un aviso de éxito por cada una; si la primera falla, un aviso de error y uno de éxito

### Requirement: Direcciones sin principal
Si el usuario tiene direcciones y ninguna es principal, la página SHALL mostrar un aviso que invita a marcar una.

#### Scenario: Principal eliminada
- **WHEN** el servidor devuelve «Trabajo» y «Oficina», ninguna principal
- **THEN** se ve el aviso «Ninguna dirección es principal» y ambas ofrecen «Marcar como principal»

### Requirement: Dirección que ya no existe
Si editar, marcar principal o eliminar responde 403 o 404, SHALL mostrarse la notificación de error «Esa dirección ya no está disponible» y el listado SHALL volver a pedirse.

#### Scenario: Eliminada en otra pestaña
- **WHEN** el usuario marca como principal una dirección y el servidor responde 404
- **THEN** ve la notificación de error y el listado se vuelve a pedir

### Requirement: Datos privados de la sesión
Las direcciones SHALL tratarse como datos privados: al cerrarse o vencer la sesión SHALL descartarse de la caché, y otro usuario que inicie sesión no SHALL verlas.

#### Scenario: Cambio de usuario
- **WHEN** Ana ve sus direcciones, cierra sesión y Luis inicia sesión y abre `/direcciones`
- **THEN** se piden de nuevo al servidor y no se muestra ninguna dirección de Ana

### Requirement: Selector de dirección para el pedido
El selector SHALL ofrecer como opciones únicas y excluyentes las direcciones activas del usuario y, si se habilita, «Retiro en el local» (sin dirección). Si nada está elegido, SHALL preseleccionar la principal; sin principal, la primera; sin direcciones, retiro si está habilitado.

#### Scenario: Preselección de la principal
- **WHEN** el selector se muestra sin elección previa y «Trabajo» es la principal
- **THEN** «Trabajo» queda elegida

#### Scenario: Sin principal
- **WHEN** el usuario tiene «Trabajo» y «Oficina», ninguna principal, y no hay elección previa
- **THEN** queda elegida «Trabajo», la primera

#### Scenario: Elegir retiro
- **WHEN** el usuario elige «Retiro en el local»
- **THEN** el selector informa que no hay dirección elegida (`null`)

### Requirement: Selector sin direcciones
Si el usuario no tiene direcciones, el selector SHALL decirlo y SHALL ofrecer un enlace a «Direcciones» para agregar una, manteniendo la opción de retiro si está habilitada.

#### Scenario: Selector vacío
- **WHEN** el selector se muestra y el servidor devuelve una página vacía
- **THEN** se ve «No tenés direcciones guardadas» y un enlace a `/direcciones`

### Requirement: Accesibilidad de direcciones
La página, el formulario, el diálogo y el selector SHALL usarse solo con teclado, con nombres accesibles en cada control (las acciones nombran su dirección) y sin violaciones automáticas de accesibilidad. El selector SHALL ser un grupo de opciones con leyenda.

#### Scenario: Acciones con nombre propio
- **WHEN** se listan «Casa» y «Trabajo»
- **THEN** existen los botones «Editar Trabajo» y «Eliminar Trabajo» como nombres accesibles

#### Scenario: Revisión automática
- **WHEN** se analiza la página con el listado y con el formulario con errores
- **THEN** no se reportan violaciones de accesibilidad
