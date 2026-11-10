# Design — C-02 `auth-sesion-tokens-bearer-refresh`

## Context

- Motivación, problemas del código actual y alcance: ver `proposal.md` (Why / What Changes). Requisitos: `specs/auth-session/spec.md`, `specs/user-registration/spec.md` y los deltas de `specs/backend-config/spec.md` y `specs/backend-db-migrations/spec.md`.
- Estado del código relevante:
  - `backend/app/core/deps.py`: `OAuth2PasswordBearerWithCookie` lee el access **solo** de la cookie `access_token`; el header Bearer está comentado. `core/deps.py` importa desde `modules/usuarios` (DT-25).
  - `backend/app/core/security.py`: `create_access_token` (claims `sub`, `roles`, `type`, `exp`), `create_refresh_token` (JWT + hash + expiración) y `decode_access_token` (verifica firma, `exp` y `type == "access"`).
  - `backend/app/modules/usuarios/`: todo auth vive acá (`auth_router`, `usuarios_router`, `admin_router` en un solo `router.py`; `UsuarioService` con login/refresh/logout; `RefreshTokenRepository.get_by_hash`; modelo `RefreshToken` con `usuario_id`, `token_hash` CHAR(64) único, `expires_at`, `revoked_at`, `created_at`). No existen módulos `auth` ni `refreshtokens`.
  - `backend/app/main.py`: CORS ya tiene `allow_credentials=True` con `CORS_ORIGINS` como lista.
  - `backend/app/core/unit_of_work.py`: `UnitOfWork.__exit__` hace `commit` si no hubo excepción y `rollback` si la hubo (relevante para D16).
- **C-06 ya está cerrado** (archivado el 2026-11-09): Alembic existe, el esquema sale solo de migraciones (`001_esquema_inicial.py` es la única), la suite migra `foodstore_test` con `alembic upgrade head` por sesión, `app/db/models.py::import_all_models()` descubre los modelos por glob de `app/modules/*/models.py`, toda FK hacia `usuario.id` es `BIGINT` (un test de metadata lo exige) y las fechas son `TIMESTAMPTZ` en UTC con `app/core/timestamps.py` (`utc_now()`, `aware_datetime_field(...)`). El bug aware/naive del refresh (bug 2 del proposal) **ya quedó resuelto en C-06** y sale del alcance de C-02.
- Restricciones: reglas duras de `CLAUDE.md` (capas `models ← repository ← unit of work ← services ← routers`, sin `Session` ni lógica en routers, extender `BaseRepository`/`BaseService`, SOLID/DRY, migración Alembic para cambios de esquema, sin secretos en el repo), convención de configuración de C-01 (toda variable explícita, en `.env`/`.env.example`, declarada en `Settings`, obligatoria sin default oculto y fail-fast), Strict TDD en apply y governance **CRÍTICO** (nada de código sin aprobación del usuario sobre estos artefactos). El agente de apply no lee ni escribe archivos `.env*`: el contenido de las variables nuevas se deja en `todoAMd/` para que el usuario lo copie.

## Goals / Non-Goals

**Goals:**
- Hacer explícito el **cambio de modelo** de autenticación: dos secretos (access y refresh) más una entidad nueva, la **sesión**.
- Que cada pedido autenticado se valide sin tocar la BD por la sesión (solo firma del access), y que la BD sea la única autoridad sobre la vigencia de la sesión.
- Trazabilidad completa: ninguna fila de sesión ni de refresh se borra en la operación normal; todo se marca.
- Que «revocar todas las sesiones de un usuario» sea una única operación reutilizable (logout-all, reuso y, a futuro, cambio de contraseña).
- Ordenar el código de auth en los módulos de la estructura de la spec (`auth`, `refreshtokens`, `usuarios`).

**Non-Goals:**
- Invalidar access tokens ya emitidos (no hay lista negra; ver Risks).
- Bloquear sesiones por IP o user agent.
- Endpoint de listado de sesiones activas (los metadatos quedan guardados para hacerlo después).
- Cerrar todas las sesiones al cambiar la contraseña (la funcionalidad no existe; D8 deja la operación lista).
- Frontend (`authStore`, interceptor Axios, `withCredentials`): C-13+.
- Rate limiting (C-03) y la corrección general de DT-25.

## Cambio de modelo (explícito)

El modelo cambia respecto del código actual y también respecto de la idea inicial del usuario. Esta tabla resume las tres versiones:

