# frontend-admin-users Specification

## Purpose
Define la pantalla «Usuarios» del frontend con la que un `ADMIN` administra las cuentas (US-027): listado con filtro por rol, alta con varios roles, edición de datos y roles, desactivación y el manejo de los errores del backend.

## Requirements

### Requirement: Acceso a Usuarios solo para ADMIN
La página «Usuarios» (`/admin/usuarios`) SHALL estar disponible solo para usuarios con el rol `ADMIN` entre sus roles. Un usuario con sesión sin ese rol SHALL ver la página de acceso denegado sin que se pida el listado de usuarios; un visitante sin sesión SHALL ir a `/ingresar` con la ruta recordada.

#### Scenario: ADMIN abre Usuarios
- **WHEN** un usuario con roles `CLIENT` y `ADMIN` abre `/admin/usuarios`
- **THEN** ve el título «Usuarios», el botón «Nuevo usuario» y no el aviso de sección en preparación

#### Scenario: PEDIDOS sin acceso
- **WHEN** un usuario con roles `CLIENT` y `PEDIDOS` abre `/admin/usuarios`
- **THEN** ve la página de acceso denegado y no se pide `GET /admin/usuarios/`

### Requirement: Listado de usuarios
La página SHALL listar los usuarios activos en páginas de 20, en el orden del servidor, con nombre y apellido, email, celular (o «—») y sus roles como etiquetas con el nombre visible de cada rol. La fila del propio administrador SHALL llevar la marca «Vos». SHALL mostrar un esqueleto mientras carga, un estado vacío y un error con «Reintentar».

#### Scenario: Usuario con varios roles
- **WHEN** el servidor devuelve a «Carla Gómez» con roles `PEDIDOS` y `STOCK`
- **THEN** su fila muestra las etiquetas «Gestor de pedidos» y «Gestor de stock»

#### Scenario: Fila propia
- **WHEN** el `ADMIN` con id 1 ve el listado y él es el primer ítem
- **THEN** su fila muestra la marca «Vos»

#### Scenario: Error del servidor
- **WHEN** `GET /admin/usuarios/` responde 500
- **THEN** se ve un mensaje de error con «Reintentar», que vuelve a pedir el listado

### Requirement: Filtro por rol y paginación en la URL
La página SHALL ofrecer un filtro de rol con «Todos» y los cuatro roles (`ADMIN`, `STOCK`, `PEDIDOS`, `CLIENT`) por su nombre visible, guardado en la URL junto con la página; cambiar el filtro SHALL volver a la página 1. Un rol desconocido en la URL SHALL tratarse como «Todos».

#### Scenario: Filtrar gestores de stock
- **WHEN** el `ADMIN` elige «Gestor de stock»
- **THEN** se pide `GET /admin/usuarios/?rol_codigo=STOCK&page=1&size=20` y la URL guarda `rol=STOCK`

#### Scenario: Filtro sin resultados
- **WHEN** el filtro «Gestor de pedidos» no devuelve usuarios
- **THEN** se ve «No hay usuarios con ese rol» con «Ver todos»

#### Scenario: Rol desconocido en la URL
- **WHEN** el `ADMIN` abre `/admin/usuarios?rol=COCINA`
- **THEN** el filtro muestra «Todos» y el pedido no incluye `rol_codigo`

### Requirement: Alta de usuario
«Nuevo usuario» SHALL abrir un formulario con nombre y apellido (obligatorios, recortados, hasta 80), email (formato válido), celular opcional (hasta 20), contraseña inicial (mínimo 8) y los cuatro roles como casillas, con al menos uno elegido. Con datos inválidos no SHALL enviar nada. Al crear con éxito SHALL avisar «Usuario creado» y mostrarlo en el listado sin recargar.

#### Scenario: Crear un gestor con dos roles
- **WHEN** el `ADMIN` completa a «Carla Gómez», `carla@example.com`, una contraseña de 10 caracteres, marca «Gestor de pedidos» y «Gestor de stock» y guarda
- **THEN** se envía `POST /admin/usuarios/createUser` con `roles_codigos` `["PEDIDOS", "STOCK"]` y se ve «Usuario creado»

#### Scenario: Sin roles elegidos
- **WHEN** el `ADMIN` desmarca todos los roles y guarda
- **THEN** no se envía nada y se ve «Elegí al menos un rol.»

#### Scenario: Contraseña corta
- **WHEN** el `ADMIN` escribe una contraseña de 6 caracteres y guarda
- **THEN** no se envía nada y la contraseña muestra que necesita al menos 8 caracteres

