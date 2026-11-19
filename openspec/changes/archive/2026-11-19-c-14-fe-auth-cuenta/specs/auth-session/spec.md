# Spec Delta — auth-session

## Purpose

Agrega al login la búsqueda del usuario por email sin distinguir mayúsculas ni espacios al borde, coherente con el email normalizado del alta (DU-4 de C-14).

## ADDED Requirements

### Requirement: Login con email insensible a mayúsculas
`POST /api/v1/auth/login` SHALL buscar al usuario por el `username` recibido sin espacios al borde y en minúsculas. Las demás reglas del login (credenciales inválidas, tiempo constante, límite por IP) no cambian.

#### Scenario: Email con mayúsculas y espacios
- **WHEN** el usuario activo `ana@example.com` hace login con `username` ` Ana@Example.com ` y su contraseña correcta
- **THEN** recibe 200 con `access_token` y se abre una sesión de ese usuario

#### Scenario: Contraseña incorrecta con email en mayúsculas
- **WHEN** hace login con `username` `ANA@EXAMPLE.COM` y una contraseña incorrecta
- **THEN** recibe 401 con «Credenciales incorrectas» y no se crea ninguna sesión