| | Código actual | Idea inicial del usuario | Modelo adoptado |
|---|---|---|---|
| **access_token** | JWT 30 min con `sub` y `roles`. Viaja **solo** en cookie HttpOnly `access_token`. | JWT con un claim que apunta al refresh guardado en la BD. | JWT HS256 30 min con `sub`, `roles`, `sid`, `type=access`, `exp`. Viaja en `Authorization: Bearer`; el frontend lo guarda en memoria (`authStore`). |
| **refresh_token** | Login: string opaco. Refresh: JWT. Se devuelve en el **body** y el cliente lo guarda. | Vive **solo en la BD**; el cliente nunca lo tiene. | String opaco aleatorio. En la BD solo su hash SHA-256. Viaja en cookie HttpOnly restringida a `/api/v1/auth`. Rota en cada renovación. |
| **sesión** | No existe como concepto: el refresh hace de sesión y su vencimiento se corre en cada refresh. | El refresh en la BD hace de sesión. | Entidad propia (`sesion`): nace en el login, vence a los **7 días fijos**, agrupa el historial de refresh tokens. |
| **qué se manda para renovar** | El refresh en el body de `POST /auth/refresh`. | El access **vencido**. | Nada explícito: el navegador manda solo la cookie del refresh a `POST /auth/refresh`. |
| **qué pasa en la BD** | Refresh: se **sobrescribe** la misma fila. Logout y expiración: se **borra** la fila. `revoked_at` nunca se usa. | Se consulta el refresh asociado al access vencido. | Rotar: el refresh actual se marca `revoked_at` y se inserta uno nuevo con el mismo `sesion_id`. Logout / logout-all / reuso: se marca la sesión (`revoked_at`, `revoked_reason`). Nunca se borra nada. |

**Por qué no la idea inicial.** La idea es intuitiva (un solo secreto en el cliente y el refresh protegido en el servidor), pero tiene un problema de seguridad concreto: si el access vencido alcanza para renovar, **robar el access equivale a robar la sesión entera durante 7 días**, no solo 30 minutos. El access es justamente el secreto más expuesto (viaja en cada pedido y vive en memoria de JavaScript). El modelo adoptado separa los dos papeles: el access es expuesto pero dura poco; el refresh dura más pero está en una cookie HttpOnly que JavaScript no puede leer y que el navegador solo envía a las rutas de auth.

### Ejemplo

```
Sesión S1 (usuario 5, celular, vence 14/11)
 ├─ refresh A → ROTADO
 ├─ refresh B → ROTADO
 └─ refresh C → activo  ← el de la cookie del celular
Sesión S2 (usuario 5, PC, vence 16/11)
 └─ refresh X → activo
```

## Decisions

### D1. Access token: JWT con `sid`, por Bearer, sin BD
- Claims: `sub` (id de usuario), `roles`, `sid` (id de la sesión), `type="access"`, `exp` (30 min, `ACCESS_TOKEN_EXPIRE_MINUTES`).
- Se lee del header `Authorization: Bearer`. La cookie `access_token` deja de leerse y de emitirse.
- Se valida con `decode_access_token` (firma, `exp`, `type`), **sin consultar la sesión en la BD**. La dependencia de usuario actual sigue cargando el usuario (como hoy) para roles y estado.
- Login y refresh lo devuelven en el body (`access_token`, `token_type="bearer"`, `expires_in`).
- *Alternativa descartada*: mantener la cookie como medio del access (DD-09). Contradice la spec (DT-11, IN-07) y el frontend previsto.
- *Alternativa descartada*: verificar la sesión en la BD en cada pedido. Daría revocación inmediata a costa de un acceso a la BD por pedido; se acepta el límite de RN-AU-06 (ver Risks).

### D2. Refresh token: opaco, hasheado, una sola función de creación
- Valor: `secrets.token_urlsafe(32)`. **No es un JWT**: un JWT no aporta nada porque el refresh siempre se valida contra la BD, que tiene la vigencia y la revocación; solo agregaría tamaño y una segunda fuente de verdad sobre la expiración (el bug 1 viene de ahí).
- En la BD se guarda **solo** el SHA-256 (CHAR(64), único), igual que una contraseña: una fuga de la BD no debe filtrar sesiones utilizables (RN-AU-04).
- Una única función en `core/security.py` devuelve `(plano, hash)`; la usan login y refresh. Se retira `create_refresh_token` (JWT). Otra función calcula el hash de un valor recibido.
- *Alternativa descartada*: UUID v4 (IN-08 A). Funciona igual; `token_urlsafe(32)` ya está en el código y da 256 bits de entropía.

