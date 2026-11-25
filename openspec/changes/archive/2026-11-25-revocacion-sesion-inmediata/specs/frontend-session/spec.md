# Spec Delta — frontend-session

## ADDED Requirements

### Requirement: Revalidación de la sesión al navegar y al volver a la pestaña
Con la sesión `autenticada`, el frontend SHALL verificar la sesión con `GET /auth/me` cuando cambia la ruta y cuando la pestaña vuelve a estar visible o recupera el foco, para enterarse de un cierre hecho desde otro dispositivo aunque la pantalla no pida datos al backend. Un 401 sigue el flujo de renovación; si la renovación falla, la sesión pasa a `anonima` por vencimiento. Errores de red o 5xx no SHALL cerrar la sesión.

#### Scenario: Cambio de ruta con la sesión cerrada en otro dispositivo
- **WHEN** un `CLIENT` autenticado hace más de 15 segundos está en `/carrito`, navega a `/mis-pedidos`, `GET /auth/me` responde 401 y `POST /auth/refresh` responde 401
- **THEN** la sesión queda `anonima` y la URL pasa a `/ingresar` con `/mis-pedidos` como ruta recordada

#### Scenario: Volver a la pestaña con la sesión cerrada en otro dispositivo
- **WHEN** un `CLIENT` autenticado en `/carrito` cambia de pestaña, vuelve a ella pasados más de 15 segundos desde la última verificación, `GET /auth/me` responde 401 y la renovación responde 401
- **THEN** la sesión queda `anonima` y la URL pasa a `/ingresar` con `/carrito` como ruta recordada

#### Scenario: Sesión vigente
- **WHEN** un `CLIENT` autenticado hace más de 15 segundos navega a otra ruta y `GET /auth/me` responde 200
- **THEN** la sesión sigue `autenticada` y el usuario de la sesión queda con los datos y roles de esa respuesta

#### Scenario: Backend caído
- **WHEN** un `CLIENT` autenticado vuelve a la pestaña y `GET /auth/me` falla sin respuesta o con 503
- **THEN** la sesión sigue `autenticada`

#### Scenario: Sin sesión no se verifica
- **WHEN** un visitante `anonima` navega entre rutas públicas y cambia de pestaña
- **THEN** no se hace ningún pedido a `GET /auth/me`

### Requirement: Revalidación acotada
La revalidación SHALL hacer como máximo un `GET /auth/me` en vuelo y como máximo uno cada 15 segundos por pestaña, sumando cambios de ruta, foco y visibilidad. Abrir la sesión (login o rehidratación, que ya consultan `GET /auth/me`) SHALL contar como la última verificación. Una pestaña oculta no SHALL verificar.

#### Scenario: Ráfaga de eventos
- **WHEN** un `CLIENT` autenticado hace más de 15 segundos, en menos de 15 segundos navega tres veces, la ventana recupera el foco y la pestaña vuelve a ser visible
- **THEN** se hace un solo `GET /auth/me`

#### Scenario: Después del intervalo mínimo
- **WHEN** un `CLIENT` autenticado hace más de 15 segundos navega, la verificación responde 200 y vuelve a navegar 16 segundos después
- **THEN** se hacen dos `GET /auth/me` en total

#### Scenario: Sin verificación al abrir la sesión
- **WHEN** la app termina de rehidratar una sesión, muestra la primera ruta y antes de 15 segundos el usuario navega a otra
- **THEN** no se hace ningún `GET /auth/me` además del de la rehidratación

#### Scenario: Revalidación y renovación concurrentes
- **WHEN** la verificación y otro pedido de la pantalla reciben 401 al mismo tiempo
- **THEN** se hace un solo `POST /auth/refresh`

## MODIFIED Requirements

### Requirement: Sesión perdida por vencimiento
Cuando la sesión pasa de `autenticada` a `anonima` porque la renovación falló, el frontend SHALL descartar de la caché los datos del servidor obtenidos con la sesión anterior, igual que al cerrar sesión, y SHALL volver a pedir como anónimo las consultas de datos públicos que hayan quedado en error.

#### Scenario: Refresh rechazado durante el uso
- **WHEN** la sesión está `autenticada`, hay pedidos privados en caché y una renovación responde 401
- **THEN** la sesión queda `anonima` y esos datos ya no están en la caché

#### Scenario: Catálogo con la sesión cerrada en otro dispositivo
- **WHEN** un `CLIENT` autenticado está en `/catalogo`, `GET /productos` responde 401 porque su sesión se cerró y la renovación responde 401
- **THEN** la sesión queda `anonima`, `GET /productos` se vuelve a pedir sin `Authorization` y el catálogo se muestra
