## ADDED Requirements

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