### D3. Transporte del refresh: cookie HttpOnly (PA-04 resuelta)
- Cookie `refresh_token`, HttpOnly, con `path=/api/v1/auth` (el navegador no la envía a ninguna otra ruta) y `max_age` igual a los segundos que faltan para el vencimiento de la sesión.
- `samesite` y `secure` salen de `Settings` (`REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`; ver D12 y D14). Valores propuestos: `samesite=lax`, `secure=true` en `.env.example` (Chrome y Firefox aceptan cookies `Secure` en `http://localhost`); `secure=false` solo en `.env.test`, porque el `TestClient` habla con `http://testserver` y no reenviaría una cookie `Secure`.
- Login y refresh la setean (`Set-Cookie`); logout y logout-all la borran (mismo `path`). El refresh **no** aparece en ningún body, ni de entrada ni de salida.
- *Alternativa descartada*: refresh en el body y guardado por el frontend (`localStorage` o `authStore`). Lo expone a XSS; la spec solo persiste el `accessToken`.

### D4. Sesión como entidad, con vencimiento fijo
- La sesión se crea en el login y vence a `login + REFRESH_TOKEN_EXPIRE_DAYS` (7 días). Ese vencimiento **nunca cambia**: la rotación no lo extiende (sin sliding).
- 1 sesión → N refresh tokens (historial); como máximo uno activo (`revoked_at IS NULL`) a la vez, garantizado además por un índice único parcial (D5) y un bloqueo de fila al rotar (D17).
- *Por qué*: separa lo que dura (la sesión) de lo que rota (el refresh). Sin sesión, el historial de refresh no tiene a qué agruparse y el vencimiento se corre con cada rotación (bug 3).
- *Alternativa descartada*: vencimiento deslizante. Permite que un refresh robado y usado con regularidad mantenga la sesión viva indefinidamente.

### D5. Esquema (migración `002`)

Tabla nueva `sesion` (modelo `Sesion` en `modules/refreshtokens/models.py`, D15):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | Aleatorio (v4), generado por la app; es el claim `sid`. No secuencial, para no exponer volumen ni ser adivinable. |
| `usuario_id` | `BIGINT` FK `usuario.id` | NOT NULL, indexado. `sa_type=BigInteger` (el test de metadata de C-06 exige `BIGINT` en toda FK a `usuario.id`). |
| `expires_at` | TIMESTAMPTZ | Login + 7 días; nunca cambia. `aware_datetime_field()`. |
| `revoked_at` | TIMESTAMPTZ NULL | NULL = abierta. `aware_datetime_field(nullable=True)`. |
| `revoked_reason` | VARCHAR(20) NULL | `LOGOUT` \| `LOGOUT_ALL` \| `REUSO`; NULL si abierta. |
| `created_at` | TIMESTAMPTZ | `aware_datetime_field(default_now=True)`. |
| `ip` | VARCHAR(45) NULL | Solo auditoría (cabe IPv6). |
| `user_agent` | TEXT NULL | Solo auditoría. |

Restricciones de `sesion` (nombres explícitos, salvo la PK): `fk_sesion_usuario_id_usuario`, `ix_sesion_usuario_id`, `ck_sesion_revoked_reason` (`revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO')`) y `ck_sesion_revocacion_consistente` (`(revoked_at IS NULL) = (revoked_reason IS NULL)`).

Tabla `refresh_token` ajustada (modelo `RefreshToken`, movido a `modules/refreshtokens/models.py`):

| Columna | Cambio |
|---|---|
| `sesion_id` | **Nueva**, UUID, FK `sesion.id` (`fk_refresh_token_sesion_id_sesion`), NOT NULL, indexada (`ix_refresh_token_sesion_id`). |
| `token_hash` | Se mantiene: CHAR(64) único. |
| `revoked_at` | Se mantiene. Significa **«rotado»**; NULL = activo. Los motivos de cierre viven en la sesión, no acá. |
| `created_at` | Se mantiene. |
| `expires_at` | **Se elimina**: el vencimiento es de la sesión. |
| `usuario_id` | **Se elimina**: el usuario se obtiene de la sesión. Mismo motivo que `expires_at`: duplicar el dato abre la puerta a que diverja. |

