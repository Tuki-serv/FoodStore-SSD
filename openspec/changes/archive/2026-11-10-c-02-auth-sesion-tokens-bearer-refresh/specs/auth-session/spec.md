# Spec Delta

## Purpose

Define el ciclo de vida de la sesión autenticada del backend: login, transporte del access token por Bearer y del refresh token por cookie HttpOnly, renovación con rotación e historial, detección de reuso, vencimiento fijo de la sesión y cierre de una o de todas las sesiones de un usuario.

## ADDED Requirements

### Requirement: Login abre una sesión
`POST /api/v1/auth/login` con email y contraseña válidos de un usuario activo SHALL crear una sesión nueva que vence 7 días (`REFRESH_TOKEN_EXPIRE_DAYS`) después del login, y SHALL responder 200 con `access_token`, `token_type` `bearer` y `expires_in` en segundos. El cuerpo no SHALL incluir el refresh token.

#### Scenario: Login exitoso
- **WHEN** un usuario activo hace login con credenciales correctas
- **THEN** recibe 200 con `access_token`, `token_type` igual a `bearer` y `expires_in` igual a 1800, el cuerpo no tiene la clave `refresh_token`, y existe una sesión abierta nueva de ese usuario que vence 7 días después del login

#### Scenario: Dos logins abren dos sesiones
- **WHEN** el mismo usuario hace login dos veces
- **THEN** existen dos sesiones abiertas distintas de ese usuario, cada una con su propio refresh activo

### Requirement: Credenciales inválidas en el login
El login SHALL responder 401 con `detail` «Credenciales incorrectas» cuando el email no existe, la contraseña no coincide o el usuario está dado de baja, sin crear sesión ni emitir cookie.

#### Scenario: Contraseña incorrecta
- **WHEN** un usuario hace login con una contraseña incorrecta
- **THEN** recibe 401 con «Credenciales incorrectas», no se crea ninguna sesión y la respuesta no tiene `Set-Cookie` del refresh

#### Scenario: Usuario dado de baja
- **WHEN** un usuario con `deleted_at` definido hace login con su contraseña correcta
- **THEN** recibe 401 con «Credenciales incorrectas»

### Requirement: Login sin diferencia de tiempo por existencia del usuario
El login SHALL ejecutar una verificación bcrypt aun cuando el email no exista o el usuario esté dado de baja (contra un hash de relleno), y SHALL responder lo mismo que con una contraseña incorrecta, para que el tiempo de respuesta no permita enumerar emails.

#### Scenario: Email inexistente
- **WHEN** un cliente hace login con un email que no existe
- **THEN** se ejecuta una verificación bcrypt contra el hash de relleno y la respuesta es el mismo 401 con el mismo cuerpo que con una contraseña incorrecta

#### Scenario: Usuario dado de baja
- **WHEN** un usuario dado de baja hace login con su contraseña correcta
- **THEN** se ejecuta una verificación bcrypt contra el hash de relleno y recibe el mismo 401 «Credenciales incorrectas»

### Requirement: El access token identifica usuario, roles y sesión
El access token SHALL ser un JWT firmado con `ALGORITHM` que vence a los `ACCESS_TOKEN_EXPIRE_MINUTES` minutos y contiene `sub` (id del usuario), `roles` (códigos de rol), `sid` (id de la sesión) y `type` igual a `access`.

#### Scenario: Claims del access del login
- **WHEN** se decodifica el `access_token` devuelto por un login exitoso
- **THEN** `sub` es el id del usuario, `roles` son sus códigos de rol, `sid` es el id de la sesión creada, `type` es `access` y `exp` está 30 minutos después de la emisión

#### Scenario: El sid no es secuencial
- **WHEN** se comparan los `sid` de dos logins consecutivos
- **THEN** son identificadores UUID distintos

### Requirement: El access token viaja por Authorization Bearer
Las rutas protegidas SHALL autenticar solo con el header `Authorization: Bearer <access_token>`. Una cookie `access_token` no SHALL autenticar. Un token ausente, mal firmado, vencido, de otro `type` o sin `sid` SHALL producir 401. Validar el access no SHALL requerir que la sesión esté abierta.

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

