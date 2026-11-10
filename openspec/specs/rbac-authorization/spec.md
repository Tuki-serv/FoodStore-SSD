# rbac-authorization Specification

## Purpose

Define cómo el backend autoriza a un usuario autenticado según sus roles: la unión de permisos de todos sus roles, cuál es la fuente de autoridad de esos roles, las respuestas 401/403 y la matriz de permisos por endpoint, incluida la evaluación multi-rol de las transiciones de pedido.

## Requirements

### Requirement: Autorización por la unión de todos los roles del usuario
Un endpoint protegido por roles SHALL permitir el acceso si el usuario autenticado tiene **al menos uno** de los roles permitidos, evaluando todos sus roles, sin importar cuántos tenga ni el orden en que fueron asignados. Si ninguno de sus roles está permitido SHALL responder 403. Si el pedido no trae un access válido SHALL responder 401.

#### Scenario: Un único rol permitido
- **WHEN** un usuario con solo el rol `ADMIN` llama a `GET /api/v1/estadisticas/resumen` con fechas válidas
- **THEN** la respuesta no es 401 ni 403

#### Scenario: El segundo rol habilita el acceso
- **WHEN** un usuario con los roles `CLIENT` y `STOCK`, asignados en ese orden, llama a `PATCH /api/v1/productos/{id}/stock` con `{"stock_cantidad": 5}`
- **THEN** recibe 200

#### Scenario: Ninguno de los roles está permitido
- **WHEN** un usuario con los roles `CLIENT` y `STOCK` llama a `GET /api/v1/admin/usuarios/`
- **THEN** recibe 403

#### Scenario: Sin access
- **WHEN** un pedido sin header `Authorization` llama a `GET /api/v1/admin/usuarios/`
- **THEN** recibe 401

### Requirement: Los roles guardados en la base son la autoridad
Toda decisión de autorización SHALL usar los roles que el usuario tiene en la base de datos al momento del pedido. El claim `roles` del access token SHALL ser solo informativo: ninguna decisión de autorización lo usa, y un rol agregado o quitado rige desde el pedido siguiente, sin esperar a que el access venza ni a que se renueve.

#### Scenario: Rol quitado con un access todavía vigente
- **WHEN** un usuario hace login con el rol `ADMIN`, un administrador le quita ese rol y deja solo `CLIENT`, y el usuario llama a `GET /api/v1/admin/usuarios/` con el access emitido antes del cambio
- **THEN** recibe 403

#### Scenario: Rol agregado sin renovar el access
- **WHEN** un usuario hace login solo con el rol `CLIENT`, un administrador le agrega `STOCK`, y el usuario llama a `PATCH /api/v1/productos/{id}/disponibilidad` con `{"disponible": false}` y el access emitido antes del cambio
- **THEN** recibe 200

#### Scenario: El claim no otorga permisos
- **WHEN** un access válido trae en el claim `roles` el valor `ADMIN` pero el usuario solo tiene `CLIENT` en la base, y llama a `DELETE /api/v1/categorias/{id}`
- **THEN** recibe 403 y la categoría no se elimina

### Requirement: El 403 no revela los roles del usuario
La respuesta 403 por roles insuficientes SHALL usar el formato de error unificado con `detail` «Permisos insuficientes» y `code` `HTTP_403`, y no SHALL incluir los roles del usuario ni los roles requeridos.

#### Scenario: Cuerpo del 403
- **WHEN** un usuario con solo el rol `CLIENT` llama a `POST /api/v1/categorias/`
- **THEN** recibe 403 con `detail` igual a «Permisos insuficientes» y `code` igual a `HTTP_403`, y el cuerpo no contiene las cadenas `CLIENT` ni `ADMIN`

### Requirement: STOCK solo escribe stock y disponibilidad
El rol `STOCK` SHALL poder fijar `stock_cantidad` y `disponible` de un producto y leer ingredientes. No SHALL poder crear, modificar ni eliminar productos por otro medio, ni escribir categorías, ingredientes, unidades de medida o imágenes, ni acceder a pedidos, usuarios o estadísticas (403).

#### Scenario: STOCK fija stock y disponibilidad
- **WHEN** un usuario con solo el rol `STOCK` llama a `PATCH /api/v1/productos/{id}/stock` y a `PATCH /api/v1/productos/{id}/disponibilidad` con bodies válidos
- **THEN** ambos responden 200

#### Scenario: STOCK no edita el resto del producto
- **WHEN** un usuario con solo el rol `STOCK` llama a `POST /api/v1/productos/`, `PUT /api/v1/productos/{id}`, `DELETE /api/v1/productos/{id}`, `PATCH /api/v1/productos/{id}/imagenes` o `POST /api/v1/productos/{id}/ingredientes`
- **THEN** cada uno responde 403 y el producto no cambia