- Índice único parcial `uq_refresh_token_sesion_activo` sobre `refresh_token(sesion_id) WHERE revoked_at IS NULL`: la base garantiza un solo refresh activo por sesión (última defensa de D4/D17).
- La relación `Usuario.refresh_tokens` se elimina (el modelo `Usuario` no conoce a `refreshtokens`; evita una dependencia circular entre módulos). Ni `Sesion` ni `RefreshToken` declaran `Relationship` hacia `Usuario`: alcanza con la FK.
- **Migración**: `alembic revision --autogenerate --rev-id 002 -m "sesiones y refresh rotado"`, revisada a mano (nombres de constraints, índice parcial, CHECK). `down_revision = "001"`. El `upgrade` **borra las filas existentes de `refresh_token`** antes de agregar `sesion_id NOT NULL` (no hay sesión a la que asociarlas; todos vuelven a loguearse). Es la única vez que se borran filas de refresh y ocurre en la migración, no en la operación normal. El `downgrade` vuelve al esquema de la 001 (borra filas de `refresh_token`, repone `usuario_id` y `expires_at` NOT NULL, quita `sesion_id` y el índice, y elimina `sesion`).
- **Desviación de la spec (registrar en `knowledge-base/04`)**: el modelo de la spec lista `usuario_id` y `expires_at` (7 días) en `refresh_token` y no prevé una tabla de sesión. Se aparta porque, con vencimiento fijo por sesión, un `expires_at` (y un `usuario_id`) por refresh duplicaría el dato y abriría la puerta a que diverjan. El comportamiento normativo se conserva: el refresh sirve como máximo 7 días desde el login, se guarda hasheado y se revoca con `revoked_at` (RN-AU-01, 04, 05).

- **PK sin nombre explícito:** la PK de `sesion` usa el nombre por defecto de PostgreSQL (`sesion_pkey`, verificado en la base migrada). El proyecto no define `naming_convention` y las demás PK (incluidas las de `refresh_token` y las 17 tablas de la 001) tampoco tienen nombre explícito; nombrar solo esta sería inconsistente. No amerita migración: el nombre de una PK no cambia el comportamiento ni el esquema funcional, y Alembic no lo compara al autogenerar (el test «esquema migrado == modelos» lo confirma).

### D6. Flujos

1. **Login** (`POST /auth/login`, form OAuth2 como hoy): valida email y contraseña; credenciales inválidas o usuario con `deleted_at` → 401 «Credenciales incorrectas» (como hoy, RN-AU-03). Crea la sesión (`sid`, `+7d`, `ip`, `user_agent`) y su primer refresh (hash). Responde el access `{sub, roles, sid}` en el body y el refresh en `Set-Cookie`.
2. **Pedidos autenticados**: Bearer → verificación de firma (D1), sin consultar la sesión.
3. **Renovación** (`POST /auth/refresh`, sin body): cuando el access vence, el pedido recibe 401 y el interceptor Axios llama a `/auth/refresh`; el navegador envía la cookie solo. Tabla de decisión, evaluada en este orden:

   | Refresh recibido | Respuesta |
   |---|---|
   | No hay cookie, o su hash no existe | 401 |
   | Su sesión está vencida o cerrada, o el usuario está dado de baja | 401: volver a loguearse, **sin alarma** y sin cerrar otras sesiones. Cubre la sesión del celular que venció y el navegador de la PC después de un logout-all. |
   | Activo y sesión viva | **Rotar**: marcar `revoked_at` en el actual, crear uno nuevo con el mismo `sesion_id`, emitir access nuevo (roles actuales del usuario, mismo `sid`), `Set-Cookie` con el refresh nuevo. |
   | Rotado hace ≤ `REFRESH_REUSE_GRACE_SECONDS` y sesión viva | **Período de gracia**: solo un access nuevo. La cookie **no** se toca (ese navegador ya tiene el refresh nuevo). |
   | Rotado hace > `REFRESH_REUSE_GRACE_SECONDS` y sesión viva | **REUSO**: cerrar **todas** las sesiones abiertas del usuario con motivo `REUSO`, registrar un warning en el log, borrar la cookie, 401. |

   *Por qué un refresh rotado implica reuso*: el cliente legítimo nunca reenvía un refresh reemplazado, porque al rotar su cookie quedó sobrescrita con el nuevo. Si llega uno rotado, alguien tiene una copia vieja. Quien llegue segundo (el ladrón o el usuario) dispara la detección, y la sesión muere para los dos. Se cierran **todas** las sesiones del usuario y no solo esa (criterio estilo GitHub) porque un mismo dispositivo puede tener varios navegadores y no hay forma de saber cuál está comprometido.

   Las respuestas 401 de refresh borran la cookie del refresh (no sirve más) y usan el formato de error de la API.

