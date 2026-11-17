## Purpose

Define el control de acceso por ruta del frontend: qué rutas son públicas, cuáles exigen sesión o ciertos roles, qué ve el usuario mientras la sesión se verifica y a dónde va cuando no puede entrar. Es una ayuda de navegación: la autorización real la decide el backend en cada pedido.

## ADDED Requirements

### Requirement: Tabla de acceso por ruta
Cada ruta del mapa SHALL declarar su acceso en una única tabla: pública (`/catalogo`), solo sin sesión (`/ingresar`, `/registrarse`), con sesión (`/carrito`, `/mis-pedidos`, `/direcciones`, `/mi-cuenta`) o por roles (`/gestion-pedidos`: `PEDIDOS`, `ADMIN`; `/admin/productos`: `ADMIN`, `STOCK`; el resto de `/admin/*`: `ADMIN`).

#### Scenario: Toda ruta tiene acceso declarado
- **WHEN** se recorre el mapa de rutas
- **THEN** cada ruta tiene exactamente un acceso declarado y coincide con la lista de este requisito

### Requirement: Navegación coherente con el acceso
Un ítem de la navegación SHALL mostrarse para unos roles si y solo si la ruta a la que apunta es accesible con esos roles, salvo las rutas públicas, que se muestran siempre.

#### Scenario: Ítems visibles y rutas accesibles
- **WHEN** se calculan las secciones para cada combinación de roles de la spec `frontend-app-shell`
- **THEN** todo ítem visible apunta a una ruta accesible con esos roles, y ninguna ruta accesible con sesión queda sin su ítem

### Requirement: Espera mientras se verifica la sesión
Mientras la sesión está en `verificando`, la aplicación SHALL mostrar una pantalla de carga con un estado accesible («Cargando…», rol `status`) en lugar de cualquier ruta, sin redirigir ni mostrar contenido que dependa de la sesión.

#### Scenario: Recarga en una ruta protegida
- **WHEN** el usuario recarga `/mis-pedidos` y la rehidratación todavía no respondió
- **THEN** ve la pantalla de carga y la URL sigue siendo `/mis-pedidos`

#### Scenario: Sesión recuperada
- **WHEN** la rehidratación termina con un usuario `CLIENT`
- **THEN** se muestra la página «Mis pedidos» sin haber pasado por `/ingresar`

### Requirement: Ruta con sesión sin sesión
Un visitante anónimo que abre una ruta con sesión o por roles SHALL ser llevado a `/ingresar`, reemplazando la entrada del historial y recordando la ruta pedida (path, query y hash) para volver a ella tras iniciar sesión.

#### Scenario: Anónimo en Mis pedidos
- **WHEN** un visitante anónimo abre `/mis-pedidos?page=2`
- **THEN** la URL pasa a `/ingresar` y la ruta recordada es `/mis-pedidos?page=2`

#### Scenario: Anónimo en administración
- **WHEN** un visitante anónimo abre `/admin/usuarios`
- **THEN** la URL pasa a `/ingresar`

### Requirement: Rol insuficiente
Un usuario con sesión que abre una ruta por roles sin tener ninguno de ellos SHALL ver, dentro del shell y sin cambiar la URL, el encabezado «No tenés acceso a esta sección», un texto no técnico y un enlace «Ir al catálogo».

#### Scenario: Cliente en administración
- **WHEN** un usuario `CLIENT` abre `/admin/usuarios`
- **THEN** la URL sigue siendo `/admin/usuarios`, ve el encabezado «No tenés acceso a esta sección» (mockup aprobado) y un enlace «Ir al catálogo» a `/catalogo`

#### Scenario: Gestor de stock en productos
- **WHEN** un usuario `STOCK` abre `/admin/productos`
- **THEN** ve la página «Productos y stock»

#### Scenario: Gestor de stock en categorías
- **WHEN** un usuario `STOCK` abre `/admin/categorias`
- **THEN** ve el encabezado «No tenés acceso a esta sección»

### Requirement: Rutas solo para visitantes sin sesión
Un usuario con sesión que abre `/ingresar` o `/registrarse` SHALL ser llevado, reemplazando la entrada del historial, a la ruta recordada si existe y es accesible, o a `/catalogo` en caso contrario.

#### Scenario: Usuario con sesión en Ingresar
- **WHEN** un usuario `CLIENT` abre `/ingresar` sin ruta recordada
- **THEN** la URL pasa a `/catalogo`

#### Scenario: Vuelta al destino tras iniciar sesión
- **WHEN** un visitante fue llevado a `/ingresar` desde `/direcciones` y la sesión pasa a `autenticada` como `CLIENT`
- **THEN** la URL pasa a `/direcciones`

### Requirement: Sesión perdida en una ruta protegida
Si la sesión pasa a `anonima` mientras el usuario está en una ruta con sesión o por roles (logout o vencimiento), SHALL aplicarse la misma regla que para un visitante anónimo, salvo tras un cierre de sesión voluntario, que SHALL llevar a `/catalogo`.

#### Scenario: Vencimiento
- **WHEN** un `CLIENT` está en `/mis-pedidos` y la renovación responde 401
- **THEN** la URL pasa a `/ingresar` con `/mis-pedidos` como ruta recordada

#### Scenario: Cierre de sesión voluntario
- **WHEN** un `ADMIN` en `/admin/dashboard` activa «Cerrar sesión»
- **THEN** la URL pasa a `/catalogo` y la navegación muestra las secciones sin sesión

### Requirement: Rutas públicas sin espera de roles
Las rutas públicas y la página no encontrada SHALL mostrarse a cualquier visitante, con o sin sesión, una vez terminada la verificación de la sesión.

#### Scenario: Catálogo anónimo
- **WHEN** un visitante anónimo abre `/catalogo`
- **THEN** ve la página «Catálogo»

#### Scenario: Ruta inexistente con sesión
- **WHEN** un usuario `ADMIN` abre `/no-existe`
- **THEN** ve «Página no encontrada» dentro del shell con la navegación de `ADMIN`
