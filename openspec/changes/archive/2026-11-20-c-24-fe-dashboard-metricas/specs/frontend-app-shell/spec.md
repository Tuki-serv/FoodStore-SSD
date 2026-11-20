# Spec Delta — frontend-app-shell

## MODIFIED Requirements

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