4. **Logout** (`POST /auth/logout`, requiere Bearer, sin body): toma el `sid` del access y cierra esa sesión (`revoked_at`, `LOGOUT`); borra la cookie; 204. Los refresh de esa sesión **no** se tocan: su `revoked_at` significa solo «rotado» (D5) y quedan inservibles porque la sesión está cerrada. Si la sesión ya estaba cerrada, responde 204 igual sin modificarla (idempotente). Como el `sid` sale del propio access, ya no se puede cerrar la sesión de otro usuario (corrige el «menor» del proposal).
5. **Logout-all** (`POST /auth/logout-all`, requiere Bearer): cierra todas las sesiones abiertas del usuario (`LOGOUT_ALL`), borra la cookie, 204. Las sesiones ya cerradas conservan su motivo original.
6. **`GET /auth/me`** (requiere Bearer): devuelve el usuario autenticado con sus roles (mismo contrato que hoy `GET /usuarios/me`). `GET`/`PATCH /usuarios/me` se mantienen como perfil (retirar el `GET` duplicado queda para C-14/C-25).

### D7. Período de gracia: carrera de dos pestañas

```
t=0.0  pestaña A ─ refresh R1 ─▶ servidor rota: R1 rotado, emite R2, Set-Cookie R2
t=0.1  pestaña B ─ refresh R1 ─▶ (salió antes de que llegara la cookie R2)
                                 R1 rotado hace 0.1 s ≤ gracia → solo access nuevo
                                 (la cookie compartida del navegador ya es R2)
```

- Sin gracia, la pestaña B dispararía un falso REUSO y cerraría todas las sesiones del usuario.
- Valor: **30 s**, configurable con `REFRESH_REUSE_GRACE_SECONDS`, **obligatoria** y sin default oculto (convención de C-01: va en `.env`/`.env.example`, se declara en `Settings`, fail-fast si falta). Entero ≥ 0 (0 desactiva la gracia).
- En gracia no se emite un refresh nuevo ni se toca la cookie, así que la ventana no permite crear ramas paralelas de refresh.
- La gracia se mide desde el `revoked_at` del refresh presentado, con `utc_now()`.

### D8. Revocación masiva reutilizable
- Una única operación de service «revocar todas las sesiones abiertas de un usuario con motivo X» (y su consulta de repositorio, un `UPDATE` sobre las sesiones con `revoked_at IS NULL`). La usan logout-all (`LOGOUT_ALL`) y reuso (`REUSO`), y queda lista para el cambio de contraseña futuro (fuera de alcance).

### D9. Metadatos de sesión solo para auditoría
- `ip` (`request.client.host`) y `user_agent` (header `User-Agent`, puede faltar) se toman del request en el login y se guardan en la sesión. **No** se comparan en refresh ni bloquean nada: la IP cambia entre wifi/4G/VPN, la geo-IP es imprecisa y el user agent se copia trivialmente. Sirven para auditoría y para una futura lista de «sesiones activas». El router los extrae del request y los pasa al service como datos simples.

### D10. Fechas siempre aware en UTC (heredado de C-06)
- Las columnas nuevas usan `aware_datetime_field(...)` y todo «ahora» sale de `utc_now()` (`app/core/timestamps.py`). El bug aware/naive (IN-08) ya lo resolvió C-06; acá solo se respeta la convención. El test de C-06 que lista las columnas de fecha esperadas se actualiza (sale `refresh_token.expires_at`, entran `sesion.expires_at`, `sesion.revoked_at`, `sesion.created_at`).

### D11. Capas y reutilización
- Sin `uow._session`: todo acceso a datos pasa por repositorios (`SesionRepository`, `RefreshTokenRepository`) que extienden `BaseRepository`, expuestos por la Unit of Work. Consultas nuevas (refresh por hash con bloqueo, refresh activo de una sesión, sesiones abiertas de un usuario, revocación masiva) viven en el repositorio. `BaseRepository.get_by_id` se tipa para aceptar la PK del modelo (entero o UUID) sin duplicarlo.
- Los routers solo traducen HTTP (leer cookie, setear/borrar cookie, extraer `ip`/`user_agent`, códigos) y delegan en el service; la lógica de la tabla de decisión de D6 vive en el service.
- La cookie (nombre, `path`, `secure`, `samesite`, `max_age`) se setea y borra desde un único helper del módulo `auth` para no duplicar atributos entre login, refresh, logout y logout-all (DRY).
- Email duplicado → 409 (DT-12) en el método de creación central de `UsuarioService`, que ya comparten registro y alta por admin.
- DT-25 no se amplía: el router de `auth` usa las dependencias de `core/deps.py` existentes; la nueva dependencia que expone los claims del access (`sid`) depende solo de `core/security.py`, no de `modules/` (D18).

