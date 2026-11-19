# Spec Delta — user-profile

## Purpose

Define el contrato backend del perfil propio: qué datos puede cambiar un usuario autenticado sobre sí mismo y cuál es la única lectura del usuario autenticado, para que no haya dos endpoints con la misma responsabilidad.

## ADDED Requirements

### Requirement: Actualización del perfil propio
`PATCH /api/v1/usuarios/me` con Bearer válido SHALL actualizar solo `nombre`, `apellido` y `celular` del usuario autenticado y responder 200 con `id`, `nombre`, `apellido`, `email` y `celular`. Los campos omitidos no SHALL cambiar y el cuerpo no SHALL poder modificar email, contraseña ni roles.

#### Scenario: Cambio de nombre
- **WHEN** un `CLIENT` envía `{"nombre": "Analía"}`
- **THEN** recibe 200 con `nombre` `Analía` y su `apellido`, `email` y roles no cambian

#### Scenario: Intento de cambiar roles o email
- **WHEN** un `CLIENT` envía `{"roles_codigos": ["ADMIN"], "email": "otro@example.com"}`
- **THEN** recibe 200, su email sigue igual y sigue teniendo solo el rol `CLIENT`

#### Scenario: Sin token
- **WHEN** se envía el `PATCH` sin `Authorization`
- **THEN** recibe 401

#### Scenario: Textos recortados
- **WHEN** un `CLIENT` envía `{"nombre": "  Analía  "}`
- **THEN** recibe 200 con `nombre` `Analía`

### Requirement: Nombre y apellido válidos en el perfil
`PATCH /api/v1/usuarios/me` SHALL rechazar con 422 `VALIDATION_ERROR` y `field` igual al campo un `nombre` o `apellido` vacío después de recortar espacios o enviado explícitamente como `null`, sin modificar al usuario. Omitir el campo SHALL seguir significando «no cambiar» y `celular: null` SHALL seguir borrando el celular.

#### Scenario: Nombre nulo
- **WHEN** un `CLIENT` envía `{"nombre": null}`
- **THEN** recibe 422 `VALIDATION_ERROR` con `field` `nombre` y su nombre no cambia

#### Scenario: Apellido en blanco
- **WHEN** un `CLIENT` envía `{"apellido": "   "}`
- **THEN** recibe 422 `VALIDATION_ERROR` con `field` `apellido` y su apellido no cambia

#### Scenario: Celular nulo
- **WHEN** un `CLIENT` con celular `2610000000` envía `{"celular": null}`
- **THEN** recibe 200 con `celular` nulo

### Requirement: Lectura única del usuario autenticado
La lectura del usuario autenticado SHALL hacerse solo con `GET /api/v1/auth/me`; `GET /api/v1/usuarios/me` no SHALL existir como operación (responde 405, porque la ruta conserva el `PATCH`).

#### Scenario: GET del duplicado retirado
- **WHEN** un usuario autenticado pide `GET /api/v1/usuarios/me`
- **THEN** recibe 405

#### Scenario: Lectura vigente
- **WHEN** el mismo usuario pide `GET /api/v1/auth/me`
- **THEN** recibe 200 con sus datos y sus roles
