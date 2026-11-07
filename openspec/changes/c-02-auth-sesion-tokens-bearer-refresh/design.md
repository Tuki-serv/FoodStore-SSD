# Design — C-02 `auth-sesion-tokens-bearer-refresh`

## Context

- Motivación, problemas del código actual y alcance: ver `proposal.md` (Why / What Changes). Requisitos: `specs/auth-session/spec.md`, `specs/user-registration/spec.md` y el delta de `specs/backend-config/spec.md` (todavía no escritos).
- Estado del código relevante:
  - `backend/app/core/deps.py`: `OAuth2PasswordBearerWithCookie` lee el access **solo** de la cookie `access_token`; el header Bearer está comentado. `core/deps.py` importa desde `modules/usuarios` (DT-25).
  - `backend/app/core/security.py`: `create_access_token` (claims `sub`, `roles`, `type`, `exp`), `create_refresh_token` (JWT + hash + expiración) y `decode_access_token` (verifica firma, `exp` y `type == "access"`).
  - `backend/app/modules/usuarios/`: todo auth vive acá (`auth_router`, `usuarios_router`, `admin_router` en un solo `router.py`; `UsuarioService` con login/refresh/logout; `RefreshTokenRepository.get_by_hash`; modelo `RefreshToken` con `usuario_id`, `token_hash` CHAR(64) único, `expires_at`, `revoked_at`, `created_at`). No existen módulos `auth` ni `refreshtokens`.
  - `backend/app/main.py`: CORS ya tiene `allow_credentials=True` con `CORS_ORIGINS` como lista.
  - El repo **no tiene Alembic** todavía (lo introduce C-06); hoy el esquema sale de `create_all` (lifespan y fixture de tests).
- Restricciones: reglas duras de `CLAUDE.md` (capas `models ← repository ← unit of work ← services ← routers`, sin `Session` ni lógica en routers, extender `BaseRepository`/`BaseService`, SOLID/DRY, migración Alembic para cambios de esquema, sin secretos en el repo), convención de configuración de C-01 (toda variable explícita, en `.env`/`.env.example`, declarada en `Settings`, obligatoria sin default oculto y fail-fast), Strict TDD en apply y governance **CRÍTICO** (nada de código sin aprobación del usuario sobre estos artefactos).

## Goals / Non-Goals

**Goals:**
- Hacer explícito el **cambio de modelo** de autenticación: dos secretos (access y refresh) más una entidad nueva, la **sesión**.
- Que cada pedido autenticado se valide sin tocar la BD (solo firma del access), y que la BD sea la única autoridad sobre la vigencia de la sesión.
- Trazabilidad completa: ninguna fila de sesión ni de refresh se borra; todo se marca.
- Que «revocar todas las sesiones de un usuario» sea una única operación reutilizable (logout-all, reuso y, a futuro, cambio de contraseña).

**Non-Goals:**
- Invalidar access tokens ya emitidos (no hay lista negra; ver Risks).
- Bloquear sesiones por IP o user agent.
- Endpoint de listado de sesiones activas (los metadatos quedan guardados para hacerlo después).
- Frontend (`authStore`, interceptor Axios): C-13+.

## Cambio de modelo (explícito)

El modelo cambia respecto del código actual y también respecto de la idea inicial del usuario. Esta tabla resume las tres versiones:

| | Código actual | Idea inicial del usuario | Modelo adoptado |
|---|---|---|---|
| **access_token** | JWT 30 min con `sub` y `roles`. Viaja **solo** en cookie HttpOnly `access_token`. | JWT con un claim que apunta al refresh guardado en la BD. | JWT HS256 30 min con `sub`, `roles`, `sid`, `type=access`, `exp`. Viaja en `Authorization: Bearer`; el frontend lo guarda en `authStore`. |
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
- Cookie HttpOnly con `path=/api/v1/auth` (el navegador no la envía a ninguna otra ruta), `max_age` hasta el vencimiento de la sesión, `secure` y `samesite` desde `Settings` (deja de estar `secure=False` fijo).
- Login y refresh la setean (`Set-Cookie`); logout y logout-all la borran. El refresh **no** aparece en ningún body, ni de entrada ni de salida.
- *Alternativa descartada*: refresh en el body y guardado por el frontend (`localStorage` o `authStore`). Lo expone a XSS; la spec solo persiste el `accessToken`.