### D12. Configuración
- Variables nuevas, **obligatorias** y sin default (fail-fast), declaradas en `Settings`:
  - `REFRESH_REUSE_GRACE_SECONDS` (int ≥ 0; valor `30`).
  - `REFRESH_COOKIE_SECURE` (bool; `true` en `.env.example`, `false` en `.env.test`).
  - `REFRESH_COOKIE_SAMESITE` (`lax` | `strict` | `none`; valor `lax`). `none` con `REFRESH_COOKIE_SECURE=false` hace fallar la carga (los navegadores rechazan esa combinación).
- `CORS_ORIGINS` con `*` hace fallar la carga (D14).
- Se mantienen `ACCESS_TOKEN_EXPIRE_MINUTES` (30) y `REFRESH_TOKEN_EXPIRE_DAYS` (7, ahora vencimiento de la sesión).
- El agente de apply **no** toca `backend/.env`, `backend/.env.example`, `backend/tests/.env.test` ni `backend/tests/.env.test.example`: deja el contenido exacto en `todoAMd/env-templates-C-02.md` y el usuario lo copia **antes** de que `Settings` declare las variables (si no, la suite no arranca porque `settings = Settings()` se evalúa al importar).

### D13. Tests (Strict TDD en apply)
- Cada flujo de D6 y cada fila de la tabla de decisión tiene su test RED primero: login (body + cookie, sin refresh en body), Bearer aceptado y cookie de access ignorada, `/auth/me`, rotación (fila anterior marcada, misma sesión, cookie nueva), gracia (solo access, sin `Set-Cookie`), reuso (todas las sesiones con `REUSO`, warning, 401), sesión vencida o cerrada (401 sin cerrar otras), vencimiento fijo (la rotación no lo corre), logout (204, sesión `LOGOUT`, cookie borrada), logout-all, 409, configuración obligatoria. Tests sobre PostgreSQL real (`foodstore_test`).
- El tiempo se controla de forma determinista **ajustando timestamps en la BD** (`sesion.expires_at`, `refresh_token.revoked_at`) desde la sesión de test, sin `sleep` ni reloj inyectado.
- Los tests existentes que codifican deuda se adaptan explícitamente: helpers `_get_admin_auth_headers`/`_get_user_auth_headers` de `tests/conftest.py` (cookie → Bearer), `tests/integration/test_auth.py` (login con cookie de access, 409 laxo), `tests/integration/test_auth_refresh_tz.py` (refresh por body y `refresh_token.expires_at`), `tests/support/schema_expectations.py` y `tests/support/settings_env.py`, `tests/integration/test_migrations.py` (cabeza `001` → `002`, 17 → 18 tablas) y `tests/unit/test_models_registry.py`.

### D14. CORS con credenciales sin comodín
- La cookie del refresh exige CORS con credenciales, y el estándar no admite `Access-Control-Allow-Origin: *` con credenciales. `Settings` **falla al cargar** si `CORS_ORIGINS` contiene `*` (fail-fast con un error que nombra `CORS_ORIGINS`), en lugar de descubrirlo en el navegador.
- Que el frontend use `withCredentials` (al menos hacia `/api/v1/auth`) es una nota para C-13, no trabajo de C-02.

