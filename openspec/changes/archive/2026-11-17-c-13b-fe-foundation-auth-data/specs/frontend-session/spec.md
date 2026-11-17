## Purpose

Define la sesión del usuario en el navegador: qué guarda el frontend de ella y dónde, cómo se recupera al abrir o recargar la app, de dónde salen los roles que usa la interfaz y cómo se abre, se cierra y se pierde.

## ADDED Requirements

### Requirement: Estado de la sesión
La sesión del frontend SHALL estar siempre en uno de tres estados: `verificando` (al arrancar, todavía no se sabe), `autenticada` (hay access y usuario) o `anonima` (no hay sesión). En `autenticada` SHALL exponer el usuario de `GET /auth/me`; en los otros dos, ningún usuario ni access.

#### Scenario: Arranque
- **WHEN** la aplicación se carga
- **THEN** la sesión está en `verificando` antes de recibir respuesta del backend

#### Scenario: Sesión establecida
- **WHEN** la rehidratación termina con éxito
- **THEN** la sesión está en `autenticada` con el usuario y sus roles

### Requirement: El access token vive solo en memoria
El access token SHALL guardarse solo en la memoria del frontend: no SHALL escribirse en `localStorage`, `sessionStorage`, cookies accesibles desde JS ni IndexedDB. Al recargar la página, la sesión SHALL recuperarse con la cookie del refresh (RN-AU-10, C-02 D3; sujeto a la decisión OQ-1 de C-13b).

#### Scenario: Sin rastro en el almacenamiento
- **WHEN** el usuario inicia sesión y se inspecciona el almacenamiento del navegador
- **THEN** no hay ninguna entrada que contenga el access token

#### Scenario: Recarga con sesión abierta
- **WHEN** el usuario con sesión recarga la página y la cookie del refresh sigue vigente
- **THEN** la sesión vuelve a `autenticada` sin pedirle credenciales

### Requirement: Rehidratación al arrancar
Al arrancar, el frontend SHALL hacer `POST /auth/refresh` y, si responde 200, `GET /auth/me` con el access nuevo, quedando en `autenticada`. Si la renovación responde 401, SHALL quedar en `anonima` sin mostrar error. La rehidratación SHALL hacerse una sola vez por carga de la página.

#### Scenario: Cookie vigente
- **WHEN** al arrancar `POST /auth/refresh` responde 200 y `GET /auth/me` responde el usuario con rol `CLIENT`
- **THEN** la sesión queda `autenticada` con ese usuario y el rol `CLIENT`

#### Scenario: Sin cookie o sesión cerrada
- **WHEN** al arrancar `POST /auth/refresh` responde 401
- **THEN** la sesión queda `anonima`, no se llama a `GET /auth/me` y no se muestra ningún error

#### Scenario: Montaje doble en desarrollo
- **WHEN** la aplicación se monta dos veces seguidas (modo estricto de React)
- **THEN** se hace un solo `POST /auth/refresh`

### Requirement: Rehidratación sin backend disponible
Si la rehidratación falla por un error de red o 5xx, la sesión SHALL quedar `anonima` y la aplicación SHALL seguir usable para las rutas públicas.

#### Scenario: Backend caído al arrancar
- **WHEN** al arrancar `POST /auth/refresh` falla sin respuesta
- **THEN** la sesión queda `anonima` y el catálogo se muestra

### Requirement: Roles de la interfaz desde GET /auth/me
Los roles que usa la interfaz (navegación y guards) SHALL tomarse solo de `roles[].codigo` de `GET /auth/me`. El frontend no SHALL decodificar el access token para obtener roles ni ningún otro dato. Los roles son informativos: el backend sigue autorizando cada pedido (DD-24).

#### Scenario: Usuario con varios roles
- **WHEN** `GET /auth/me` devuelve roles `[{codigo: "CLIENT"}, {codigo: "PEDIDOS"}]`
- **THEN** la sesión expone los roles `CLIENT` y `PEDIDOS`

### Requirement: Abrir sesión con un access token
El frontend SHALL ofrecer a las pantallas de acceso una operación que, dado el access recibido de `POST /auth/login`, lo guarde en la sesión, pida `GET /auth/me` y deje la sesión en `autenticada`. Si `GET /auth/me` falla, la sesión SHALL quedar `anonima` sin access.

#### Scenario: Login correcto
- **WHEN** se abre sesión con el access `A1` y `GET /auth/me` responde el usuario ADMIN
- **THEN** la sesión queda `autenticada` con `A1` y el rol `ADMIN`

#### Scenario: Usuario no recuperable
- **WHEN** se abre sesión con un access y `GET /auth/me` responde 404
- **THEN** la sesión queda `anonima` y no conserva el access

### Requirement: Cerrar sesión
Cerrar sesión SHALL llamar a `POST /auth/logout` (renovando el access si venció) y, responda lo que responda el backend, dejar la sesión `anonima` y descartar de la caché todos los datos del servidor obtenidos con la sesión anterior.

#### Scenario: Logout correcto
- **WHEN** el usuario cierra sesión y `POST /auth/logout` responde 204
- **THEN** la sesión queda `anonima` y una consulta privada hecha antes ya no está en la caché

#### Scenario: Logout con backend caído
- **WHEN** el usuario cierra sesión y `POST /auth/logout` falla sin respuesta
- **THEN** la sesión queda `anonima` igual

### Requirement: El carrito sobrevive al cierre de sesión
Cerrar sesión o perderla por vencimiento no SHALL vaciar el carrito ni borrar su copia persistida (CE-14).

#### Scenario: Logout con carrito
- **WHEN** el carrito tiene 2 líneas y el usuario cierra sesión
- **THEN** el carrito sigue con las mismas 2 líneas

### Requirement: Sesión perdida por vencimiento
Cuando la sesión pasa de `autenticada` a `anonima` porque la renovación falló, el frontend SHALL descartar de la caché los datos del servidor obtenidos con la sesión anterior, igual que al cerrar sesión.

#### Scenario: Refresh rechazado durante el uso
- **WHEN** la sesión está `autenticada`, hay pedidos privados en caché y una renovación responde 401
- **THEN** la sesión queda `anonima` y esos datos ya no están en la caché
