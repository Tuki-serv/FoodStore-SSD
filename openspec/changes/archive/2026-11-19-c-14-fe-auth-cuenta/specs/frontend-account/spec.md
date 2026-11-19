# Spec Delta — frontend-account

## Purpose

Define las pantallas de cuenta del frontend: ingreso con email y contraseña, registro de clientes, perfil propio y cierre de todas las sesiones, con validación en el cliente y mensajes de error derivados del código que devuelve la API.

## ADDED Requirements

### Requirement: Ingreso con email y contraseña
La ruta `/ingresar` SHALL mostrar un formulario con «Email» y «Contraseña» que envía `POST /api/v1/auth/login` como formulario OAuth2 (`username` = email sin espacios al borde, `password` tal cual) con credenciales incluidas. Con 200 SHALL abrir la sesión con el `access_token` recibido; la navegación posterior la resuelve el guard de rutas anónimas.

#### Scenario: Login correcto
- **WHEN** un visitante en `/ingresar` escribe ` ana@example.com ` y `secreta123` y pulsa «Ingresar», el login responde 200 con `access_token` `A1` y `GET /auth/me` responde un `CLIENT`
- **THEN** el backend recibe `username=ana@example.com&password=secreta123` como `application/x-www-form-urlencoded`, la sesión queda `autenticada` con `A1` y la URL pasa a `/catalogo`

#### Scenario: Vuelta a la ruta recordada
- **WHEN** un visitante fue llevado a `/ingresar` desde `/direcciones` e inicia sesión correctamente como `CLIENT`
- **THEN** la URL pasa a `/direcciones`

#### Scenario: Usuario no recuperable tras el login
- **WHEN** el login responde 200 pero `GET /auth/me` responde 404
- **THEN** la sesión queda `anonima`, el formulario sigue visible con los valores ingresados y se muestra una alerta de error genérica

### Requirement: Validación del formulario de ingreso
El formulario de ingreso SHALL exigir un email con formato válido y una contraseña no vacía antes de enviar; con errores no SHALL hacer ningún pedido y SHALL mostrar cada error junto a su campo.

#### Scenario: Campos vacíos
- **WHEN** el visitante pulsa «Ingresar» sin completar nada
- **THEN** ve «Ingresá tu email» y «Ingresá tu contraseña» junto a cada campo y no se hace ningún pedido

#### Scenario: Email mal formado
- **WHEN** el visitante escribe `ana@` y sale del campo
- **THEN** ve «Ingresá un email válido» solo en ese campo

### Requirement: Credenciales incorrectas
Si el login responde 401, la pantalla SHALL mostrar una alerta «Email o contraseña incorrectos.» sin indicar cuál de los dos falló, SHALL conservar el email, SHALL vaciar la contraseña y la sesión SHALL seguir `anonima` sin intentar renovarla.

#### Scenario: Contraseña equivocada
- **WHEN** el login responde 401 `HTTP_401`
- **THEN** se ve la alerta «Email o contraseña incorrectos.», el campo email conserva su valor, el de contraseña queda vacío y no se pidió `POST /auth/refresh`

### Requirement: Bloqueo por intentos fallidos
Si el login responde 429, la pantalla SHALL mostrar un aviso de bloqueo con el tiempo de espera redondeado hacia arriba a minutos según `Retry-After` y SHALL deshabilitar «Ingresar» hasta que ese tiempo pase. Sin `Retry-After` válido SHALL mostrar el aviso sin tiempo y no deshabilitar el botón.

#### Scenario: Bloqueo con tiempo de espera
- **WHEN** el login responde 429 `RATE_LIMIT_EXCEEDED` con `Retry-After: 840`
- **THEN** se ve un aviso que menciona 14 minutos y el botón «Ingresar» está deshabilitado

#### Scenario: Fin del bloqueo
- **WHEN** pasaron los 840 segundos del bloqueo anterior
- **THEN** el botón «Ingresar» vuelve a estar habilitado

#### Scenario: 429 sin Retry-After
- **WHEN** el login responde 429 sin cabecera `Retry-After`
- **THEN** se ve el aviso de bloqueo sin tiempo y «Ingresar» sigue habilitado

### Requirement: Fallo de red al ingresar
Si el login no recibe respuesta o responde un error no previsto (5xx u otro código), la pantalla SHALL mostrar el `detail` normalizado del error en una alerta y conservar los valores del formulario.

#### Scenario: Backend caído
- **WHEN** el login falla sin respuesta
- **THEN** se ve la alerta «No pudimos conectar con el servidor.» y el email sigue cargado

### Requirement: Envío único mientras se procesa
Mientras un ingreso, registro o guardado de perfil está en curso, su botón de envío SHALL estar deshabilitado con un texto de progreso y un segundo clic no SHALL generar otro pedido.

