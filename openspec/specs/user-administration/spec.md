# user-administration Specification

## Purpose
Define la administración de usuarios por un `ADMIN` en la API (US-027, RN-US-01..03): alta con varios roles, listado paginado con filtro por rol, edición de datos y roles, desactivación con cierre de sesiones y las protecciones que impiden dejar el sistema sin administrador.

## Requirements

### Requirement: Administración de usuarios solo para ADMIN
Los endpoints `POST /api/v1/admin/usuarios/createUser`, `GET /api/v1/admin/usuarios/`, `PATCH /api/v1/admin/usuarios/{id}` y `DELETE /api/v1/admin/usuarios/{id}` SHALL estar disponibles solo para usuarios con el rol `ADMIN` entre sus roles leídos de la base; cualquier otro usuario autenticado SHALL recibir 403 y un pedido sin autenticación 401.

#### Scenario: STOCK no administra usuarios
- **WHEN** un usuario con los roles `CLIENT` y `STOCK` llama a `PATCH /api/v1/admin/usuarios/{id}`
- **THEN** recibe 403 y el usuario indicado no cambia

#### Scenario: ADMIN con otros roles
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN` llama a `GET /api/v1/admin/usuarios/`
- **THEN** recibe 200 con la página de usuarios

### Requirement: Alta de usuario con varios roles
`POST /api/v1/admin/usuarios/createUser` con datos válidos y una lista `roles_codigos` SHALL crear un usuario activo con exactamente esos roles y SHALL responder 201 con `id`, `nombre`, `apellido`, `email`, `celular` y `roles` (`codigo` y `nombre` de cada uno), sin la contraseña ni su hash. Cada rol asignado SHALL registrar como asignador al `ADMIN` que hizo el alta.

#### Scenario: Alta de un gestor con dos roles
- **WHEN** un `ADMIN` crea a «Carla Gómez» con `roles_codigos` `["PEDIDOS", "STOCK"]`
- **THEN** recibe 201 con `roles` de códigos `PEDIDOS` y `STOCK`, y Carla puede iniciar sesión con la contraseña indicada

#### Scenario: Asignador registrado
- **WHEN** el `ADMIN` con id 1 crea un usuario con el rol `STOCK`
- **THEN** la asignación del rol `STOCK` de ese usuario registra al usuario 1 como asignador

### Requirement: Lista de roles válida
Al crear o editar un usuario, `roles_codigos` SHALL contener al menos un código; una lista vacía SHALL responder 422 `VALIDATION_ERROR` con `field` `roles_codigos` sin cambiar nada. Un código que no es uno de los roles existentes SHALL responder 400 sin cambiar nada. Los códigos repetidos SHALL tratarse como uno solo.

#### Scenario: Sin roles
- **WHEN** un `ADMIN` crea un usuario con `roles_codigos` `[]`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `roles_codigos`, y el usuario no se crea

#### Scenario: Rol inexistente
- **WHEN** un `ADMIN` edita a un usuario con `roles_codigos` `["CLIENT", "COCINA"]`
- **THEN** recibe 400 y los roles del usuario no cambian

#### Scenario: Código repetido
- **WHEN** un `ADMIN` crea un usuario con `roles_codigos` `["STOCK", "STOCK"]`
- **THEN** recibe 201 y el usuario tiene un único rol `STOCK`

### Requirement: Listado paginado de usuarios activos
`GET /api/v1/admin/usuarios/` SHALL devolver solo los usuarios activos con la respuesta paginada de la API (`items`, `total`, `page`, `size`, `pages`), cada uno con sus roles, ordenados por fecha de alta ascendente y, a igual fecha, por `id`. Los usuarios desactivados no SHALL aparecer ni contar en `total`.

#### Scenario: Usuario desactivado fuera del listado
- **WHEN** hay 3 usuarios activos y 1 desactivado y un `ADMIN` pide la primera página
- **THEN** recibe `total` 3 y ningún ítem es el usuario desactivado

#### Scenario: Página siguiente
- **WHEN** hay 25 usuarios activos y un `ADMIN` pide `page=2&size=20`
- **THEN** recibe 5 ítems, `total` 25 y `pages` 2

### Requirement: Filtro del listado por rol
El parámetro opcional `rol_codigo` de `GET /api/v1/admin/usuarios/` SHALL limitar el listado a los usuarios activos que tienen ese rol entre los suyos, mostrando cada uno con todos sus roles y sin repetirlo. Un `rol_codigo` que no es un rol existente SHALL responder 400.

#### Scenario: Usuario con varios roles en el filtro
- **WHEN** «Carla» tiene los roles `PEDIDOS` y `STOCK` y un `ADMIN` filtra por `rol_codigo=STOCK`
- **THEN** Carla aparece una sola vez y con los dos roles

#### Scenario: Rol desconocido
- **WHEN** un `ADMIN` llama a `GET /api/v1/admin/usuarios/?rol_codigo=COCINA`
- **THEN** recibe 400

### Requirement: Edición de datos y roles
`PATCH /api/v1/admin/usuarios/{id}` SHALL actualizar solo los campos enviados entre `nombre`, `apellido`, `celular` y `roles_codigos`; `roles_codigos` SHALL reemplazar la lista completa de roles del usuario y cada rol nuevo SHALL registrar al `ADMIN` que lo asignó. SHALL responder 200 con el usuario y sus roles; un usuario inexistente o desactivado SHALL responder 404. El cambio de roles SHALL regir desde el pedido siguiente del usuario afectado.

#### Scenario: Reemplazo de roles
- **WHEN** un `ADMIN` envía `{"roles_codigos": ["CLIENT"]}` para un usuario con `CLIENT` y `STOCK`
- **THEN** recibe 200 con solo el rol `CLIENT`, y el siguiente pedido de ese usuario a `PATCH /api/v1/productos/{id}/stock` recibe 403

#### Scenario: Solo datos personales
- **WHEN** un `ADMIN` envía `{"celular": "1155550000"}` para un usuario con roles `PEDIDOS`
- **THEN** recibe 200 con el celular nuevo y los roles sin cambios

#### Scenario: Usuario desactivado
- **WHEN** un `ADMIN` edita a un usuario desactivado
- **THEN** recibe 404

### Requirement: Desactivación con cierre de sesiones
`DELETE /api/v1/admin/usuarios/{id}` SHALL marcar al usuario como desactivado (soft delete), SHALL cerrar todas sus sesiones abiertas con motivo `BAJA` y SHALL responder 204. Desde ese momento el usuario no SHALL poder iniciar sesión, renovar el access ni operar, y su email SHALL quedar libre para una cuenta nueva. Un usuario inexistente o ya desactivado SHALL responder 404.

#### Scenario: Sesiones cerradas en la baja
- **WHEN** un usuario con dos sesiones abiertas es desactivado por un `ADMIN`
- **THEN** recibe 204 y las dos sesiones quedan cerradas con motivo `BAJA`, y renovar con cualquiera de sus refresh responde 401

#### Scenario: Email reutilizable
- **WHEN** un `ADMIN` desactiva a `ana@example.com` y luego crea otro usuario con ese email
- **THEN** el alta responde 201

#### Scenario: Doble desactivación
- **WHEN** un `ADMIN` desactiva dos veces al mismo usuario
- **THEN** la segunda respuesta es 404

### Requirement: Protección de la propia cuenta del administrador
Un `ADMIN` no SHALL poder desactivarse a sí mismo ni quitarse su propio rol `ADMIN`; esos pedidos SHALL responder 409 con `code` `SELF_ACTION_NOT_ALLOWED` sin cambiar nada. Sí SHALL poder editar sus datos personales y agregarse o quitarse otros roles.

#### Scenario: Autodesactivación
- **WHEN** un `ADMIN` llama a `DELETE /api/v1/admin/usuarios/{su propio id}`
- **THEN** recibe 409 con `code` `SELF_ACTION_NOT_ALLOWED` y sigue activo

#### Scenario: Quitarse el rol ADMIN
- **WHEN** un `ADMIN` con roles `ADMIN` y `CLIENT` envía para sí mismo `{"roles_codigos": ["CLIENT"]}`
- **THEN** recibe 409 con `code` `SELF_ACTION_NOT_ALLOWED` y conserva el rol `ADMIN`

#### Scenario: Agregarse un rol
- **WHEN** un `ADMIN` envía para sí mismo `{"roles_codigos": ["ADMIN", "STOCK"]}`
- **THEN** recibe 200 con los roles `ADMIN` y `STOCK`

### Requirement: Siempre queda al menos un ADMIN activo
Ninguna edición ni desactivación SHALL dejar al sistema sin usuarios activos con el rol `ADMIN`; un pedido que lo haría SHALL responder 409 con `code` `LAST_ADMIN` sin cambiar nada, también cuando dos pedidos simultáneos lo harían entre los dos.

#### Scenario: Dos administradores simultáneos
- **WHEN** solo hay dos `ADMIN` activos, A y B, y al mismo tiempo A quita el rol `ADMIN` a B y B quita el rol `ADMIN` a A
- **THEN** uno de los pedidos responde 200, el otro responde 409 con `code` `LAST_ADMIN` (o 403 si su autor ya perdió el rol `ADMIN` cuando se lo atiende), y queda exactamente un `ADMIN` activo

#### Scenario: Quedan otros administradores
- **WHEN** hay tres `ADMIN` activos y uno desactiva a otro
- **THEN** recibe 204 y quedan dos `ADMIN` activos
