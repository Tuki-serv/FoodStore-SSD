## Purpose

Define cómo el frontend de Food Store habla con el backend: URL base y credenciales, envío del access token, renovación transparente de la sesión ante un 401, forma única de los errores que reciben las pantallas y comportamiento por defecto de la caché de datos del servidor.

## ADDED Requirements

### Requirement: URL base de la API
Todo pedido del frontend al backend SHALL dirigirse a `VITE_API_URL` seguido de `/api/v1`, sin importar si `VITE_API_URL` termina o no en `/`. Las pantallas SHALL indicar solo el path del recurso (por ejemplo `/auth/me`).

#### Scenario: URL sin barra final
- **WHEN** `VITE_API_URL` es `http://localhost:8000` y una pantalla pide `/auth/me`
- **THEN** el pedido sale a `http://localhost:8000/api/v1/auth/me`

#### Scenario: URL con barra final
- **WHEN** `VITE_API_URL` es `http://localhost:8000/` y una pantalla pide `/productos`
- **THEN** el pedido sale a `http://localhost:8000/api/v1/productos`

### Requirement: Credenciales del navegador en los pedidos
Los pedidos al backend SHALL enviarse con las credenciales del navegador habilitadas, para que la cookie HttpOnly `refresh_token` (`Path=/api/v1/auth`) se guarde al iniciar sesión y viaje sola a las rutas de autenticación. El frontend no SHALL leer, escribir ni reenviar esa cookie desde código.

#### Scenario: Renovación con cookie
- **WHEN** el frontend llama a `POST /api/v1/auth/refresh`
- **THEN** el pedido sale con credenciales incluidas y sin cuerpo

#### Scenario: Refresh fuera del alcance de JS
- **WHEN** se inspeccionan el almacenamiento del navegador y el estado del frontend tras una renovación exitosa
- **THEN** ninguno contiene el valor del refresh token

### Requirement: Access token en Authorization Bearer
Si hay un access token en la sesión, cada pedido SHALL llevar el header `Authorization: Bearer <access>`. Sin access token el pedido SHALL salir sin ese header. El access no SHALL enviarse en cookies, query string ni cuerpo.

#### Scenario: Pedido con sesión
- **WHEN** la sesión tiene el access `A1` y se pide `GET /pedidos`
- **THEN** el pedido lleva `Authorization: Bearer A1`

#### Scenario: Pedido anónimo
- **WHEN** no hay access en la sesión y se pide `GET /productos`
- **THEN** el pedido no lleva header `Authorization`

### Requirement: Renovación transparente ante un 401
Si un pedido responde 401, el frontend SHALL llamar a `POST /auth/refresh`, guardar el access nuevo en la sesión y repetir el pedido original con ese access, entregando a la pantalla la respuesta del reintento como si fuera la original (US-003).

#### Scenario: Access vencido
- **WHEN** `GET /pedidos` responde 401 y `POST /auth/refresh` responde 200 con el access `A2`
- **THEN** `GET /pedidos` se repite con `Authorization: Bearer A2`, la pantalla recibe su respuesta 200 y la sesión queda con `A2`

#### Scenario: Lectura pública con access inválido
- **WHEN** `GET /productos` con un access inválido responde 401 y la renovación responde 200
- **THEN** la lectura se repite con el access nuevo y la pantalla recibe el listado

### Requirement: Una sola renovación para 401 concurrentes
Mientras una renovación está en curso, todo otro pedido que responda 401 SHALL esperar esa misma renovación en lugar de iniciar otra, y luego repetirse con su resultado. Así se evita disparar la detección de reuso del refresh rotado.

#### Scenario: Tres pedidos vencidos a la vez
- **WHEN** tres pedidos simultáneos responden 401
- **THEN** el frontend hace exactamente un `POST /auth/refresh` y los tres pedidos se repiten con el access nuevo

### Requirement: Reintento único por pedido
Cada pedido original SHALL repetirse como máximo una vez por renovación. Si el reintento vuelve a responder 401, la pantalla SHALL recibir ese error sin una nueva renovación.

#### Scenario: Reintento rechazado
- **WHEN** un pedido responde 401, la renovación responde 200 y el reintento vuelve a responder 401
- **THEN** la pantalla recibe un error con estado 401 y hubo un solo `POST /auth/refresh`