### Requirement: Usuario autenticado en GET /auth/me
`GET /api/v1/auth/me` SHALL devolver el usuario autenticado por el access con `id`, `nombre`, `apellido`, `email`, `celular` y `roles`, sin `password_hash`.

#### Scenario: Me con Bearer
- **WHEN** un cliente llama a `GET /api/v1/auth/me` con su access
- **THEN** recibe 200 con su email y la lista de roles con el rol `CLIENT`, y el cuerpo no tiene `password_hash`

#### Scenario: Me sin token
- **WHEN** se llama a `GET /api/v1/auth/me` sin header `Authorization`
- **THEN** recibe 401

### Requirement: El refresh token viaja en una cookie HttpOnly
Login y renovación SHALL entregar el refresh token solo en la cookie `refresh_token`, HttpOnly, con `Path=/api/v1/auth`, `SameSite` igual a `REFRESH_COOKIE_SAMESITE`, `Secure` si `REFRESH_COOKIE_SECURE` es verdadera y `Max-Age` igual a los segundos que faltan para el vencimiento de la sesión. Ningún endpoint SHALL leer el refresh del cuerpo.

#### Scenario: Atributos de la cookie en el login
- **WHEN** un usuario hace login con `REFRESH_COOKIE_SAMESITE=lax` y `REFRESH_COOKIE_SECURE=false`
- **THEN** la respuesta setea `refresh_token` con `HttpOnly`, `Path=/api/v1/auth`, `SameSite=lax`, sin `Secure` y con un `Max-Age` de 604800 segundos o apenas menos

#### Scenario: Cookie Secure configurada
- **WHEN** un usuario hace login con `REFRESH_COOKIE_SECURE=true`
- **THEN** la cookie `refresh_token` tiene el atributo `Secure`

#### Scenario: Refresh en el cuerpo ignorado
- **WHEN** se llama a `POST /api/v1/auth/refresh` sin cookie y con un cuerpo `{"refresh_token": "<valor válido>"}`
- **THEN** recibe 401

### Requirement: El refresh token se guarda solo como hash
El refresh token SHALL ser un valor opaco aleatorio (no un JWT) con el mismo formato en login y en renovación. La base SHALL guardar solo su SHA-256 en hexadecimal, nunca el valor en claro.

#### Scenario: Hash en la base
- **WHEN** un usuario hace login y se lee el refresh activo de su sesión en la base
- **THEN** su `token_hash` es el SHA-256 hexadecimal del valor de la cookie y ninguna columna contiene el valor en claro

#### Scenario: Formato opaco estable
- **WHEN** se compara el refresh de la cookie del login con el de la cookie de una renovación
- **THEN** ninguno de los dos tiene la forma de un JWT (tres segmentos separados por punto) y ambos tienen la misma longitud

### Requirement: La renovación rota el refresh
`POST /api/v1/auth/refresh` con un refresh activo de una sesión abierta y vigente SHALL marcar ese refresh como rotado (`revoked_at`), crear uno nuevo en la misma sesión, setear la cookie con el nuevo y responder 200 con un access nuevo que conserva el `sid` y refleja los roles actuales del usuario.

#### Scenario: Rotación exitosa
- **WHEN** un usuario llama a `POST /api/v1/auth/refresh` con la cookie de su login
- **THEN** recibe 200 con un `access_token` nuevo con el mismo `sid`, la respuesta setea una cookie `refresh_token` con un valor distinto, el refresh anterior queda con `revoked_at` definido y la sesión tiene exactamente un refresh activo, el nuevo

#### Scenario: Cadena de rotaciones
- **WHEN** un usuario renueva tres veces seguidas usando cada vez la cookie recibida en la renovación anterior
- **THEN** las tres responden 200 y la sesión tiene cuatro refresh tokens: tres rotados y uno activo

#### Scenario: Roles actualizados en la renovación
- **WHEN** un ADMIN agrega el rol `STOCK` a un usuario logueado y ese usuario renueva
- **THEN** el `roles` del access nuevo incluye `STOCK`