#### Scenario: Doble clic en Ingresar
- **WHEN** el login demora y el visitante pulsa «Ingresar» dos veces
- **THEN** el backend recibe un solo `POST /auth/login` y el botón muestra «Ingresando…» deshabilitado

### Requirement: Registro de cliente
La ruta `/registrarse` SHALL mostrar un formulario con nombre, apellido, email, celular (opcional), contraseña y «Repetir contraseña», que envía `POST /api/v1/auth/register` en JSON con los textos sin espacios al borde, sin «Repetir contraseña» y con `celular` en `null` si quedó vacío.

#### Scenario: Cuerpo enviado
- **WHEN** el visitante completa «Ana», «Gómez», «ana@example.com», celular vacío y `secreta123` dos veces y pulsa «Crear cuenta»
- **THEN** el backend recibe `{"nombre":"Ana","apellido":"Gómez","email":"ana@example.com","celular":null,"password":"secreta123"}` (sin la repetición de la contraseña)

### Requirement: Sesión iniciada tras registrarse
Tras un registro 201, el frontend SHALL iniciar sesión con el mismo email y contraseña y comportarse como un ingreso correcto. Si ese login falla, SHALL llevar a `/ingresar` con el email precargado y un aviso de cuenta creada.

#### Scenario: Registro y sesión
- **WHEN** el registro responde 201 y el login posterior responde 200
- **THEN** la sesión queda `autenticada` como `CLIENT` y la URL pasa a `/catalogo`

#### Scenario: Registro correcto con login fallido
- **WHEN** el registro responde 201 con `email` `ana@example.com` y el login posterior responde 429
- **THEN** la URL pasa a `/ingresar`, el campo email tiene `ana@example.com`, la contraseña está vacía y se ve «Tu cuenta se creó. Ingresá para continuar.»

### Requirement: Validación del formulario de registro
El formulario de registro SHALL exigir nombre y apellido no vacíos de hasta 80 caracteres, email válido, celular de hasta 20 caracteres, contraseña de al menos 8 caracteres y «Repetir contraseña» igual a la contraseña; con errores no SHALL hacer ningún pedido.

#### Scenario: Contraseña corta
- **WHEN** la contraseña tiene 7 caracteres
- **THEN** se ve «Usá al menos 8 caracteres» junto al campo y no se hace ningún pedido

#### Scenario: Contraseñas distintas
- **WHEN** «Repetir contraseña» no coincide con la contraseña y se pulsa «Crear cuenta»
- **THEN** se ve «Las contraseñas no coinciden» junto a «Repetir contraseña» y no se hace ningún pedido

#### Scenario: Nombre y apellido en blanco
- **WHEN** el nombre es «   » y el apellido está vacío y se pulsa «Crear cuenta»
- **THEN** se ve «Ingresá tu nombre» y «Ingresá tu apellido» junto a cada campo y no se hace ningún pedido

#### Scenario: Nombre de 81 caracteres
- **WHEN** el nombre tiene 81 caracteres
- **THEN** se ve «Máximo 80 caracteres» junto al nombre

### Requirement: Email ya registrado
Si el registro responde 409, el formulario SHALL marcar el campo email con «Ya existe una cuenta con este email.», ofrecer un enlace a `/ingresar` y conservar los demás valores.

#### Scenario: Email duplicado
- **WHEN** el registro responde 409 `HTTP_409` con `field: null`
- **THEN** el campo email muestra «Ya existe una cuenta con este email.» con `aria-invalid="true"`, hay un enlace «Ingresar» y el nombre sigue cargado

### Requirement: Errores de validación del servidor
Si el registro o el guardado del perfil responden 422 `VALIDATION_ERROR` con un `field` que corresponde a un campo del formulario, el `detail` SHALL mostrarse junto a ese campo; si no corresponde a ninguno, en una alerta general.

#### Scenario: Email rechazado por el servidor
- **WHEN** el registro responde 422 `VALIDATION_ERROR` con `field: 'email'`
- **THEN** el `detail` se ve junto al campo email

#### Scenario: Campo desconocido
- **WHEN** el registro responde 422 con `field: 'body'`
- **THEN** el `detail` se ve en una alerta general del formulario

### Requirement: Perfil propio
La ruta `/mi-cuenta` SHALL mostrar, para cualquier usuario con sesión, su nombre, apellido, email y celular y sus roles por nombre visible, con email y roles de solo lectura, a partir del usuario de la sesión sin pedidos adicionales.

