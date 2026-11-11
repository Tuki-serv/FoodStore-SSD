# auth-session Specification

## Purpose

Define el ciclo de vida de la sesión autenticada del backend: login, transporte del access token por Bearer y del refresh token por cookie HttpOnly, renovación con rotación e historial, detección de reuso, vencimiento fijo de la sesión y cierre de una o de todas las sesiones de un usuario.

## Requirements

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

### Requirement: Límite de intentos fallidos de login por IP
`POST /api/v1/auth/login` SHALL contar por IP de origen los intentos rechazados por credenciales incorrectas (401). Cuando una IP acumula 5 fallos dentro de los últimos 15 minutos, todo intento siguiente desde esa IP SHALL responder 429, aunque las credenciales sean correctas, sin verificar la contraseña ni crear sesión. Un intento rechazado con 429 no SHALL contar como fallo.

#### Scenario: Cinco fallos no bloquean
- **WHEN** una IP hace 5 logins con contraseña incorrecta dentro de 15 minutos
- **THEN** los 5 reciben 401 «Credenciales incorrectas»

#### Scenario: Sexto intento bloqueado
- **WHEN** una IP con 5 fallos en los últimos 15 minutos hace login con credenciales correctas
- **THEN** recibe 429 con `code` `RATE_LIMIT_EXCEEDED`, no se crea ninguna sesión y la respuesta no tiene `Set-Cookie` del refresh

#### Scenario: Otra IP no se ve afectada
- **WHEN** una IP está bloqueada y otra IP hace login con credenciales correctas
- **THEN** la otra IP recibe 200

#### Scenario: Los logins exitosos no cuentan
- **WHEN** una IP hace 10 logins seguidos con credenciales correctas
- **THEN** los 10 reciben 200

#### Scenario: Request mal formada no cuenta
- **WHEN** una IP hace 6 requests a login sin el campo `password` y luego un login correcto
- **THEN** las 6 reciben 422 y el login correcto recibe 200

### Requirement: Ventana deslizante de 15 minutos
Cada fallo SHALL dejar de contar 15 minutos después de producido. Una IP bloqueada SHALL volver a poder intentar login en cuanto su fallo más antiguo dentro de la ventana deje de contar, sin necesidad de reinicio manual.

#### Scenario: Desbloqueo al vencer la ventana
- **WHEN** una IP alcanza 5 fallos y pasan 15 minutos desde el primero
- **THEN** su siguiente login con credenciales correctas recibe 200

#### Scenario: Fallos fuera de la ventana no suman
- **WHEN** una IP hace 4 fallos, pasan 16 minutos y hace 1 fallo más
- **THEN** su siguiente login con contraseña incorrecta recibe 401 y no 429

#### Scenario: Antes de vencer sigue bloqueada
- **WHEN** una IP alcanza 5 fallos y pasan 14 minutos desde el primero
- **THEN** su siguiente intento de login recibe 429

### Requirement: Retry-After en el bloqueo de login
El 429 del login SHALL incluir el header `Retry-After` con un entero positivo de segundos igual al tiempo que falta para que el fallo más antiguo de la ventana deje de contar, redondeado hacia arriba y como mínimo 1.

#### Scenario: Retry-After al bloquear
- **WHEN** una IP alcanza 5 fallos en el mismo instante y hace un sexto intento 60 segundos después
- **THEN** recibe 429 con `Retry-After` igual a 840

#### Scenario: Retry-After decrece
- **WHEN** la misma IP vuelve a intentar 14 minutos y 59,5 segundos después del primer fallo
- **THEN** recibe 429 con `Retry-After` igual a 1

### Requirement: Login correcto reinicia los fallos
Un login exitoso desde una IP no bloqueada SHALL borrar los fallos acumulados de esa IP, de modo que vuelva a disponer de 5 intentos fallidos en una ventana nueva. Un login exitoso no SHALL borrar los fallos de otras IP.

#### Scenario: Reinicio tras éxito
- **WHEN** una IP hace 4 fallos, un login correcto y luego 4 fallos más dentro de 15 minutos
- **THEN** los 4 últimos reciben 401 y su siguiente login correcto recibe 200

#### Scenario: Sin reinicio, el quinto fallo bloquea
- **WHEN** una IP hace 4 fallos, un login correcto, 5 fallos más y otro intento dentro de 15 minutos
- **THEN** el último intento recibe 429

### Requirement: La IP del límite es la de la conexión
La IP que identifica al cliente en el límite de login SHALL ser la dirección de la conexión que recibe la aplicación. Un header `X-Forwarded-For` enviado por el cliente no SHALL cambiar la IP contada.

#### Scenario: X-Forwarded-For no evade el bloqueo
- **WHEN** una IP bloqueada hace login enviando `X-Forwarded-For: 203.0.113.9`
- **THEN** recibe 429

### Requirement: Las demás rutas de autenticación no tienen límite
`POST /api/v1/auth/register`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/logout-all` y `GET /api/v1/auth/me` no SHALL estar sujetas a límite de peticiones, ni SHALL verse afectadas por el bloqueo de login de la IP.

#### Scenario: Muchas requests sin 429
- **WHEN** un cliente hace 20 requests seguidas a cada una de esas rutas
- **THEN** ninguna respuesta es 429

#### Scenario: Bloqueo de login no alcanza a otras rutas
- **WHEN** una IP bloqueada en login hace `GET /api/v1/auth/me` con un access válido y `POST /api/v1/auth/refresh` con un refresh válido
- **THEN** recibe 200 en ambas
