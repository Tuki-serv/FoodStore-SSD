# frontend-app-shell Specification

## Purpose
Define el shell de la aplicación web de Food Store: el panel lateral de navegación de toda la app (DD-25, design system Revision 2) con sus secciones por rol, su comportamiento en desktop y mobile, el mapa de rutas con dueños y las páginas 404 y de error.

## Requirements

### Requirement: Panel lateral como navegación principal
Toda página de la aplicación, salvo la página de error genérica, SHALL mostrarse dentro de un shell con un panel lateral izquierdo que contiene el logo, la navegación principal (landmark `navigation` con nombre «Principal») y, con sesión, el pie con el usuario. No SHALL existir una barra de navegación superior en desktop. El logo SHALL ser el del design system vigente (isotipo y wordmark), con nombre accesible «Food Store» y sin rótulos de provisorio («LOGO PROVISIONAL», «(TBD)»); con el panel colapsado SHALL verse solo el isotipo.

#### Scenario: Arranque del shell
- **WHEN** un visitante abre la aplicación en `/`
- **THEN** ve el panel lateral con la navegación «Principal» y el contenido de Catálogo en la región principal

#### Scenario: Página actual marcada
- **WHEN** el visitante está en `/catalogo`
- **THEN** el ítem «Catálogo» tiene `aria-current="page"` y ningún otro ítem lo tiene

#### Scenario: Logo sin rótulo provisorio
- **WHEN** se renderiza el shell en cualquier ruta
- **THEN** el logo tiene nombre accesible «Food Store» y ningún texto visible del shell contiene «PROVISIONAL» ni «(TBD)»

#### Scenario: Isotipo con el panel colapsado
- **WHEN** el usuario colapsa el panel en desktop
- **THEN** el encabezado del panel muestra solo el isotipo, que conserva el nombre accesible «Food Store»

### Requirement: Secciones de navegación por rol
La navegación SHALL derivarse de los roles de la sesión: sin sesión → Catálogo, Ingresar, Registrarse; `CLIENT` → Catálogo, Carrito, Mis pedidos, Direcciones, Mi cuenta; `PEDIDOS` → las de `CLIENT` + Gestión de pedidos; `ADMIN` → todas las anteriores (salvo Ingresar y Registrarse) + el grupo «Administración».

#### Scenario: Sin sesión
- **WHEN** se calculan las secciones para una sesión sin roles
- **THEN** son, en orden, Catálogo, Ingresar y Registrarse, sin grupo «Administración»

#### Scenario: Cliente
- **WHEN** se calculan las secciones para `CLIENT`
- **THEN** son, en orden, Catálogo, Carrito, Mis pedidos, Direcciones y Mi cuenta

#### Scenario: Gestor de pedidos
- **WHEN** se calculan las secciones para `PEDIDOS`
- **THEN** son las de `CLIENT` seguidas de Gestión de pedidos

#### Scenario: Administrador
- **WHEN** se calculan las secciones para `ADMIN`
- **THEN** son las de `PEDIDOS` seguidas del grupo «Administración» con Categorías, Ingredientes, Productos y stock, Usuarios y Dashboard, en ese orden

### Requirement: Unión de secciones con varios roles
Con varios roles la navegación SHALL mostrar la unión de las secciones de cada rol, sin duplicados y en el orden canónico. Un rol desconocido para la UI (por ejemplo `COCINA`, fuera hasta decidir PA-07) no SHALL agregar secciones.

#### Scenario: Cliente y gestor de pedidos
- **WHEN** se calculan las secciones para `CLIENT` + `PEDIDOS`
- **THEN** son las mismas que para `PEDIDOS`, cada una una sola vez

#### Scenario: Rol no contemplado
- **WHEN** se calculan las secciones para `CLIENT` + `COCINA`
- **THEN** son las mismas que para `CLIENT`

### Requirement: Secciones del gestor de stock
`STOCK` SHALL ver las secciones de `CLIENT` más el grupo «Administración» con un único ítem, Productos y stock. Un grupo SHALL mostrarse solo si contiene al menos un ítem visible. (Confirmado por el usuario el 2026-11-15, DD-25.)

#### Scenario: Gestor de stock
- **WHEN** se calculan las secciones para `STOCK`
- **THEN** son las de `CLIENT` seguidas del grupo «Administración» con solo Productos y stock