#### Scenario: Cliente ve su perfil
- **WHEN** un `CLIENT` «Ana Gómez» con celular vacío abre `/mi-cuenta`
- **THEN** ve «Ana», «Gómez», «ana@example.com» sin campo editable de email, el rol «Cliente» y no se hizo ningún pedido a `/usuarios/me`

### Requirement: Edición del perfil
Guardar el perfil SHALL enviar `PATCH /api/v1/usuarios/me` solo con `nombre`, `apellido` y `celular` (textos sin espacios al borde, `celular` vacío como `null`, nunca `null` en nombre ni apellido) y, con 200, SHALL actualizar los datos de la sesión conservando sus roles y notificar «Datos guardados».

#### Scenario: Cambio de nombre
- **WHEN** un `ADMIN` cambia el nombre a « Analía » y pulsa «Guardar cambios», y el backend responde 200 con `nombre: 'Analía'`
- **THEN** el backend recibe `{"nombre":"Analía","apellido":"Gómez","celular":null}`, el panel lateral muestra «Analía», la sesión conserva el rol `ADMIN` y se ve «Datos guardados»

#### Scenario: Validación del perfil
- **WHEN** el apellido queda vacío y se pulsa «Guardar cambios»
- **THEN** se ve «Ingresá tu apellido» y no se hace ningún pedido

#### Scenario: Error del servidor al guardar
- **WHEN** el `PATCH` responde 503
- **THEN** se ve una alerta con el `detail`, los valores editados se conservan y la sesión no cambia

### Requirement: Cerrar todas las sesiones
«Mi cuenta» SHALL ofrecer «Cerrar todas las sesiones», que pide confirmación y, al confirmar, llama `POST /api/v1/auth/logout-all`; responda lo que responda, SHALL dejar la sesión local `anonima` como un cierre voluntario. Cancelar no SHALL hacer ningún pedido.

#### Scenario: Confirmar
- **WHEN** un `CLIENT` en `/mi-cuenta` pulsa «Cerrar todas las sesiones» y confirma, y el backend responde 204
- **THEN** el backend recibió un `POST /auth/logout-all` con `Authorization: Bearer A1`, la sesión queda `anonima` y la URL pasa a `/catalogo`

#### Scenario: Cancelar
- **WHEN** el usuario abre la confirmación y pulsa «Cancelar»
- **THEN** no se hace ningún pedido y la sesión sigue `autenticada`

#### Scenario: Backend caído
- **WHEN** confirma y `POST /auth/logout-all` falla sin respuesta
- **THEN** la sesión queda `anonima` igual y la URL pasa a `/catalogo`

### Requirement: Cerrar sesión desde Mi cuenta
La tarjeta «Sesiones» de «Mi cuenta» SHALL ofrecer, además de «Cerrar todas las sesiones», un botón «Cerrar sesión» que cierra solo la sesión de este dispositivo sin pedir confirmación. SHALL usar el mismo cierre que el pie del panel lateral (`useCerrarSesion`: `POST /api/v1/auth/logout` y, responda lo que responda, sesión local `anonima` con motivo `logout`), por lo que la URL pasa a `/catalogo`. El carrito persistido no se toca. No SHALL llamar a `POST /auth/logout-all`.

#### Scenario: Cerrar sesión en este dispositivo
- **WHEN** un `CLIENT` en `/mi-cuenta` pulsa «Cerrar sesión»
- **THEN** el backend recibió un `POST /auth/logout` con `Authorization: Bearer A1` (y ningún `logout-all`), no apareció ningún diálogo, la sesión queda `anonima` y la URL pasa a `/catalogo`

#### Scenario: Backend caído al cerrar sesión
- **WHEN** pulsa «Cerrar sesión» y `POST /auth/logout` falla sin respuesta
- **THEN** la sesión queda `anonima` igual y la URL pasa a `/catalogo`

#### Scenario: Doble clic
- **WHEN** pulsa «Cerrar sesión» dos veces seguidas
- **THEN** se hace un solo `POST /auth/logout`

### Requirement: Accesibilidad de las pantallas de cuenta
Las pantallas de ingreso, registro y perfil SHALL tener un encabezado de nivel 1, campos con etiqueta visible, errores asociados a su campo (`aria-invalid`, `aria-describedby`), alertas con `role="alert"`, autocompletado (`email`, `current-password`, `new-password`, `given-name`, `family-name`, `tel`) y ninguna violación de axe.

#### Scenario: Formulario de registro con errores
- **WHEN** se envía el registro vacío
- **THEN** cada campo con error tiene `aria-invalid="true"` y su mensaje asociado, y axe no reporta violaciones

#### Scenario: Autocompletado del ingreso
- **WHEN** se abre `/ingresar`
- **THEN** «Email» tiene `autocomplete="email"` y «Contraseña» tiene `autocomplete="current-password"` y `type="password"`