#### Scenario: STOCK no escribe catálogos auxiliares
- **WHEN** un usuario con solo el rol `STOCK` llama a `POST`, `PATCH` o `DELETE` sobre `/api/v1/categorias`, `/api/v1/ingredientes` o `/api/v1/unidades-medida`
- **THEN** cada uno responde 403

#### Scenario: STOCK lee ingredientes
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/ingredientes/`
- **THEN** recibe 200

#### Scenario: STOCK sin acceso a pedidos, usuarios ni estadísticas
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/pedidos/`, `GET /api/v1/admin/usuarios/` o `GET /api/v1/estadisticas/resumen`
- **THEN** cada uno responde 403

### Requirement: Matriz de permisos de ADMIN, PEDIDOS y CLIENT
`ADMIN` SHALL acceder a todos los endpoints de administración. `PEDIDOS` SHALL acceder al listado y la gestión de pedidos, sin escritura de catálogo, usuarios ni estadísticas. `CLIENT` SHALL operar solo sus pedidos y su perfil, sin acceso a endpoints de administración. Un usuario con varios roles SHALL acceder a la unión de lo que habilita cada uno.

#### Scenario: PEDIDOS sin escritura de catálogo
- **WHEN** un usuario con solo el rol `PEDIDOS` llama a `PATCH /api/v1/productos/{id}/stock` o a `POST /api/v1/categorias/`
- **THEN** cada uno responde 403

#### Scenario: CLIENT sin endpoints de administración
- **WHEN** un usuario con solo el rol `CLIENT` llama a `GET /api/v1/pedidos/`, `GET /api/v1/admin/usuarios/` o `GET /api/v1/estadisticas/resumen`
- **THEN** cada uno responde 403

#### Scenario: ADMIN accede a la administración
- **WHEN** un usuario con solo el rol `ADMIN` llama a `PATCH /api/v1/productos/{id}/stock`, `GET /api/v1/pedidos/` y `GET /api/v1/admin/usuarios/`
- **THEN** ninguna respuesta es 401 ni 403

#### Scenario: Unión de PEDIDOS y STOCK
- **WHEN** un usuario con los roles `PEDIDOS` y `STOCK` llama a `GET /api/v1/pedidos/` y a `PATCH /api/v1/productos/{id}/stock`
- **THEN** ambos responden 200, y `POST /api/v1/categorias/` sigue respondiendo 403

### Requirement: Transiciones de pedido con todos los roles del usuario
Al cambiar el estado de un pedido, las transiciones permitidas SHALL ser la unión de las que habilita cada rol del usuario. Un rol sin transiciones definidas no aporta ninguna y no SHALL provocar un error 500. Si ningún rol habilita la transición, la respuesta SHALL ser 409. El conjunto de transiciones de cada rol no cambia en esta capacidad.

#### Scenario: STOCK y PEDIDOS avanzan un pedido
- **WHEN** un usuario con los roles `STOCK` y `PEDIDOS`, asignados en ese orden, llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `EN_PREP`

#### Scenario: CLIENT y ADMIN avanzan un pedido
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN`, asignados en ese orden, llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `EN_PREP`

#### Scenario: Rol sin transiciones definidas
- **WHEN** un usuario con solo el rol `COCINA` llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 409 (no 500) y el pedido sigue en `CONFIRMADO`

### Requirement: Cancelación del pedido propio con todos los roles del usuario
La cancelación de un pedido propio SHALL evaluar la transición a `CANCELADO` con la unión de los roles del usuario, sin errores por roles sin transiciones definidas. El endpoint sigue exigiendo el rol `CLIENT` y que el pedido sea del usuario.

#### Scenario: STOCK y CLIENT cancelan su pedido
- **WHEN** un usuario con los roles `STOCK` y `CLIENT`, asignados en ese orden, cancela con motivo su pedido `PENDIENTE` por `PATCH /api/v1/pedidos/mis-pedidos/{id}/cancelar`
- **THEN** recibe 200 y el pedido queda `CANCELADO`

#### Scenario: CLIENT no cancela un pedido en preparación
- **WHEN** un usuario con solo el rol `CLIENT` intenta cancelar su pedido en `EN_PREP`
- **THEN** recibe 409 y el pedido sigue en `EN_PREP`

#### Scenario: CLIENT y ADMIN cancelan su pedido en preparación
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN` cancela con motivo su propio pedido en `EN_PREP` por `PATCH /api/v1/pedidos/mis-pedidos/{id}/cancelar`
- **THEN** recibe 200 y el pedido queda `CANCELADO`, porque el rol `ADMIN` habilita esa transición
