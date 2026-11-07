# Proposal — C-02 `auth-sesion-tokens-bearer-refresh`

## Why

La autenticación actual diverge de la spec (DT-07, DT-11, DT-12) y además tiene bugs que pueden romper la sesión en producción. Es el primer change de seguridad de la Fase 0 y bloquea al frontend (C-13+): el interceptor Axios de la spec no puede funcionar contra un backend que solo lee el access token desde una cookie.

Problemas observados en el código (`backend/app/core/deps.py`, `backend/app/core/security.py`, `backend/app/modules/usuarios/{router,service,models,repository}.py`):

- **Transporte del access token (DT-11, IN-07)**: se lee **solo** desde la cookie HttpOnly `access_token` (`OAuth2PasswordBearerWithCookie`; la lectura del header `Authorization: Bearer` está comentada). La spec pide Bearer + interceptor Axios + `authStore`, y `GET /auth/me` (hoy existe `/usuarios/me` y `/auth/me` está comentado).
- **Access token sin vínculo a la sesión**: sus claims son solo `sub` y `roles`; nada lo relaciona con un refresh ni con una sesión, así que no se puede cerrar «esta» sesión desde el access.
- **Refresh token en el body**: login lo devuelve en el JSON (el cliente tiene que guardarlo en algún lado) y `/refresh` y `/logout` lo reciben en el body.
- **Bug 1 — formato inconsistente (IN-08)**: login crea el refresh como string opaco (`secrets.token_urlsafe(32)`), pero `/refresh` crea un **JWT** con `create_refresh_token`; el formato cambia después del primer refresh.
- **Bug 2 — fechas aware vs naive (IN-08)**: `expires_at` (aware) se compara con `datetime.utcnow()` (naive) → posible `TypeError`.
- **Bug 3 — sin historial (DT-07)**: `/refresh` sobrescribe la misma fila (rotación «en sitio» que además corre la expiración), logout y expiración **borran** la fila, y `revoked_at` nunca se usa. No hay trazabilidad ni forma de detectar el reuso de un refresh robado.
- **Menores**: logout no verifica que el refresh pertenezca al usuario autenticado; el service usa `uow._session.add(...)` (viola las capas, debería pasar por el repositorio); email duplicado responde **403** en vez de **409** (DT-12, RN-AU-07).

## What Changes

**Alcance original de C-02 (CHANGES.md):**

- **BREAKING — Access token por `Authorization: Bearer`** (DT-11). Se deja de leer el access token desde la cookie `access_token`. Login y refresh devuelven el access en el body; el frontend lo guarda en `authStore`.
- **`GET /auth/me`** como contrato de sesión (reemplaza a `/usuarios/me` en ese rol).
- **BREAKING — `POST /auth/refresh` con rotación real** (RN-AU-05, DT-07): refresh opaco, guardado solo como hash SHA-256 (RN-AU-04), un único formato para login y refresh, el anterior se marca `revoked_at` (no se sobrescribe ni se borra) y se emite uno nuevo. Fechas aware en UTC (corrige el bug 2).
- **BREAKING — `POST /auth/logout`** requiere Bearer, revoca la sesión actual sin borrar filas y responde **204**. Ya no recibe el refresh en el body.
- **BREAKING — Registro con email duplicado → 409** (DT-12).
- **BREAKING — El refresh token viaja en una cookie HttpOnly** (resuelve **PA-04**), con `path` restringido a las rutas de auth y `secure`/`samesite` configurables (deja de estar `secure=False` fijo). Deja de enviarse y recibirse en el body.
- Renombre de módulos según CHANGES.md (ver punto abierto en `design.md`: hoy no existen módulos `auth` ni `refreshtokens`; todo vive en `usuarios`).

**Nuevo (decidido con el usuario, incluido en C-02):**