### Requirement: Vencimiento fijo de la sesión
El vencimiento de una sesión SHALL quedar fijo en el login y ninguna renovación SHALL modificarlo. Una sesión vencida no SHALL poder renovarse.

#### Scenario: La rotación no extiende la sesión
- **WHEN** un usuario renueva su sesión
- **THEN** el vencimiento de la sesión es exactamente el mismo que tenía antes de renovar

#### Scenario: Sesión vencida
- **WHEN** un usuario renueva con el refresh activo de una sesión cuyo vencimiento ya pasó
- **THEN** recibe 401, ninguna sesión del usuario se cierra y no se crea un refresh nuevo

### Requirement: Refresh rechazado sin alarma
La renovación SHALL responder 401, borrar la cookie del refresh y no cerrar ninguna sesión cuando no hay cookie, cuando el refresh no existe, cuando su sesión está vencida o cerrada, o cuando el usuario está dado de baja.

#### Scenario: Sin cookie
- **WHEN** se llama a `POST /api/v1/auth/refresh` sin cookie `refresh_token`
- **THEN** recibe 401

#### Scenario: Refresh desconocido
- **WHEN** se llama a `POST /api/v1/auth/refresh` con una cookie cuyo valor no corresponde a ningún refresh
- **THEN** recibe 401 y la respuesta borra la cookie `refresh_token`

#### Scenario: Sesión cerrada por logout-all
- **WHEN** un usuario con dos sesiones hace logout-all desde una y después el otro navegador renueva con su refresh activo
- **THEN** recibe 401 y las sesiones conservan el motivo `LOGOUT_ALL` (no se marca `REUSO`)

#### Scenario: Usuario dado de baja
- **WHEN** un usuario logueado es dado de baja y después renueva con su refresh activo
- **THEN** recibe 401

### Requirement: Período de gracia para renovaciones concurrentes
Si llega un refresh rotado hace `REFRESH_REUSE_GRACE_SECONDS` segundos o menos y su sesión sigue abierta y vigente, la renovación SHALL responder 200 con un access nuevo de esa sesión, sin rotar otra vez, sin crear refresh y sin setear la cookie.

#### Scenario: Segunda pestaña dentro de la gracia
- **WHEN** con gracia de 30 segundos un usuario renueva con un refresh y, 10 segundos después de esa rotación, vuelve a presentar el mismo refresh
- **THEN** la segunda llamada recibe 200 con un access nuevo con el mismo `sid`, la respuesta no tiene `Set-Cookie` del refresh y la sesión sigue con un solo refresh activo, el emitido por la primera llamada

#### Scenario: Gracia en cero
- **WHEN** con `REFRESH_REUSE_GRACE_SECONDS=0` se presenta un refresh rotado hace 1 segundo con la sesión abierta
- **THEN** se trata como reuso

### Requirement: Detección de reuso del refresh
Si llega un refresh rotado hace más de `REFRESH_REUSE_GRACE_SECONDS` segundos y su sesión sigue abierta y vigente, el sistema SHALL cerrar todas las sesiones abiertas del usuario con motivo `REUSO`, registrar una advertencia en el log sin el valor ni el hash del token, borrar la cookie y responder 401.

#### Scenario: Refresh robado reutilizado
- **WHEN** con gracia de 30 segundos se presenta un refresh rotado hace 60 segundos y el usuario tiene otras dos sesiones abiertas
- **THEN** recibe 401, las tres sesiones quedan cerradas con motivo `REUSO`, se registra un log de nivel WARNING que menciona el reuso y el id del usuario, y el log no contiene el valor del refresh

#### Scenario: La revocación persiste tras el 401
- **WHEN** se detecta un reuso y se vuelven a leer de la base las sesiones del usuario
- **THEN** todas siguen cerradas con motivo `REUSO`

#### Scenario: Sesiones ya cerradas conservan su motivo
- **WHEN** se detecta un reuso y el usuario tenía una sesión cerrada antes con motivo `LOGOUT`
- **THEN** esa sesión conserva el motivo `LOGOUT`