### Requirement: Pedidos que no disparan renovación
Un 401 de `POST /auth/login` o de `POST /auth/refresh` no SHALL disparar una renovación: el error SHALL llegar directo a quien hizo el pedido. Un 401 de `POST /auth/logout` o `POST /auth/logout-all` SHALL renovarse como cualquier otro pedido, para que el backend cierre la sesión aunque el access haya vencido.

#### Scenario: Credenciales inválidas
- **WHEN** `POST /auth/login` responde 401
- **THEN** no hay ningún `POST /auth/refresh` y la pantalla recibe el error 401

#### Scenario: Logout con access vencido
- **WHEN** `POST /auth/logout` responde 401 y la renovación responde 200
- **THEN** `POST /auth/logout` se repite con el access nuevo

### Requirement: Reintento sin renovar si el access ya cambió
Si un pedido que responde 401 salió con un access distinto del que la sesión tiene ahora (otra renovación ya terminó), el frontend SHALL repetirlo con el access actual sin llamar a `POST /auth/refresh`.

#### Scenario: 401 tardío
- **WHEN** un pedido enviado con `A1` responde 401 después de que la sesión ya pasó a `A2`
- **THEN** el pedido se repite con `A2` y no hay un `POST /auth/refresh` nuevo

### Requirement: Renovación fallida cierra la sesión local
Si `POST /auth/refresh` falla (401 u otro error), el frontend SHALL cerrar la sesión local (sin access ni usuario, estado anónimo) y rechazar todos los pedidos que esperaban la renovación con el error original de cada uno.

#### Scenario: Sesión vencida en el servidor
- **WHEN** un pedido responde 401 y `POST /auth/refresh` responde 401
- **THEN** la sesión queda anónima y la pantalla recibe un error con estado 401

### Requirement: Errores con forma única
Todo pedido fallido SHALL llegar a las pantallas como un error tipado con `status`, `detail`, `code` y `field` tomados del cuerpo `{detail, code, field}` del backend. Las pantallas SHALL decidir por `code` (y `field` para marcar un campo), nunca por el texto de `detail`.

#### Scenario: Error de negocio
- **WHEN** el backend responde 409 `{detail: "Stock insuficiente", code: "INSUFFICIENT_STOCK", field: null}`
- **THEN** la pantalla recibe `status` 409, `code` `INSUFFICIENT_STOCK`, `detail` «Stock insuficiente» y `field` nulo

#### Scenario: Error de validación
- **WHEN** el backend responde 422 con `code` `VALIDATION_ERROR` y `field` `email`
- **THEN** la pantalla recibe `field` `email` para marcar ese campo

### Requirement: Espera indicada en el límite de pedidos
Un error 429 SHALL incluir, además de los campos comunes, los segundos de espera tomados del header `Retry-After` cuando es un entero positivo; si falta o no es válido, ese dato SHALL quedar ausente.

#### Scenario: Login bloqueado
- **WHEN** `POST /auth/login` responde 429 con `Retry-After: 840` y `code` `RATE_LIMIT_EXCEEDED`
- **THEN** la pantalla recibe `code` `RATE_LIMIT_EXCEEDED` y una espera de 840 segundos

### Requirement: Errores sin respuesta del backend
Si el backend no responde (red caída, CORS, tiempo agotado) el error SHALL tener estado nulo y `code` `NETWORK_ERROR`. Si responde sin el formato `{detail, code, field}`, SHALL usar `code` `HTTP_<status>` y un `detail` genérico. Ningún error SHALL exponer trazas ni el cuerpo crudo.

#### Scenario: Backend apagado
- **WHEN** un pedido falla sin respuesta
- **THEN** la pantalla recibe estado nulo, `code` `NETWORK_ERROR` y un `detail` legible

#### Scenario: Respuesta de un proxy
- **WHEN** un pedido responde 502 con un cuerpo HTML
- **THEN** la pantalla recibe estado 502, `code` `HTTP_502` y un `detail` genérico sin el HTML

### Requirement: Política de reintentos de la caché de datos
Las consultas de datos del servidor no SHALL reintentarse ante errores 4xx. Ante errores de red o 5xx SHALL reintentarse como máximo una vez. Las mutaciones no SHALL reintentarse automáticamente.

#### Scenario: Recurso inexistente
- **WHEN** una consulta recibe 404
- **THEN** se hace un solo pedido y la pantalla recibe el error

#### Scenario: Falla transitoria
- **WHEN** una consulta recibe 503 y luego 200
- **THEN** la pantalla recibe los datos tras dos pedidos
