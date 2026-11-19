# Proposal — C-14 `fe-auth-cuenta`

## Why

La Épica 1 (US-001 registro, US-002 login, US-004 logout, US-005 perfil propio) no tiene pantallas: `/ingresar`, `/registrarse` y `/mi-cuenta` muestran la página provisoria (dueño `C-14` en `route-map.ts`). Sin login no se puede llegar a ninguna pantalla con sesión desde la app real; C-13b dejó toda la base (sesión en memoria, `abrirSesion`, guards con ruta recordada, `ApiError`, `useCerrarSesion`) esperando estas pantallas. Además, C-25a delegó a este change el retiro del `GET /usuarios/me` duplicado.

Observado en el repo (`dev`, 2026-11-19):

- `backend/app/modules/auth/router.py`: `POST /auth/register` (JSON `{nombre, apellido, email, celular?, password}`, 201 `UserPublic`, **no abre sesión**); `POST /auth/login` (form OAuth2 `username`/`password`, 200 `{access_token, token_type, expires_in}` + cookie `refresh_token`); `GET /auth/me`; `POST /auth/logout` y `POST /auth/logout-all` (Bearer, sin body, 204).
- Errores reales: login inválido → 401 `HTTP_401` «Credenciales incorrectas»; bloqueo → 429 `RATE_LIMIT_EXCEEDED` con `Retry-After`; email duplicado en registro → **409 `HTTP_409` con `field: null`** (no `field: 'email'`); validación Pydantic → 422 `VALIDATION_ERROR` con `field` = último elemento de `loc` (p. ej. `email`, `password`).
- **No existe un 409 en el login**: el «401/409/429» de CHANGES.md mezcla login y registro (el 409 es del registro).
- `backend/app/modules/usuarios/router.py`: siguen `GET /usuarios/me` (duplicado de `/auth/me`) y `PATCH /usuarios/me` con `UserUpdateClient {nombre?, apellido?, celular?}` → 200 `UserPublic` **sin roles**. No hay cambio de email ni de contraseña. `nombre: null` explícito llega a una columna NOT NULL (500); `""` se acepta, también en el registro.
- Email: `EmailStr` solo pasa a minúsculas el dominio y `UsuarioRepository.get_by_email` (`backend/app/modules/usuarios/repository.py:13`) compara exacto: quien se registró como `Ana@x.com` no puede ingresar con `ana@x.com`. El seed y las fixtures usan solo minúsculas.
- `backend/tests/support/rbac_matriz.py` marca `GET /usuarios/me` con dueño «C-14/C-25a (retiro)»; también lo usan `test_auth.py` (perfil), `test_contrato_rutas.py` y `test_exception_handlers.py` (401 sin token).
- Frontend: `abrirSesion`, `useCerrarSesion`, `cerrarTodasLasSesionesRemota`, `establecerUsuario`, `RUTAS.ingresar/registrarse/miCuenta` con acceso `anonima`/`anonima`/`sesion`, `@tanstack/react-form`, `shared/ui/campo`, `pedirConfirmacion` y `notificar` ya existen. `/auth/login` está excluida de la renovación por 401.

## What Changes

- **Página «Ingresar»** (`/ingresar`): formulario email + contraseña (TanStack Form), `POST /auth/login` como form OAuth2, `abrirSesion(access_token)`; mensajes por código: 401 → credenciales incorrectas (sin decir cuál), 429 → aviso de bloqueo con los minutos de espera de `retryAfter` y botón deshabilitado hasta que pase, red caída → aviso genérico. El guard existente lleva al destino recordado.
- **Página «Registrarse»** (`/registrarse`): nombre, apellido, email, celular opcional, contraseña (mín. 8) y «Repetir contraseña» (solo cliente, debe coincidir, no se envía; DU-5); `POST /auth/register`; 409 → error en el campo email; 422 → error en el campo que indica `field`. Tras 201 se **inicia sesión automáticamente** con las mismas credenciales; si ese login falla, `/ingresar` con el email precargado y el aviso «Tu cuenta se creó» (DU-1).
- **Página «Mi cuenta»** (`/mi-cuenta`, cualquier rol): datos del usuario de la sesión (nombre, apellido, email solo lectura, celular, roles solo lectura); edición de nombre, apellido y celular con `PATCH /usuarios/me` que actualiza la sesión sin perder los roles; sección «Sesiones» con «Cerrar todas las sesiones» (confirmación → `POST /auth/logout-all` → sesión local `anonima` con motivo `logout` → `/catalogo`).
- **Entidad `usuario`/feature de cuenta** (FSD): llamadas `iniciarSesion`, `registrarse`, `actualizarPerfil` en `shared/api` o `entities/session`, mutaciones con TanStack Query; validadores puros por formulario.
- **Backend (retiro del duplicado)**: quitar `GET /api/v1/usuarios/me` (405; queda `PATCH`); ajustar los tests que lo usan para que apunten a `GET /auth/me` y la fila de la matriz RBAC (DU-2).
- **Backend (validación de nombre/apellido)**: `UserCreate` y `UserUpdateClient` recortan y exigen `nombre`/`apellido` no vacíos (`min_length=1`); `null` explícito en el `PATCH` → 422 `VALIDATION_ERROR` en lugar de 500 (DU-3).
- **Backend (email normalizado)**: el email se recorta y pasa a minúsculas en el alta (registro público y por ADMIN) y en la búsqueda del login; migración Alembic `005_email_normalizado` que normaliza los emails existentes (aborta si encuentra colisiones activas) y agrega `CHECK` de email normalizado (DU-4).
- **Docs al cerrar**: KB/06 Épica 1 (US-001/002/004/005 cubiertas), KB/02 y KB/03 (tabla de endpoints y permisos sin `GET /usuarios/me`), KB/07 (el login es form OAuth2 `username`/`password`, no JSON; email insensible a mayúsculas), KB/04 (CHECK de email normalizado), `frontend/README.md`, `CHANGES.md` (cierre de C-14, corrección del «409 en login», «Punto de partida (C-14)» para C-23/C-21).