### Requirement: Renovaciones simultáneas con el mismo refresh
Dos renovaciones simultáneas con el mismo refresh activo SHALL serializarse: una rota y la otra se resuelve como período de gracia, sin crear un segundo refresh activo ni cerrar la sesión.

#### Scenario: Dos renovaciones al mismo tiempo
- **WHEN** dos pedidos `POST /api/v1/auth/refresh` llegan a la vez con el mismo refresh activo
- **THEN** ambos reciben 200 con un access de la misma sesión, solo uno setea una cookie nueva, la sesión tiene exactamente un refresh activo y no queda cerrada

### Requirement: Un solo refresh activo por sesión
Cada sesión SHALL tener como máximo un refresh activo (sin `revoked_at`) en todo momento, garantizado también por la base de datos.

#### Scenario: Segundo activo rechazado por la base
- **WHEN** se inserta directamente en la base un segundo refresh sin `revoked_at` para una sesión que ya tiene uno activo
- **THEN** la base rechaza la inserción por violación de unicidad

### Requirement: Logout cierra la sesión actual
`POST /api/v1/auth/logout` SHALL requerir Bearer, no SHALL recibir cuerpo y SHALL cerrar la sesión indicada por el `sid` del access con motivo `LOGOUT`, borrar la cookie del refresh y responder 204. Si la sesión ya estaba cerrada SHALL responder 204 sin modificarla.

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
- **THEN** ambas llamadas reciben 204 y la sesión conserva el motivo `LOGOUT` y el instante del primer cierre

### Requirement: Logout en todos los dispositivos
`POST /api/v1/auth/logout-all` SHALL requerir Bearer, SHALL cerrar todas las sesiones abiertas del usuario autenticado con motivo `LOGOUT_ALL`, borrar la cookie del refresh y responder 204. Las sesiones de otros usuarios y las ya cerradas no SHALL modificarse.

#### Scenario: Cierra todas las sesiones propias
- **WHEN** un usuario con tres sesiones abiertas hace logout-all
- **THEN** recibe 204 y sus tres sesiones quedan cerradas con motivo `LOGOUT_ALL`

#### Scenario: No afecta a otros usuarios
- **WHEN** un usuario hace logout-all mientras otro usuario tiene una sesión abierta
- **THEN** la sesión del otro usuario sigue abierta

### Requirement: Cerrar la sesión no invalida los access ya emitidos
Un access emitido antes de cerrar su sesión SHALL seguir autenticando hasta su `exp` (límite aceptado de RN-AU-06).

#### Scenario: Access después del logout
- **WHEN** un usuario hace logout y enseguida llama a `GET /api/v1/auth/me` con el mismo access
- **THEN** recibe 200

### Requirement: Metadatos de sesión solo para auditoría
Al crear una sesión el sistema SHALL guardar la IP del cliente y el `User-Agent` del pedido de login (nulo si falta). La renovación no SHALL compararlos ni rechazar un pedido porque difieran.

#### Scenario: Metadatos guardados
- **WHEN** un usuario hace login con el header `User-Agent: TestAgent/1.0`
- **THEN** la sesión creada guarda `user_agent` igual a `TestAgent/1.0` y una IP no vacía

#### Scenario: Otro user agent en la renovación
- **WHEN** el usuario renueva con `User-Agent: OtroAgente/2.0`
- **THEN** recibe 200 y la sesión conserva `user_agent` igual a `TestAgent/1.0`

### Requirement: Sesiones y refresh tokens no se borran
Login, renovación, logout, logout-all y detección de reuso no SHALL borrar filas de sesiones ni de refresh tokens: los cierres y rotaciones se registran con `revoked_at` (y `revoked_reason` en la sesión).

#### Scenario: Historial completo tras el ciclo de vida
- **WHEN** un usuario hace login, renueva dos veces y hace logout
- **THEN** la base conserva la sesión, cerrada con motivo `LOGOUT`, y sus tres refresh tokens, dos rotados y uno sin `revoked_at`
