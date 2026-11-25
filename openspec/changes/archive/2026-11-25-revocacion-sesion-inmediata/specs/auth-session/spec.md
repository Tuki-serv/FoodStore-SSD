# Spec Delta — auth-session

## MODIFIED Requirements

### Requirement: El access token viaja por Authorization Bearer
Las rutas protegidas SHALL autenticar solo con el header `Authorization: Bearer <access_token>`. Una cookie `access_token` no SHALL autenticar. Un token ausente, mal firmado, vencido, de otro `type` o sin `sid` SHALL producir 401. Validar el access SHALL requerir además que la sesión del `sid` exista, pertenezca al usuario del `sub`, no esté cerrada y no haya vencido; si no, SHALL responder 401 con el mismo cuerpo y el mismo header `WWW-Authenticate: Bearer` que un access inválido.

#### Scenario: Bearer válido
- **WHEN** un usuario llama a `GET /api/v1/auth/me` con `Authorization: Bearer` y el access de su login
- **THEN** recibe 200

#### Scenario: Cookie de access ignorada
- **WHEN** un usuario llama a `GET /api/v1/auth/me` solo con una cookie `access_token` que contiene un access válido
- **THEN** recibe 401

#### Scenario: Access vencido
- **WHEN** un usuario llama a una ruta protegida con un access cuyo `exp` ya pasó
- **THEN** recibe 401

#### Scenario: Access sin sid
- **WHEN** un usuario llama a una ruta protegida con un access bien firmado y vigente que no tiene `sid`
- **THEN** recibe 401

#### Scenario: Login no emite cookie de access
- **WHEN** un usuario hace login con éxito
- **THEN** la respuesta no setea ninguna cookie llamada `access_token`

#### Scenario: Sid de una sesión inexistente
- **WHEN** un usuario llama a `GET /api/v1/auth/me` con un access bien firmado y vigente cuyo `sid` no corresponde a ninguna sesión
- **THEN** recibe 401 con el mismo cuerpo que un access inválido

#### Scenario: Sid de la sesión de otro usuario
- **WHEN** un usuario llama a `GET /api/v1/auth/me` con un access bien firmado y vigente cuyo `sub` es el suyo pero cuyo `sid` es el de una sesión abierta de otro usuario
- **THEN** recibe 401

#### Scenario: Sesión vencida
- **WHEN** un usuario llama a `GET /api/v1/auth/me` con un access vigente cuya sesión tiene el vencimiento en el pasado y no está cerrada
- **THEN** recibe 401

#### Scenario: Sesión abierta y vigente
- **WHEN** un usuario con dos sesiones abiertas cierra una con logout y llama a `GET /api/v1/auth/me` con el access de la otra
- **THEN** recibe 200

### Requirement: Logout cierra la sesión actual
`POST /api/v1/auth/logout` SHALL requerir Bearer, no SHALL recibir cuerpo y SHALL cerrar la sesión indicada por el `sid` del access con motivo `LOGOUT`, borrar la cookie del refresh y responder 204. Para este endpoint basta un access bien firmado, vigente y con `sid`: no SHALL exigir que la sesión siga abierta. Si la sesión ya estaba cerrada SHALL responder 204, borrar la cookie y no modificarla.

#### Scenario: Logout exitoso
- **WHEN** un usuario con dos sesiones hace logout con el access de una de ellas
- **THEN** recibe 204, la respuesta borra la cookie `refresh_token` con `Path=/api/v1/auth`, esa sesión queda cerrada con motivo `LOGOUT` y la otra sigue abierta

#### Scenario: El refresh de la sesión cerrada ya no renueva
- **WHEN** después del logout se intenta renovar con el refresh que tenía esa sesión
- **THEN** recibe 401 y ninguna sesión se marca con `REUSO`

#### Scenario: Logout sin token
- **WHEN** se llama a `POST /api/v1/auth/logout` sin header `Authorization`
- **THEN** recibe 401