### D15. Módulos según la estructura de la spec
`knowledge-base/08` §Estructura fija `backend/app/modules/{auth,refreshtokens,usuarios,...}`. C-02 reparte el código así:
- **`modules/auth/`**: `router.py` (`auth_router`: `register`, `login`, `refresh`, `logout`, `logout-all`, `me`), `service.py` (`AuthService`: login, refresh con la tabla de D6, logout, logout-all, revocación masiva), `schemas.py` (`Token` sin `refresh_token`), `unit_of_work.py` (`AuthUnitOfWork` con `usuarios`, `sesiones`, `refresh_tokens`) y el helper de cookie. Sin `models.py`.
- **`modules/refreshtokens/`**: `models.py` (`Sesion`, `RefreshToken`) y `repository.py` (`SesionRepository`, `RefreshTokenRepository`). Sin router ni service. `import_all_models()` lo descubre solo por el glob de `*/models.py`; no hay lista que tocar.
- **`modules/usuarios/`**: `Usuario`, `Rol`, `UsuarioRol`; perfil (`/usuarios/me`) y panel admin (`/admin/usuarios`); `UsuarioService` conserva la creación centralizada (`register`, `create_user_admin`, 409). `POST /auth/register` vive en `auth_router` pero delega en `UsuarioService.register` (no se duplica la creación ni un service llama a otro). `UsuarioUnitOfWork` deja de exponer `refresh_tokens`.
- `main.py` monta `auth_router` desde `modules/auth/router.py`. Los paths públicos no cambian salvo los nuevos (`/auth/me`, `/auth/logout-all`).
- Fuera de alcance: renombrar `direcciones_entrega` → `direcciones` y crear `admin` (C-25).

### D16. La revocación por reuso persiste aunque la respuesta sea 401
- `UnitOfWork.__exit__` hace `rollback` si sale una excepción. Si el service levantara el 401 dentro del `with uow`, la revocación de todas las sesiones se desharía y la detección no tendría efecto.
- El service resuelve la tabla de D6 dentro del `with uow` y devuelve un resultado (rotado / gracia / rechazado / reuso); la excepción 401 se levanta **después** de salir del bloque (ya confirmado). Un test verifica que, tras el 401 por reuso, las sesiones siguen cerradas al releerlas.

### D17. Rotación concurrente
- La búsqueda del refresh por hash en `/auth/refresh` bloquea la fila (`SELECT ... FOR UPDATE`). Dos pedidos simultáneos con el mismo refresh activo se serializan: el primero rota y el segundo lo ve rotado hace milisegundos y cae en la gracia, sin crear un segundo refresh activo.
- Al rotar, se marca `revoked_at` del actual y se hace `flush` **antes** de insertar el nuevo, para no chocar con `uq_refresh_token_sesion_activo`.
- Verificado por `tests/integration/test_auth_refresh_concurrente.py`: dos `POST /auth/refresh` simultáneos (hilos, una conexión de BD por pedido con commits reales) con el mismo refresh vigente terminan en dos 200, una sola rotación (la otra cae en la gracia, sin cookie), un único refresh activo y la sesión sin cerrar. Sin el `FOR UPDATE` el test falla (5 de 5 corridas, por `uq_refresh_token_sesion_activo`), así que el bloqueo es lo que lo hace pasar.

### D18. Claims del access disponibles para logout
- Nueva dependencia en `core/deps.py` que devuelve los claims validados del access (`sub`, `sid`, `roles`) leyendo el header Bearer, sin consultar la BD y sin importar de `modules/`. Logout la usa para obtener el `sid`; `get_current_user` reutiliza la misma extracción (DRY).
- Un access sin `sid` (emitido antes de C-02, válido hasta 30 min) se rechaza con 401 en todas las rutas: todo access válido debe tener `sid`.

### D19. PA-04 resuelta
- PA-04 («dónde guarda el frontend el refresh token») queda resuelta por este diseño: el refresh vive en una cookie HttpOnly que el frontend nunca lee, y el access vive en memoria del frontend (`authStore`). Se actualizan `knowledge-base/10` (PA-04 → RESUELTA), `knowledge-base/08` §Seguridad, `knowledge-base/05` (RN-AU-05, 06, 07, 10), `knowledge-base/04` (sesión y refresh), `knowledge-base/09` (DT-07, DT-11, DT-12 resueltas; DD-09 reemplazada) y `CHANGES.md` (quitar `[PENDIENTE DE DECISIÓN: PA-04]` de C-02 y la nota «el backend lo soporta por body»).

### D20. Login sin diferencia de tiempo por existencia del usuario
- Si el email no existe (o el usuario está dado de baja), `verify_password` no se ejecutaba y el login respondía mucho más rápido que con una contraseña incorrecta: la diferencia de tiempo permitía enumerar emails registrados. Ahora el service verifica **siempre** bcrypt: contra el hash del usuario si existe y contra `DUMMY_PASSWORD_HASH` si no.
- `DUMMY_PASSWORD_HASH` vive en `core/security.py`, se calcula una sola vez al importar (bcrypt cost 12, mismo `pwd_context`) y no es un secreto ni una variable de entorno: no protege nada, solo iguala el costo.
- La respuesta no cambia: mismo 401 «Credenciales incorrectas». Tests: `tests/integration/test_auth_login_timing.py` (espía `verify_password`) y `tests/unit/test_security.py`.
- Límite: iguala el costo de bcrypt, no elimina toda diferencia de tiempo posible (consulta a la BD, serialización); el rate limiting (C-03) completa la defensa.

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-07
- Mockups: N/A

