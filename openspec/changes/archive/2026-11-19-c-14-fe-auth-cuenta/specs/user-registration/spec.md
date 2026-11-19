# Spec Delta — user-registration

## Purpose

Agrega al alta de usuarios la normalización del email y la obligatoriedad real de nombre y apellido, para que un mismo email no dependa de mayúsculas o espacios y no se creen usuarios sin nombre (DU-3, DU-4 de C-14).

## ADDED Requirements

### Requirement: Email normalizado en el alta
El alta de usuarios (registro público y alta por un ADMIN) SHALL guardar el email sin espacios al borde y en minúsculas, y SHALL detectar el email duplicado comparando ya normalizado.

#### Scenario: Registro con mayúsculas y espacios
- **WHEN** se registra ` Nueva@Example.COM ` con datos válidos
- **THEN** recibe 201 con `email` igual a `nueva@example.com` y el usuario guardado tiene ese email

#### Scenario: Duplicado que solo difiere en mayúsculas
- **WHEN** existe un usuario activo `nueva@example.com` y se registra `NUEVA@example.com`
- **THEN** recibe 409 y la cantidad de usuarios con ese email no cambia

### Requirement: Nombre y apellido obligatorios en el alta
El alta de usuarios SHALL recortar los espacios al borde de `nombre` y `apellido` y SHALL rechazar con 422 `VALIDATION_ERROR`, con `field` igual al campo, un `nombre` o `apellido` vacío después de recortar, sin crear el usuario.

#### Scenario: Nombre en blanco
- **WHEN** se registra un usuario con `nombre` `"   "`
- **THEN** recibe 422 `VALIDATION_ERROR` con `field` `nombre` y no se crea ningún usuario

#### Scenario: Apellido vacío
- **WHEN** se registra un usuario con `apellido` `""`
- **THEN** recibe 422 `VALIDATION_ERROR` con `field` `apellido` y no se crea ningún usuario

#### Scenario: Textos recortados
- **WHEN** se registra un usuario con `nombre` `" Ana "` y `apellido` `" Gómez "`
- **THEN** recibe 201 con `nombre` `Ana` y `apellido` `Gómez`