### D4. Sesión como entidad, con vencimiento fijo
- La sesión se crea en el login y vence a `login + REFRESH_TOKEN_EXPIRE_DAYS` (7 días). Ese vencimiento **nunca cambia**: la rotación no lo extiende (sin sliding).
- 1 sesión → N refresh tokens (historial); como máximo uno activo (`revoked_at IS NULL`) a la vez.
- *Por qué*: separa lo que dura (la sesión) de lo que rota (el refresh). Sin sesión, el historial de refresh no tiene a qué agruparse y el vencimiento se corre con cada rotación (bug 3).
- *Alternativa descartada*: vencimiento deslizante. Permite que un refresh robado y usado con regularidad mantenga la sesión viva indefinidamente.

### D5. Esquema

Tabla nueva `sesion`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | Aleatorio (v4); es el claim `sid`. No secuencial, para no exponer volumen ni ser adivinable. |
| `usuario_id` | FK `usuario.id` | NOT NULL, indexado. |
| `expires_at` | TIMESTAMPTZ | Login + 7 días; nunca cambia. |
| `revoked_at` | TIMESTAMPTZ NULL | NULL = abierta. |
| `revoked_reason` | VARCHAR | `LOGOUT` \| `LOGOUT_ALL` \| `REUSO`; NULL si abierta. |
| `created_at` | TIMESTAMPTZ | |
| `ip` | VARCHAR NULL | Solo auditoría. |
| `user_agent` | TEXT/VARCHAR NULL | Solo auditoría. |

Tabla `refresh_token` ajustada:

| Columna | Cambio |
|---|---|
| `sesion_id` | **Nueva**, FK `sesion.id`, NOT NULL, indexada. |
| `token_hash` | Se mantiene: CHAR(64) único. |
| `revoked_at` | Se mantiene. Significa **«rotado»**; NULL = activo. Los motivos de cierre viven en la sesión, no acá. |
| `created_at` | Se mantiene. |
| `expires_at` | **Se elimina**: el vencimiento es de la sesión. |
| `usuario_id` | Se mantiene o se deriva de la sesión (se decide en specs/tasks; no cambia el diseño). |

- **Desviación de la spec (registrar en `knowledge-base/04`)**: el modelo de la spec lista `expires_at` (7 días) en `refresh_token` y no prevé una tabla de sesión. Se aparta porque, con vencimiento fijo por sesión, un `expires_at` por refresh duplicaría el dato y abriría la puerta a que diverjan. El comportamiento normativo se conserva: el refresh sirve como máximo 7 días desde el login, se guarda hasheado y se revoca con `revoked_at` (RN-AU-01, 04, 05).
- Los cambios se aplican con una **migración Alembic** (regla dura 9). Ver Open Questions sobre la ausencia de Alembic en el repo.

### D6. Flujos

1. **Login** (`POST /auth/login`): valida email y contraseña; credenciales inválidas o usuario con `deleted_at` → 401 «Credenciales incorrectas» (como hoy, RN-AU-03). Crea la sesión (`sid`, `+7d`, `ip`, `user_agent`) y su primer refresh (hash). Responde el access `{sub, roles, sid}` en el body y el refresh en `Set-Cookie`.
2. **Pedidos autenticados**: Bearer → verificación de firma (D1), sin consultar la sesión.
3. **Renovación** (`POST /auth/refresh`): cuando el access vence, el pedido recibe 401 y el interceptor Axios llama a `/auth/refresh`; el navegador envía la cookie solo. Tabla de decisión:

   | Refresh recibido | Respuesta |
   |---|---|
   | No existe (o no hay cookie) | 401 |
   | Su sesión está vencida o cerrada | 401: volver a loguearse, **sin alarma**. Cubre la sesión del celular que venció y el navegador de la PC después de un logout-all. |
   | Activo y sesión viva | **Rotar**: marcar `revoked_at` en el actual, crear uno nuevo con el mismo `sesion_id`, emitir access nuevo, `Set-Cookie` con el refresh nuevo. |
   | Rotado hace < `REFRESH_REUSE_GRACE_SECONDS` y sesión viva | **Período de gracia**: solo un access nuevo. La cookie **no** se toca (ese navegador ya tiene el refresh nuevo). |
   | Rotado hace > `REFRESH_REUSE_GRACE_SECONDS` y sesión viva | **REUSO**: cerrar **todas** las sesiones del usuario con motivo `REUSO`, registrar un warning en el log, 401. |

   *Por qué un refresh rotado implica reuso*: el cliente legítimo nunca reenvía un refresh reemplazado, porque al rotar su cookie quedó sobrescrita con el nuevo. Si llega uno rotado, alguien tiene una copia vieja. Quien llegue segundo (el ladrón o el usuario) dispara la detección, y la sesión muere para los dos. Se cierran **todas** las sesiones del usuario y no solo esa (criterio estilo GitHub) porque un mismo dispositivo puede tener varios navegadores y no hay forma de saber cuál está comprometido.

