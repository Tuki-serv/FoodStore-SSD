## ADDED Requirements

### Requirement: Shell alimentado por la sesión
El shell SHALL mostrar la navegación de los roles de la sesión y, con sesión, el pie del panel con el nombre y apellido del usuario, su rol principal (el primero presente en el orden `ADMIN`, `PEDIDOS`, `STOCK`, `CLIENT`) y el botón «Cerrar sesión». Sin sesión SHALL mostrar la variante «sin sesión», sin pie.

#### Scenario: Administradora con sesión
- **WHEN** la sesión es de Ana Gómez con roles `CLIENT` y `ADMIN`
- **THEN** la navegación incluye el grupo «Administración» con cinco ítems y el pie muestra «Ana Gómez», «ADMIN» y el botón «Cerrar sesión»

#### Scenario: Visitante anónimo
- **WHEN** la sesión está `anonima`
- **THEN** la navegación muestra Catálogo, Ingresar y Registrarse, y no hay pie de usuario

### Requirement: Cerrar sesión desde el panel
Activar «Cerrar sesión» en el pie del panel SHALL cerrar la sesión (spec `frontend-session`) y llevar a `/catalogo`; mientras el cierre está en curso el botón no SHALL disparar un segundo cierre.

#### Scenario: Cerrar sesión
- **WHEN** un usuario con sesión activa «Cerrar sesión»
- **THEN** se hace un `POST /auth/logout`, la URL pasa a `/catalogo` y el pie de usuario desaparece

#### Scenario: Doble clic
- **WHEN** el usuario activa «Cerrar sesión» dos veces seguidas
- **THEN** se hace un solo `POST /auth/logout`

## REMOVED Requirements

### Requirement: Shell sin sesión hasta que exista autenticación
**Reason**: C-13b agrega la sesión; el shell ya no queda fijo en la variante anónima.
**Migration**: Reemplazado por «Shell alimentado por la sesión» (este delta); los roles y el usuario llegan desde la sesión de `frontend-session`.

### Requirement: Rutas sin control de acceso en el scaffold
**Reason**: C-13b agrega los guards por rol.
**Migration**: El acceso por ruta lo define la spec `frontend-route-guards` (tabla de acceso, redirección a `/ingresar`, página «Sin permiso»).