#### Scenario: Administrador y gestor de stock
- **WHEN** se calculan las secciones para `ADMIN` + `STOCK`
- **THEN** son las mismas que para `ADMIN`

### Requirement: Panel colapsable en desktop
Con ventana de 1024 px o más, el panel SHALL poder colapsarse a solo íconos y expandirse con un botón del encabezado cuyo nombre accesible y `aria-expanded` reflejen el estado. Colapsado, cada ítem SHALL conservar su nombre accesible y mostrar la etiqueta como tooltip.

#### Scenario: Colapsar
- **WHEN** el usuario activa «Colapsar panel» en desktop
- **THEN** el panel muestra solo íconos, el botón pasa a «Expandir panel» con `aria-expanded="false"` y cada enlace conserva su nombre accesible

#### Scenario: Expandir
- **WHEN** el usuario activa «Expandir panel»
- **THEN** el panel vuelve a mostrar las etiquetas y el botón vuelve a «Colapsar panel» con `aria-expanded="true"`

### Requirement: Preferencia de colapso persistida sin animar la carga
La preferencia colapsado/expandido SHALL persistir entre recargas en el almacenamiento del navegador. Al cargar, el estado guardado SHALL aplicarse desde el primer render sin transición; las transiciones SHALL habilitarse recién después del primer render. Si el almacenamiento falla, el panel SHALL arrancar expandido.

#### Scenario: Recarga con panel colapsado
- **WHEN** el usuario colapsó el panel y recarga la página
- **THEN** el panel aparece colapsado desde el primer render, sin transiciones habilitadas en ese render

#### Scenario: Almacenamiento no disponible
- **WHEN** leer el almacenamiento del navegador lanza un error
- **THEN** el panel arranca expandido y la aplicación funciona

### Requirement: Drawer de navegación en mobile
Con ventana menor a 1024 px, el panel SHALL ocultarse y una barra superior SHALL mostrar el botón «Abrir menú» y el logo. Abrir el menú SHALL mostrar el panel como drawer sobre el contenido con un fondo (scrim) y mover el foco al botón «Cerrar menú». El estado abierto no SHALL persistirse.

#### Scenario: Abrir el drawer
- **WHEN** el usuario activa «Abrir menú» en mobile
- **THEN** el panel queda visible, «Abrir menú» tiene `aria-expanded="true"` y el foco está en «Cerrar menú»

#### Scenario: Recarga con drawer abierto
- **WHEN** el usuario recarga la página con el drawer abierto
- **THEN** la página aparece con el drawer cerrado

### Requirement: Cierre del drawer
El drawer SHALL cerrarse con el botón «Cerrar menú», con un clic en el scrim, con la tecla Escape, al navegar a otra sección y al pasar a ancho desktop. Al cerrarse por botón, scrim o Escape, el foco SHALL volver a «Abrir menú».

#### Scenario: Escape
- **WHEN** el drawer está abierto y el usuario presiona Escape
- **THEN** el drawer se cierra y el foco vuelve a «Abrir menú»

#### Scenario: Scrim
- **WHEN** el drawer está abierto y el usuario hace clic en el scrim
- **THEN** el drawer se cierra

#### Scenario: Navegar
- **WHEN** el drawer está abierto y el usuario elige «Ingresar»
- **THEN** se muestra la página de Ingresar y el drawer está cerrado

### Requirement: Mapa de rutas con dueño
Cada sección de la navegación SHALL tener una ruta propia en español (`/catalogo`, `/ingresar`, `/registrarse`, `/carrito`, `/mis-pedidos`, `/direcciones`, `/mi-cuenta`, `/gestion-pedidos`, `/admin/categorias`, `/admin/ingredientes`, `/admin/productos`, `/admin/usuarios`, `/admin/dashboard`) y `/` SHALL redirigir a `/catalogo`. Cada ruta aún sin pantalla SHALL declarar el change que la implementa.

#### Scenario: Toda sección tiene ruta
- **WHEN** se recorren las secciones de todos los roles
- **THEN** cada una apunta a una ruta declarada en el mapa de rutas

#### Scenario: Página provisoria
- **WHEN** una ruta futura sin pantalla (por ejemplo, de un change de Fase 2) se declara en el mapa con su dueño
- **THEN** muestra, dentro del shell, un encabezado con su título y el aviso de que la sección está en preparación, y el dueño queda declarado en el mapa de rutas, no en el texto visible