4. **Logout** (`POST /auth/logout`, requiere Bearer): toma el `sid` del access, cierra esa sesión (`LOGOUT`) y marca `revoked_at` en su refresh activo, borra la cookie, 204. No recibe body. Como el `sid` sale del propio access, ya no se puede cerrar la sesión de otro usuario (corrige el «menor» del proposal).
5. **Logout-all** (`POST /auth/logout-all`, requiere Bearer): cierra todas las sesiones abiertas del usuario (`LOGOUT_ALL`), borra la cookie, 204.
6. **`GET /auth/me`**: devuelve el usuario autenticado (mismo contrato que hoy `/usuarios/me`).

### D7. Período de gracia: carrera de dos pestañas

```
t=0.0  pestaña A ─ refresh R1 ─▶ servidor rota: R1 rotado, emite R2, Set-Cookie R2
t=0.1  pestaña B ─ refresh R1 ─▶ (salió antes de que llegara la cookie R2)
                                 R1 rotado hace 0.1 s < gracia → solo access nuevo
                                 (la cookie compartida del navegador ya es R2)
```

- Sin gracia, la pestaña B dispararía un falso REUSO y cerraría todas las sesiones del usuario.
- Valor: **30 s**, configurable con `REFRESH_REUSE_GRACE_SECONDS`, **obligatoria** y sin default oculto (convención de C-01: va en `.env`/`.env.example`, se declara en `Settings`, fail-fast si falta).
- En gracia no se emite un refresh nuevo ni se toca la cookie, así que la ventana no permite crear ramas paralelas de refresh.

### D8. Revocación masiva reutilizable
- Una única operación de service «revocar todas las sesiones abiertas de un usuario con motivo X» (y su consulta de repositorio). La usan logout-all (`LOGOUT_ALL`) y reuso (`REUSO`), y queda lista para el cambio de contraseña futuro (fuera de alcance).

### D9. Metadatos de sesión solo para auditoría
- `ip` y `user_agent` se toman del request en el login y se guardan en la sesión. **No** se comparan en refresh ni bloquean nada: la IP cambia entre wifi/4G/VPN, la geo-IP es imprecisa y el user agent se copia trivialmente. Sirven para auditoría y para una futura lista de «sesiones activas».

### D10. Fechas siempre aware en UTC
- Toda fecha se crea con `datetime.now(timezone.utc)` y las columnas son `TIMESTAMPTZ`. Desaparece `datetime.utcnow()`. Corrige el bug 2 (IN-08) y la comparación del período de gracia.

### D11. Capas y reutilización
- Sin `uow._session`: todo acceso a datos pasa por repositorios (`SesionRepository`, `RefreshTokenRepository`) que extienden `BaseRepository`, expuestos por la Unit of Work. Consultas nuevas (refresh por hash, sesiones abiertas de un usuario, revocación masiva) viven en el repositorio.
- Los routers solo traducen HTTP (leer cookie, setear/borrar cookie, códigos) y delegan en el service; la lógica de la tabla de decisión de D6 vive en el service.
- La cookie (nombre, `path`, `secure`, `samesite`, `max_age`) se setea y borra desde un único helper para no duplicar atributos entre login, refresh, logout y logout-all (DRY).
- Email duplicado → 409 (DT-12) en el método de creación central, que ya comparten registro y alta por admin.
- Se respeta el principio de C-01: no se amplía DT-25 (`core/deps.py` → `modules/`); su corrección no es parte de este change salvo que el renombre de módulos lo resuelva naturalmente.

### D12. Configuración
- Variables nuevas, **obligatorias** y sin default (fail-fast), en `Settings`, `backend/.env.example` y `backend/tests/.env.test.example`:
  - `REFRESH_REUSE_GRACE_SECONDS` (int, propuesto `30`).
  - Atributos de la cookie del refresh: `secure` (bool) y `samesite` (`lax` | `strict` | `none`). Nombres exactos a fijar en la spec delta de `backend-config` (por ejemplo `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_SAMESITE`).
- Se mantienen `ACCESS_TOKEN_EXPIRE_MINUTES` (30) y `REFRESH_TOKEN_EXPIRE_DAYS` (7, ahora vencimiento de la sesión).