**Fuera de alcance (con dueño o sin especificar):** cambio de contraseña y de email (no hay endpoint; no especificado), recuperación de contraseña (no especificado), lista de sesiones abiertas por dispositivo (no especificado), gestión de usuarios por ADMIN (C-23; hereda las validaciones de DU-3/DU-4 por los schemas), normalizar `celular` en el backend.

## Capabilities

### New Capabilities
- `frontend-account`: pantallas de cuenta del frontend — ingreso, registro, perfil propio y cierre de todas las sesiones, con sus validaciones y mensajes de error.
- `user-profile`: contrato backend del perfil propio — `PATCH /usuarios/me` limitado a datos básicos (sin roles ni email, nombre/apellido no vacíos ni `null`) y `GET /auth/me` como única lectura del usuario autenticado.

### Modified Capabilities
- `user-registration`: el alta normaliza el email (recorte + minúsculas) y exige nombre y apellido no vacíos (requisitos agregados).
- `auth-session`: el login busca el email sin distinguir mayúsculas ni espacios al borde (requisito agregado).
- `backend-db-migrations`: migración `005` que normaliza los emails existentes y agrega el `CHECK` (requisito agregado; pasa a ser la cabeza).

_(`frontend-session` ya define `abrirSesion` y el logout; `frontend-route-guards` ya define la vuelta al destino y el acceso `anonima` de `/ingresar` y `/registrarse`: no cambian.)_

## Impact

- **Código nuevo** (`frontend/src/`): `pages/ingresar/`, `pages/registrarse/`, `pages/mi-cuenta/` (`ui/`, `model/` con validadores, `index.ts`); funciones HTTP de login/registro/perfil y sus mutaciones; handlers MSW `src/test/msw/auth.ts` ampliados (login, register, `PATCH /usuarios/me`, logout-all).
- **Código modificado**: `app/router/routes.tsx` (`PAGINAS` con las tres rutas), `shared/api/index.ts` (exportes), posiblemente `app/router/route-map.ts` (sin cambios de dueño).
- **Backend**: `backend/app/modules/usuarios/router.py` (retira `GET /me`), `usuarios/schemas.py` (`NombrePersona`, validadores de `null` y de email), `usuarios/repository.py` (`get_by_email` normaliza), `usuarios/models.py` (`CHECK` en `__table_args__`), función `normalizar_email` en `app/core/`, nueva migración `backend/alembic/versions/005_email_normalizado.py`; tests `test_auth.py`, `test_contrato_rutas.py`, `test_exception_handlers.py`, `test_migrations.py`, `test_reset.py`, `tests/unit/test_alembic_config.py`, `tests/support/rbac_matriz.py` (y `schema_expectations.py` si corresponde).
- **Dependencias**: ninguna nueva (`@tanstack/react-form`, `axe-core`, `msw` ya están).
- **Governance CRÍTICO** (auth) + **HIGH** (migración que reescribe emails de usuarios): ningún código se escribe hasta el OK explícito del usuario a esta propuesta (OQ-1..OQ-5 ya resueltas como DU-1..DU-5; quedan OQ-6/OQ-7 de `design.md` sobre la migración `005`), y además hasta la aprobación de los mockups (`[UI-MOCKUP]`, política `system-and-mockups`).