#### Scenario: Ninguna sección provisoria
- **WHEN** un usuario con los roles `CLIENT`, `PEDIDOS`, `STOCK` y `ADMIN` abre cada ruta del mapa
- **THEN** ninguna muestra el aviso de sección en preparación

#### Scenario: Dashboard ya no es provisoria
- **WHEN** un `ADMIN` abre `/admin/dashboard`
- **THEN** ve la pantalla «Dashboard» con las tarjetas KPI y no el aviso de sección en preparación

#### Scenario: Mis pedidos ya no es provisoria
- **WHEN** un `CLIENT` abre `/mis-pedidos`
- **THEN** ve la pantalla «Mis pedidos» con sus pedidos y no el aviso de sección en preparación

#### Scenario: Usuarios ya no es provisoria
- **WHEN** un `ADMIN` abre `/admin/usuarios`
- **THEN** ve la pantalla «Usuarios» con el listado de usuarios y no el aviso de sección en preparación

#### Scenario: Raíz
- **WHEN** el visitante abre `/`
- **THEN** la URL pasa a `/catalogo`

### Requirement: Página no encontrada
Una URL que no corresponde a ninguna ruta SHALL mostrar, dentro del shell, una página «Página no encontrada» con la ruta pedida y un enlace a Catálogo.

#### Scenario: Ruta inexistente
- **WHEN** el visitante abre `/no-existe`
- **THEN** ve el encabezado «Página no encontrada», el texto `/no-existe` y un enlace «Ir al catálogo» que lleva a `/catalogo`

### Requirement: Página de error genérica
Si el render de una ruta falla, la aplicación SHALL mostrar una página de error a pantalla completa, fuera del shell, con un mensaje no técnico, un botón «Reintentar» que recarga la página y un enlace «Volver al inicio». No SHALL mostrar trazas ni detalles internos.

#### Scenario: Error de render
- **WHEN** una página lanza un error al renderizar
- **THEN** se ve el encabezado «Algo salió mal», el botón «Reintentar» y el enlace «Volver al inicio», y no se ve el mensaje del error

#### Scenario: Reintentar
- **WHEN** el usuario activa «Reintentar» en la página de error
- **THEN** la página se recarga

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

### Requirement: Drawer mobile como diálogo modal
Mientras está abierto en mobile, el drawer SHALL exponerse como diálogo modal (`role="dialog"`, `aria-modal="true"` y un nombre accesible), el foco del teclado SHALL quedar atrapado dentro del drawer, y el contenido detrás (barra superior y página) SHALL quedar inerte para el teclado, el puntero y las tecnologías asistivas. Cerrado, o en desktop, el panel no SHALL exponerse como diálogo ni dejar contenido inerte.

#### Scenario: Rol y nombre del diálogo
- **WHEN** el drawer está abierto en mobile
- **THEN** existe un diálogo modal con nombre accesible que contiene la navegación y el botón «Cerrar menú»

#### Scenario: Tab no sale del drawer
- **WHEN** el foco está en el último elemento enfocable del drawer y el usuario presiona Tab
- **THEN** el foco pasa al primer elemento enfocable del drawer

#### Scenario: Shift+Tab no sale del drawer
- **WHEN** el foco está en «Cerrar menú» (primer elemento) y el usuario presiona Shift+Tab
- **THEN** el foco pasa al último elemento enfocable del drawer

#### Scenario: Contenido de fondo inerte
- **WHEN** el drawer está abierto en mobile
- **THEN** la región principal de la página está marcada como inerte y sus controles no reciben foco

#### Scenario: Cerrado libera el fondo
- **WHEN** el usuario cierra el drawer
- **THEN** la región principal deja de estar inerte y no queda ningún diálogo en el árbol de accesibilidad

#### Scenario: Desktop sin diálogo
- **WHEN** la ventana mide 1024 px o más
- **THEN** el panel lateral es navegación sin rol de diálogo y nada de la página está inerte

#### Scenario: Sin violaciones de accesibilidad
- **WHEN** se analiza el shell con el drawer abierto con una herramienta automática de accesibilidad
- **THEN** no se detectan violaciones
