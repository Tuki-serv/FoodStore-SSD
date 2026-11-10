# Spec Delta

## Purpose

Define el alta de usuarios: el registro público de clientes con rol `CLIENT` automático y el rechazo de emails ya registrados con un conflicto, tanto en el registro público como en el alta desde el panel de administración.

## ADDED Requirements

### Requirement: Registro público de clientes
`POST /api/v1/auth/register` con datos válidos SHALL crear un usuario activo con el rol `CLIENT` asignado automáticamente y SHALL responder 201 con `id`, `nombre`, `apellido`, `email` y `celular`, sin la contraseña ni su hash. El registro no SHALL abrir una sesión.

#### Scenario: Registro exitoso
- **WHEN** se registra `nuevo@example.com` con una contraseña de 8 o más caracteres
- **THEN** recibe 201 con `email` igual a `nuevo@example.com`, sin `password` ni `password_hash`, y el usuario creado tiene exactamente el rol `CLIENT`

#### Scenario: El registro no abre sesión
- **WHEN** se registra un usuario nuevo
- **THEN** la respuesta no setea la cookie `refresh_token` y no existe ninguna sesión de ese usuario

### Requirement: Email duplicado responde 409
Crear un usuario con un email que ya pertenece a un usuario activo SHALL responder 409 con un `detail` que indique que el email ya está registrado, tanto en el registro público como en el alta por un ADMIN, sin crear el usuario. Un email de un usuario dado de baja SHALL poder reutilizarse.

#### Scenario: Registro con email existente
- **WHEN** se registra un email que ya pertenece a un usuario activo
- **THEN** recibe 409 con un `detail` que menciona que el email ya está registrado y la cantidad de usuarios con ese email no cambia

#### Scenario: Alta por ADMIN con email existente
- **WHEN** un ADMIN crea desde `POST /api/v1/admin/usuarios/createUser` un usuario con un email que ya pertenece a un usuario activo
- **THEN** recibe 409

#### Scenario: Email de un usuario dado de baja
- **WHEN** se registra el email de un usuario que fue dado de baja
- **THEN** recibe 201