#### Scenario: Logout repetido
- **WHEN** un usuario hace logout dos veces con el mismo access
- **THEN** ambas llamadas reciben 204, ambas borran la cookie `refresh_token` y la sesión conserva el motivo `LOGOUT` y el instante del primer cierre

#### Scenario: Logout de una sesión cerrada por logout-all
- **WHEN** un usuario con dos sesiones hace logout-all desde una y después hace logout con el access de la otra
- **THEN** recibe 204, la respuesta borra la cookie `refresh_token` y esa sesión conserva el motivo `LOGOUT_ALL`

### Requirement: Logout en todos los dispositivos
`POST /api/v1/auth/logout-all` SHALL requerir Bearer de una sesión abierta y vigente, SHALL cerrar todas las sesiones abiertas del usuario autenticado con motivo `LOGOUT_ALL`, borrar la cookie del refresh y responder 204. Las sesiones de otros usuarios y las ya cerradas no SHALL modificarse. Un access de una sesión ya cerrada SHALL recibir 401 sin cerrar ninguna sesión.

#### Scenario: Cierra todas las sesiones propias
- **WHEN** un usuario con tres sesiones abiertas hace logout-all
- **THEN** recibe 204 y sus tres sesiones quedan cerradas con motivo `LOGOUT_ALL`

#### Scenario: No afecta a otros usuarios
- **WHEN** un usuario hace logout-all mientras otro usuario tiene una sesión abierta
- **THEN** la sesión del otro usuario sigue abierta

#### Scenario: Access de una sesión ya cerrada
- **WHEN** un usuario hace logout con el access A1, después inicia una sesión nueva y luego llama a logout-all con A1
- **THEN** recibe 401 y la sesión nueva sigue abierta

## ADDED Requirements

### Requirement: Cerrar la sesión invalida sus access
Un access SHALL dejar de autenticar en el pedido siguiente al cierre de su sesión, sea por logout, logout-all, detección de reuso o baja del usuario, aunque su `exp` no haya pasado. Esto SHALL valer para toda ruta protegida, incluida la creación de pedidos, sin esperar a la renovación.

#### Scenario: Access después del logout
- **WHEN** un usuario hace logout y enseguida llama a `GET /api/v1/auth/me` con el mismo access
- **THEN** recibe 401

#### Scenario: Otro navegador después de logout-all
- **WHEN** un cliente tiene tres sesiones abiertas, hace logout-all con el access de una y otro navegador llama a `GET /api/v1/auth/me` con el access de otra sesión
- **THEN** recibe 401

#### Scenario: Crear un pedido después de logout-all
- **WHEN** un cliente con dos sesiones hace logout-all desde una y el otro navegador llama a `POST /api/v1/pedidos/` con un cuerpo válido y el access de la otra sesión
- **THEN** recibe 401, no se crea ningún pedido y el stock no cambia

#### Scenario: Access después de detectar reuso
- **WHEN** se detecta el reuso de un refresh y se cierran las sesiones del usuario con motivo `REUSO`
- **THEN** el access de cualquiera de esas sesiones recibe 401 en `GET /api/v1/auth/me`

#### Scenario: Access de un usuario dado de baja
- **WHEN** un `ADMIN` desactiva a un usuario logueado y ese usuario llama a `GET /api/v1/auth/me` con su access
- **THEN** recibe 401, con el mismo cuerpo que un access inválido

## REMOVED Requirements

### Requirement: Cerrar la sesión no invalida los access ya emitidos
**Reason**: Decisión del usuario (2026-11-24): un logout-all que deja operar a los demás navegadores hasta 30 minutos, incluso confirmando pedidos, no cumple lo que promete. El límite aceptado de RN-AU-06 se elimina.
**Migration**: Reemplazado por «Cerrar la sesión invalida sus access». Los clientes ya manejan el 401 con una renovación que, para una sesión cerrada, falla y deja la sesión local anónima.