### D13. Tests (Strict TDD en apply)
- Cada flujo de D6 y cada fila de la tabla de decisión tiene su test RED primero: login (body + cookie, sin refresh en body), Bearer aceptado y cookie de access ignorada, `/auth/me`, rotación (fila anterior marcada, misma sesión, cookie nueva), gracia (solo access, sin `Set-Cookie`), reuso (todas las sesiones con `REUSO`, 401), sesión vencida o cerrada (401 sin cerrar otras), vencimiento fijo (la rotación no lo corre), logout (204, sesión `LOGOUT`, cookie borrada), logout-all, 409, configuración obligatoria. El tiempo se controla de forma determinista (inyectando el «ahora» o ajustando timestamps en la BD), sin `sleep`.
- Los tests existentes que codifican deuda (cookie de access, 403 en email duplicado, refresh en body) se actualizan.

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-07
- Mockups: N/A

## Risks / Trade-offs

- [Cerrar una sesión no mata los access ya emitidos: viven hasta 30 min (RN-AU-06)] → Límite aceptado. Se mitiga con el TTL corto del access; una lista negra o verificar la sesión en cada pedido queda fuera de alcance.
- [Falso positivo de reuso (pestañas concurrentes, reintentos de red) cierra todas las sesiones del usuario] → Período de gracia de 30 s configurable (D7). El costo de un falso positivo es volver a loguearse, no pérdida de datos.
- [Un ladrón que usa el refresh robado **antes** que el usuario obtiene acceso hasta el próximo refresh del usuario legítimo] → Inherente a la rotación: en ese momento se detecta el reuso y mueren todas las sesiones. El vencimiento fijo de 7 días acota el peor caso.
- [La cookie del refresh requiere CORS con credenciales y depende de si frontend y API comparten sitio] → `allow_credentials=True` ya está; `samesite`/`secure` son configurables (Open Questions).
- [CSRF sobre `/auth/refresh` y `/auth/logout*`] → `/auth/refresh` solo devuelve el access en el body (otro origen no puede leerlo por CORS); logout y logout-all exigen Bearer, que un sitio ajeno no puede adjuntar. `samesite` agrega defensa en profundidad.
- [BREAKING para clientes actuales (Swagger con cookie, tests, refresh en body)] → Documentado en el proposal; el frontend todavía no existe (C-13), así que no hay clientes reales que migrar.
- [La migración invalida todos los refresh existentes] → Aceptado: no hay sesiones productivas; todos vuelven a loguearse.

## Migration Plan

1. Agregar a `backend/.env` y `backend/tests/.env.test` las variables nuevas obligatorias (D12), copiándolas de los `.example`.
2. Aplicar la migración del esquema (`sesion` nueva; `refresh_token` con `sesion_id` y sin `expires_at`). Los refresh existentes no tienen sesión: la migración los descarta o marca revocados (a definir en tasks); todos los usuarios vuelven a loguearse.
3. Clientes: enviar `Authorization: Bearer <access>`, usar `GET /auth/me`, llamar a `/auth/refresh` y `/auth/logout` sin body y con credenciales (cookie).

Rollback: revertir el código y bajar la migración. Las sesiones creadas con el modelo nuevo se pierden (los usuarios vuelven a loguearse).

## Open Questions

- **Alembic todavía no existe en el repo** (lo introduce C-06, y C-02 solo depende de C-01). La regla dura 9 exige migración Alembic para estos cambios de esquema. Hay que decidir antes de escribir tasks: adelantar a C-02 la inicialización mínima de Alembic, reordenar C-06 antes de C-02, o registrar una excepción explícita hasta C-06. **Requiere decisión del usuario** (cambia la lista de tasks).
- **Valor de `samesite` de la cookie del refresh**: depende de si el frontend y la API comparten sitio en desarrollo y producción. Propuesta por defecto en los `.example`: `lax`; `strict` es posible si comparten sitio. Si quedan en sitios distintos haría falta `none` + `secure=true`.
- **CORS con credenciales**: `allow_credentials=True` ya está en `main.py`; confirmar que `CORS_ORIGINS` nunca use `*` (incompatible con credenciales) y que el frontend use `withCredentials` solo hacia `/api/v1/auth`.
- **Renombre de módulos de CHANGES.md** («renombrar `auth` y `refreshtokens` a los nombres de la spec»): hoy no existen esos módulos; auth vive dentro de `modules/usuarios`. Falta confirmar si el renombre aplica tal cual (por ejemplo, extraer un módulo `auth` con sesión y refresh) o si se redefine o pospone a C-25.