- **Concepto de sesión**: nueva tabla `sesion`. Una sesión se crea en el login y dura **7 días fijos** desde el login (la rotación no la extiende). Una sesión tiene N refresh tokens (historial), con uno solo activo a la vez. El access token lleva el claim `sid` (id de la sesión).
- **`POST /auth/logout-all`**: cierra la sesión en todos los dispositivos (revoca todas las sesiones activas del usuario); 204.
- **Detección de reuso de refresh**: presentar un refresh ya rotado (fuera del período de gracia) cierra **todas** las sesiones del usuario (criterio estilo GitHub: un dispositivo puede tener varios navegadores y no se puede saber cuál está comprometido).
- **Período de gracia para refresh concurrente** (carrera entre dos pestañas): configurable con una variable de entorno **obligatoria** (`REFRESH_REUSE_GRACE_SECONDS`, valor propuesto 30), sin default oculto.
- **Metadatos de sesión** (`ip`, `user_agent`) guardados para auditoría y para una futura lista de «sesiones activas». **No** se usan para bloquear nada (la IP cambia entre wifi/4G/VPN, la geo-IP es imprecisa y el user agent se copia).
- **Cambios de esquema con migración Alembic** (regla dura 9): tabla `sesion` nueva; `refresh_token` gana `sesion_id` y pierde `expires_at` (desviación de `knowledge-base/04`, justificada en `design.md`).

**Fuera de alcance:**

- Cerrar todas las sesiones al cambiar la contraseña: la funcionalidad de cambio de contraseña todavía no existe (es una historia candidata de `docs/Historias de Usuario.md`, material de apoyo, no normativo). La función de «revocar todas las sesiones» que se construye acá **debe quedar reutilizable** para ese caso.
- Invalidar access tokens ya emitidos (RN-AU-06, límite aceptado: viven hasta 30 min).
- Rate limiting con slowapi (C-03) y el frontend (`authStore`, interceptor Axios: C-13+).

**Governance: CRÍTICO.** Los artefactos se revisan y aprueban por el usuario antes de escribir código (regla dura 11).

## Capabilities

### New Capabilities
- `auth-session`: ciclo de vida de la sesión autenticada. Cubre login (emisión de access + refresh y creación de la sesión), transporte del access por Bearer y del refresh por cookie HttpOnly, contenido del access (`sub`, `roles`, `sid`, `type`, `exp`), `GET /auth/me`, rotación del refresh con historial, período de gracia, detección de reuso, expiración fija de la sesión, `POST /auth/logout` y `POST /auth/logout-all`, y metadatos de sesión.
- `user-registration`: registro público de clientes (rol `CLIENT` automático, RN-AU-07) y rechazo de email duplicado con 409.

### Modified Capabilities
- `backend-config`: se agregan variables obligatorias para el período de gracia del refresh (`REFRESH_REUSE_GRACE_SECONDS`) y para los atributos de la cookie del refresh (`secure`, `samesite`); cambia la lista de obligatorias del requisito «Una variable obligatoria faltante impide el arranque».

## Impact

- **Código**: `backend/app/core/security.py` (función única de creación del refresh opaco + hash; se retira `create_refresh_token` JWT; access con `sid`), `backend/app/core/deps.py` (Bearer en lugar de cookie), `backend/app/core/config.py` (variables nuevas), `backend/app/modules/usuarios/{models,repository,unit_of_work,service,router,schemas}.py` (modelo `Sesion`, repositorios, flujos de login/refresh/logout/logout-all/me, 409) o los módulos renombrados que resulten. `backend/.env.example` y `backend/tests/.env.test.example`.
- **Base de datos**: tabla nueva `sesion`; `refresh_token` con `sesion_id` FK y sin `expires_at`. Requiere migración Alembic (hoy el repo no tiene Alembic; ver punto abierto en `design.md`). Los refresh existentes quedan inválidos: todos los usuarios deben volver a loguearse.
- **API (BREAKING)**: `Authorization: Bearer` obligatorio; `/auth/refresh` y `/auth/logout` ya no reciben body; el refresh ya no aparece en el JSON de login/refresh; nuevos `GET /auth/me` y `POST /auth/logout-all`; registro duplicado 409.
- **Frontend (C-13+)**: interceptor Axios con Bearer, `authStore` con el access, `withCredentials` para que el navegador envíe la cookie del refresh a `/api/v1/auth`.
- **Tests**: login, Bearer, `/auth/me`, rotación, gracia, reuso, expiración de sesión, logout, logout-all, 409, configuración (Strict TDD).
- **Docs**: `knowledge-base/04` (modelo `sesion` / `refresh_token`), `05` (RN-AU), `09` (DT-07/11/12 resueltas, DD-09), `10` (PA-04 resuelta), `CHANGES.md`.