### Requirement: Errores del alta y la edición
El formulario SHALL mostrar en el campo correspondiente el 409 de email ya registrado («Ya existe un usuario con ese email.») y los 422 con `field`; un 400 de rol inválido y cualquier otro error SHALL mostrarse como alerta general del formulario conservando lo escrito.

#### Scenario: Email repetido
- **WHEN** el alta responde 409 por email ya registrado
- **THEN** «Email» muestra «Ya existe un usuario con ese email.» y el formulario conserva los datos

#### Scenario: Error de conexión
- **WHEN** el alta falla sin respuesta del servidor
- **THEN** el formulario muestra una alerta de conexión y conserva los datos

### Requirement: Edición de datos y roles
«Editar» SHALL abrir el formulario con los datos y roles actuales del usuario, sin email ni contraseña editables, y SHALL enviar `PATCH /admin/usuarios/{id}` solo con los campos cambiados (los roles, como la lista completa elegida). Al guardar con éxito SHALL avisar «Usuario actualizado» y reflejar el cambio sin recargar; si el usuario editado es el propio administrador, SHALL refrescar la sesión para que el panel lateral refleje sus roles.

#### Scenario: Cambiar roles
- **WHEN** el `ADMIN` edita a «Carla», desmarca «Gestor de stock» y guarda
- **THEN** se envía `PATCH /admin/usuarios/<id>` solo con `roles_codigos` `["PEDIDOS"]` y su fila muestra solo «Gestor de pedidos»

#### Scenario: Agregarse un rol a sí mismo
- **WHEN** el `ADMIN` se edita a sí mismo, marca «Gestor de stock» y guarda
- **THEN** se vuelve a pedir `GET /auth/me` y el panel lateral sigue mostrando el grupo «Administración» completo

### Requirement: Protección de la propia cuenta en la UI
En la fila y el formulario del propio administrador, la casilla del rol «Administrador» SHALL estar deshabilitada con la explicación «No podés quitarte tu propio rol de administrador» y la acción «Desactivar» no SHALL ofrecerse. Si el servidor responde 409 `SELF_ACTION_NOT_ALLOWED` o `LAST_ADMIN`, SHALL mostrarse su explicación sin cambiar el listado.

#### Scenario: Fila propia sin desactivar
- **WHEN** el `ADMIN` ve su propia fila
- **THEN** no hay botón «Desactivar» en ella y sí «Editar»

#### Scenario: Último administrador
- **WHEN** una edición responde 409 `LAST_ADMIN`
- **THEN** el formulario muestra «Tiene que quedar al menos un administrador activo.» y conserva lo elegido

### Requirement: Desactivación de usuario
«Desactivar» SHALL abrir un diálogo de confirmación con el nombre y email del usuario que avise que cerrará sus sesiones y que no podrá ingresar. Al confirmar y responder el servidor 204, SHALL cerrar el diálogo, avisar «Usuario desactivado» y quitarlo del listado; ante un error SHALL mostrarlo dentro del diálogo; un 404 SHALL avisar que el usuario ya no estaba activo y refrescar el listado.

#### Scenario: Desactivación exitosa
- **WHEN** el `ADMIN` pulsa «Desactivar Carla Gómez», confirma y el servidor responde 204
- **THEN** se ve «Usuario desactivado» y la fila de Carla deja de mostrarse

#### Scenario: Ya desactivado
- **WHEN** la desactivación responde 404
- **THEN** el diálogo avisa que el usuario ya no estaba activo y el listado se vuelve a pedir

### Requirement: Accesibilidad de Usuarios
El listado, el formulario y el diálogo SHALL no tener violaciones de accesibilidad detectables automáticamente. Las casillas de roles SHALL agruparse con una leyenda «Roles»; los diálogos SHALL atrapar el foco, cerrarse con Escape (salvo mientras se envía) y devolver el foco al botón que los abrió; los errores SHALL anunciarse con `role="alert"`. Las acciones de cada fila SHALL nombrar al usuario.

#### Scenario: Foco al cerrar
- **WHEN** el `ADMIN` abre «Desactivar Carla Gómez» y lo cierra con Escape
- **THEN** el foco vuelve al botón «Desactivar Carla Gómez»

#### Scenario: Sin violaciones
- **WHEN** se analizan con axe el listado con datos, el formulario de alta con errores y el diálogo de desactivación
- **THEN** no hay violaciones