## Risks / Trade-offs

- [Cerrar una sesión no mata los access ya emitidos: viven hasta 30 min (RN-AU-06)] → Límite aceptado. Se mitiga con el TTL corto del access; una lista negra o verificar la sesión en cada pedido queda fuera de alcance.
- [Falso positivo de reuso (pestañas concurrentes, reintentos de red) cierra todas las sesiones del usuario] → Período de gracia de 30 s configurable (D7) y bloqueo de fila (D17). El costo de un falso positivo es volver a loguearse, no pérdida de datos.
- [Un ladrón que usa el refresh robado **antes** que el usuario obtiene acceso hasta el próximo refresh del usuario legítimo] → Inherente a la rotación: en ese momento se detecta el reuso y mueren todas las sesiones. El vencimiento fijo de 7 días acota el peor caso.
- [La cookie del refresh depende de si frontend y API comparten sitio] → `samesite`/`secure` configurables (D3, D12); `CORS_ORIGINS` sin comodín (D14). Si quedan en sitios distintos hace falta `samesite=none` + `secure=true`.
- [CSRF sobre `/auth/refresh` y `/auth/logout*`] → `/auth/refresh` solo devuelve el access en el body (otro origen no puede leerlo por CORS); logout y logout-all exigen Bearer, que un sitio ajeno no puede adjuntar. `samesite=lax` agrega defensa en profundidad.
- [BREAKING para clientes actuales (Swagger con cookie, tests, refresh en body)] → Documentado en el proposal; el frontend todavía no existe (C-13), así que no hay clientes reales que migrar. Swagger sigue funcionando con «Authorize» (OAuth2 password → Bearer).
- [La migración borra los refresh existentes] → Aceptado: no hay sesiones productivas; todos vuelven a loguearse.
- [La suite no arranca hasta que el usuario copie las variables nuevas a `backend/tests/.env.test`] → Tarea explícita de checkpoint antes del GREEN de configuración (tasks grupo 1).
- [El rate limit actual (DT-10) matchea `/api/v1/auth/logout` y podría alcanzar a `/auth/logout-all`] → Sin impacto funcional; C-03 reemplaza el middleware.

- [Los WebSocket de `pedidos` (`/pedidos/cocina/ws`, `/pedidos/{id}/ws`) autentican con la cookie `access_token`, que C-02 ya no emite] → Riesgo conocido: desde C-02 esos handshakes no se pueden autenticar (cierran con 1008). Se deja sin corregir a propósito (WebSocket es Fase 2): C-27 debe autenticar el handshake con el access (por ejemplo en query string o subprotocolo, validando firma, `exp` y `sid`). Anotado en `CHANGES.md` [C-27] y en `knowledge-base/12`.

## Migration Plan

1. El usuario copia las variables nuevas obligatorias (D12) desde `todoAMd/env-templates-C-02.md` a `backend/.env`, `backend/.env.example`, `backend/tests/.env.test` y `backend/tests/.env.test.example`.
2. Aplicar la migración `002` (`alembic upgrade head` desde `backend/`): `sesion` nueva; `refresh_token` con `sesion_id`, sin `expires_at` ni `usuario_id`; las filas existentes de `refresh_token` se borran y todos los usuarios vuelven a loguearse.
3. Clientes: enviar `Authorization: Bearer <access>`, usar `GET /auth/me`, llamar a `/auth/refresh` y `/auth/logout` sin body y con credenciales (cookie).

Rollback: revertir el código y `alembic downgrade 001`. Las sesiones creadas con el modelo nuevo se pierden (los usuarios vuelven a loguearse).

## Open Questions

Ninguna bloqueante. Quedan anotadas para changes posteriores:
- Exigir `REFRESH_COOKIE_SECURE=true` cuando `ENVIRONMENT=production` (hoy solo se valida `samesite=none` ⇒ `secure=true`).
- Retirar `GET /usuarios/me` en favor de `GET /auth/me` (C-14/C-25).
- Cerrar todas las sesiones al cambiar la contraseña, cuando exista esa funcionalidad (D8).
