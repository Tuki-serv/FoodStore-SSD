# Design — C-14 `fe-auth-cuenta`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/frontend-account/spec.md` y `specs/user-profile/spec.md`.

### Contrato real verificado (`dev`, 2026-11-19)

| Operación | Request | Éxito | Errores relevantes |
|-----------|---------|-------|--------------------|
| `POST /api/v1/auth/login` | `application/x-www-form-urlencoded`: `username` (= email), `password` | 200 `{access_token, token_type:'bearer', expires_in}` + cookie `refresh_token` (`Path=/api/v1/auth`) | 401 `HTTP_401` «Credenciales incorrectas» (también usuario dado de baja); 429 `RATE_LIMIT_EXCEEDED` + `Retry-After` (5 fallos/IP/15 min, el 429 corta antes de verificar); 422 si falta `username`/`password` |
| `POST /api/v1/auth/register` | JSON `UserCreate {nombre≤80, apellido≤80, email: EmailStr, celular?≤20, password≥8}` | 201 `UserPublic {id, nombre, apellido, email, celular}`; **no abre sesión** | 409 `HTTP_409` «El email ya está registrado», `field: null`; 422 `VALIDATION_ERROR`, `field` = último `loc`. Hoy acepta `nombre: ""` y `EmailStr` solo pasa a minúsculas el dominio (`Ana@X.com` → `Ana@x.com`) |
| `GET /api/v1/auth/me` | Bearer | 200 `UserPublicAdminPanel` (con `roles[{codigo,nombre}]`) | 401 |
| `PATCH /api/v1/usuarios/me` | Bearer, JSON `UserUpdateClient {nombre?, apellido?, celular?}` (extra ignorado) | 200 `UserPublic` (**sin roles**) | 401; 422; hoy `nombre: null` explícito → `setattr` a NOT NULL → 500 y `""` se acepta (se corrige en D12) |
| `POST /api/v1/auth/logout-all` | Bearer, sin body | 204, borra la cookie | 401 (lo renueva el interceptor) |
| `GET /api/v1/usuarios/me` | Bearer | 200 (duplicado de `/auth/me`) | — **se retira en este change** |

Búsqueda del usuario: `UsuarioRepository.get_by_email` (`backend/app/modules/usuarios/repository.py:13`) compara `Usuario.email == email` exacto; el login le pasa `form_data.username` (str crudo) y el registro el email de `UserCreate`. Unicidad en la base: índice único parcial `uq_usuario_email_activo (email) WHERE deleted_at IS NULL` (migración 001); cabeza actual de Alembic: `004`.

Frontend existente (C-13b/C-15): `abrirSesion(access)` (`@/entities/session`), `useCerrarSesion`, `cerrarTodasLasSesionesRemota`/`aUsuarioSesion`/`apiClient`/`ApiError`/`mensajeDeCampo` (`@/shared/api`), `useAuthStore.establecerUsuario`/`cerrarLocal({motivo})` (`@/shared/auth`), `RequiereAcceso` (ruta `anonima` → destino recordado o `/catalogo`; motivo `logout` → `/catalogo`), `URLS_SIN_RENOVACION` incluye `/auth/login`, `shared/ui/campo`, `Dialogo`, `ConfirmacionGlobal` + `confirmModal` de `uiStore`, `avisarExito`/`avisarError`, helpers de test `renderApp`, `handlerMe`, `handlerRefreshOk`, `esperarSinViolacionesA11y`. `UsuarioSesion.roles` guarda solo códigos.

## Goals / Non-Goals

**Goals:**
- Tres pantallas reales (`/ingresar`, `/registrarse`, `/mi-cuenta`) con TanStack Form y mensajes por `code`/`status`, nunca por el texto de `detail`.
- Reusar la sesión de C-13b sin duplicar lógica: el login solo obtiene el access y delega en `abrirSesion`; la navegación posterior la hacen los guards.
- Retirar `GET /usuarios/me` del backend con sus tests (deuda que C-25a delegó acá).
- Endurecer el backend del alta y del perfil: `nombre`/`apellido` vacíos o `null` → 422 (DU-3).
- Email insensible a mayúsculas: el backend lo normaliza en el alta y en el login, con migración de datos (DU-4).

**Non-Goals:**
- Cambiar el contrato de `/auth/*` o `PATCH /usuarios/me` más allá del retiro del `GET` (D10), la validación de nombre/apellido (D12) y la normalización del email (D13); cambio/recuperación de contraseña, cambio de email, lista de sesiones por dispositivo, «mostrar contraseña» (se puede sumar si el mockup lo pide); normalizar `celular` (`""` sigue aceptándose en el backend; el frontend manda `null`).

## Decisions

### Decisiones del usuario (2026-11-19)

Las preguntas OQ-1..OQ-5 quedaron resueltas por el usuario; specs y tasks ya las reflejan.

- **DU-1 (ex OQ-1 = A) — Auto-login tras registrarse.** Tras el 201 se hace `POST /auth/login` con las mismas credenciales → `abrirSesion`; si ese login falla, se va a `/ingresar` con el email precargado y el aviso «Tu cuenta se creó. Ingresá para continuar.» (D5). *Alternativa descartada*: ir siempre a `/ingresar` (un paso más para el usuario).
- **DU-2 (ex OQ-2 = A) — Se retira `GET /usuarios/me` en C-14** (405; queda el `PATCH`), ajustando `test_auth.py`, `test_exception_handlers.py`, `test_contrato_rutas.py` y `rbac_matriz.py` (D10). *Alternativa descartada*: dejarlo para C-25b.
- **DU-3 (ex OQ-3 = B) — Se endurece el backend.** `UserCreate` y `UserUpdateClient` recortan y exigen `nombre`/`apellido` con `min_length=1` y el `PATCH` rechaza `null` explícito en `nombre`/`apellido` con 422 `VALIDATION_ERROR` (hoy 500) (D12). *Alternativa descartada*: validar solo en el cliente y anotar deuda.
- **DU-4 (ex OQ-4 = B) — El backend normaliza el email** (recorte + minúsculas) en el alta (registro público y ADMIN) y en la búsqueda del login, con una migración `005` que normaliza los emails existentes y una restricción que impide guardar emails sin normalizar (D13). *Alternativa descartada*: solo recortar en el cliente (un usuario registrado como `Ana@x.com` no podía ingresar con `ana@x.com`).
- **DU-5 (ex OQ-5 = A) — «Repetir contraseña» en el registro**, validado solo en el cliente (debe coincidir) y nunca enviado al backend (D7). *Alternativa descartada*: sin confirmación.

### D1 — Ubicación FSD
- `shared/api/auth.ts`: se agregan `iniciarSesionRemota({email, password}) → {access_token, expires_in}` (envía `URLSearchParams`), `registrarUsuarioRemoto(datos) → UsuarioPublico` y `actualizarPerfilRemoto(datos) → UsuarioPublico`. Junto a las existentes porque son llamadas HTTP crudas del mismo recurso (`auth`) y las usan varias capas.
- `entities/session`: nuevas mutaciones `useIniciarSesion` (login → `abrirSesion`), `useRegistrarse` (register → login → `abrirSesion`, D5), `useActualizarPerfil` (PATCH → `establecerUsuario({...respuesta, roles: rolesActuales})`), `useCerrarTodasLasSesiones` (logout-all → `cerrarLocal({motivo:'logout'})` en `onSettled`, igual que `useCerrarSesion`). Viven en la entidad sesión porque todas terminan modificando la sesión; no se crea una entidad `usuario` aparte (alternativa descartada: `entities/usuario` duplicaría el tipo `UsuarioSesion` y quedaría acoplada a la sesión igual).
- `pages/ingresar`, `pages/registrarse`, `pages/mi-cuenta`: `ui/` (página + formulario), `model/` (validadores puros y mapeo de errores), `index.ts`. Sin `features/` nuevas: cada formulario lo usa una sola página (regla FSD: no extraer hasta que se reutilice).
- `shared/config/roles.ts`: `NOMBRE_ROL: Record<Rol, string>` (`Cliente`, `Gestor de pedidos`, `Gestor de stock`, `Administrador`) para mostrar roles en «Mi cuenta» (la sesión solo guarda códigos; alternativa descartada: guardar `{codigo,nombre}` en la sesión cambiaría `frontend-session`).

### D2 — Login como form OAuth2
`apiClient.post('/auth/login', new URLSearchParams({username, password}))`: Axios pone `application/x-www-form-urlencoded` solo. `apiClient` ya usa `withCredentials`, así la cookie del refresh queda guardada. Un 401 no dispara renovación (exclusión ya existente) — lo cubre un test que verifica que no se pidió `/auth/refresh`.

### D3 — Mapeo de errores a la UI (función pura por página)
`model/errores.ts` en cada página traduce `ApiError` → `{ campos: Partial<Record<Campo, string>>, alerta?: string, bloqueoHasta?: number }`:
- Ingresar: `status 401` → alerta «Email o contraseña incorrectos.» y se limpia la contraseña; `code RATE_LIMIT_EXCEEDED` → aviso «Demasiados intentos. Probá de nuevo en N minutos.» con `N = ceil(retryAfter/60)` y `bloqueoHasta = ahora + retryAfter*1000` (sin `retryAfter` → aviso sin tiempo, sin bloqueo); resto → alerta con `detail`.
- Registrarse: `status 409` → campo `email` «Ya existe una cuenta con este email.» + enlace a `/ingresar` (se decide por status porque el backend manda `field: null`; alternativa descartada: pedir `field:'email'` al backend, fuera de alcance); `VALIDATION_ERROR` con `field` ∈ campos → mensaje en el campo (`mensajeDeCampo`); resto → alerta.
- Mi cuenta: igual que registro sin el 409.
Los errores del servidor se guardan en estado local de la página (como `nombreRepetido` en los formularios de C-17a/C-17b) y se muestran en el `Campo` correspondiente junto a los errores de validación; se limpian al editar ese campo o al reenviar.

### D4 — Bloqueo del botón por 429
Estado local `bloqueoHasta: number | null` + un `setTimeout` que lo limpia; el botón queda `disabled` mientras `Date.now() < bloqueoHasta`. Se guarda en la página (no en Zustand): al recargar se pierde y el backend vuelve a responder 429 si corresponde, que es la fuente de verdad. Alternativa descartada: persistir el bloqueo (agrega estado de cliente sin beneficio de seguridad).

### D5 — Registro seguido de login (DU-1)
`useRegistrarse` encadena `registrarUsuarioRemoto` → `iniciarSesionRemota` → `abrirSesion`. Si el registro falla, el error es del registro (se mapea con D3). Si falla el login posterior, la cuenta ya existe: se navega a `/ingresar` con `state: {email, cuentaCreada: true}` y la página muestra «Tu cuenta se creó. Ingresá para continuar.» con el email precargado. El email precargado es el que devolvió el registro (`UserPublic.email`, ya normalizado por D13).

### D6 — Perfil desde la sesión, sin consulta propia
«Mi cuenta» lee `useSesion().usuario` (ya vino de `GET /auth/me`); no hay `useQuery` del perfil ni pedido a `/usuarios/me`. Tras el `PATCH`, `establecerUsuario` reemplaza nombre/apellido/celular/email conservando `roles` (la respuesta no los trae). El panel lateral se actualiza solo porque lee el store. Alternativa descartada: `useQuery(['sesion','perfil'])` sobre `/auth/me` — duplicaría la fuente de verdad del usuario.

### D7 — Normalización de envío
Textos con `trim()`; `celular` vacío → `null`; el email solo se recorta (pasarlo a minúsculas es responsabilidad del backend, D13: una sola regla, aplicada también a clientes que no sean este frontend). «Repetir contraseña» (`confirmacion`) es un campo solo del formulario: se valida que coincida con `password` y se descarta en `aDatosRegistro` (DU-5). En el `PATCH` se mandan siempre los tres campos (objeto completo, como en C-15), nunca `null` en nombre/apellido (garantizado por tipo y, desde D12, rechazado por el backend).

### D8 — Cerrar todas las sesiones
Botón secundario de peligro en la sección «Sesiones» de «Mi cuenta» → `pedirConfirmacion({titulo:'¿Cerrar todas las sesiones?', texto:'Vas a salir en este y en todos tus dispositivos.', textoConfirmar:'Cerrar todas', variante:'peligro'})` → `useCerrarTodasLasSesiones`. Con motivo `logout`, `ShellConSesion`/`RequiereAcceso` ya llevan a `/catalogo` y descartan la caché privada (comportamiento de C-13b). El access vigente de otros dispositivos sigue válido hasta su `exp` (RN-AU-06): se avisa en el texto de ayuda.

### D9 — Rutas reales
`PAGINAS` en `routes.tsx` suma `[RUTAS.ingresar]: IngresarPage`, `[RUTAS.registrarse]: RegistrarsePage`, `[RUTAS.miCuenta]: MiCuentaPage`. No cambian `ACCESO_RUTAS` ni `MAPA_RUTAS`. Enlaces cruzados: «¿No tenés cuenta? Registrate» y «¿Ya tenés cuenta? Ingresá».

### D10 — Retiro de `GET /usuarios/me` (DU-2)
Se borra el handler `read_user_me` de `usuarios/router.py`; el `PATCH` queda. Tests: `test_auth.py` (clase de perfil) pasa a `GET /auth/me`; `test_exception_handlers.py` usa `GET /auth/me` para el 401 sin token; `test_contrato_rutas.py` quita la fila `GET`; `rbac_matriz.py` quita la fila con dueño «C-14/C-25a (retiro)». Nuevo test RED: `GET /usuarios/me` → 405. Sin migración.

### D11 — Tests
Vitest + RTL + MSW (`onUnhandledRequest: 'error'`, `server.use` por test), sin `vi.mock` de módulos propios; `renderApp` para flujos con router y guards; timers falsos solo en el test del bloqueo 429. Handlers nuevos en `src/test/msw/auth.ts`: `handlerLogin(resp)`, `handlerRegister(resp)`, `handlerPatchPerfil(resp)`, `handlerLogoutAll(resp)` con registro de cuerpos recibidos. Backend: pytest contra `foodstore_test` (PostgreSQL real); la migración `005` se prueba con la fixture `migrations_db` de `test_migrations.py` (upgrade/downgrade sobre una base aparte).

### D12 — Nombre y apellido obligatorios en el backend (DU-3)
- Un tipo anotado reutilizable en `usuarios/schemas.py`: `NombrePersona = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]`, usado por `UserCreate.nombre/apellido` (obligatorios) y `UserUpdateClient.nombre/apellido` (`Optional[NombrePersona] = None`). Así `"   "` → 422 y `" Ana "` se guarda `Ana`.
- `null` explícito en el `PATCH`: un `field_validator("nombre", "apellido", mode="before")` en `UserUpdateClient` que lanza `ValueError` si el valor es `None`. En Pydantic v2 un validador no corre sobre un campo omitido (sin `validate_default`), así que omitir sigue significando «no cambiar» y `null` → 422 `VALIDATION_ERROR` con `field` `nombre`/`apellido` (el handler existente toma el último `loc`). `celular: null` sigue permitido (borra el celular).
- Herencia: `UserCreateAdmin` y `UserUpdateAdmin` heredan la regla (mismo invariante para el alta/edición por ADMIN; C-23 lo hereda). *Alternativa descartada*: validar en el service (duplicaría lo que Pydantic ya expresa y el 422 dejaría de tener `field`).
- Gobernanza: toca el alta de usuarios (auth, CRÍTICO) → solo con el OK del usuario a este plan.

### D13 — Email normalizado en el backend (DU-4)
**Regla única.** `normalizar_email(valor: str) -> str` = `valor.strip().lower()` (función pura en `app/core/`, sin dependencias de capas superiores). Se aplica en dos puntos, y en ningún otro:
1. **Alta** — `field_validator("email", mode="before")` en `UserCreate` (heredado por `UserCreateAdmin`): normaliza antes de que valide `EmailStr`. `Ana@Example.com ` → `ana@example.com`.
2. **Búsqueda** — `UsuarioRepository.get_by_email` normaliza su argumento antes de comparar. Cubre el login (`form_data.username` es un `str` crudo de OAuth2 que no pasa por ningún schema), el chequeo de duplicado del registro y cualquier búsqueda futura. La comparación sigue siendo por igualdad (usa el índice existente).
Se pasa a minúsculas también la parte local: los proveedores reales no distinguen mayúsculas y la alternativa (comparar distinguiendo) es justo el problema que se corrige. El rate limit no cambia (va por IP).

**Datos existentes — migración `005_email_normalizado`** (regla dura 9; dominio HIGH: modifica datos de usuarios):
1. *Pre-chequeo de colisiones*: `SELECT lower(btrim(email)), array_agg(id) FROM usuario WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1`. Si hay alguna (p. ej. `Juan@x.com` y `juan@x.com` activos), el `upgrade` **aborta** con un error que lista email e ids; la transacción no deja cambios. Se resuelve a mano (dar de baja una de las cuentas) y se vuelve a migrar. *Alternativa descartada*: resolver sola (dar de baja la más nueva o fusionar): pierde datos o pedidos de una persona real sin que nadie lo decida (OQ-6).
2. *Normalización*: `UPDATE usuario SET email = lower(btrim(email)) WHERE email <> lower(btrim(email))`, **incluidas** las filas dadas de baja (el índice es parcial, así que entre bajas o entre una baja y una activa no hay conflicto; y el seed busca por email también entre las bajas).
3. *Invariante*: `CHECK ck_usuario_email_normalizado (email = lower(btrim(email)))`, declarado también en `Usuario.__table_args__` para que modelos y migraciones coincidan. Se **conserva** `uq_usuario_email_activo (email) WHERE deleted_at IS NULL`: con todos los emails normalizados, unicidad sobre `email` equivale a unicidad sobre `lower(email)`, así que **no** se agrega un índice único sobre `lower(email)`.
4. *Downgrade*: quita el CHECK. Los emails no vuelven a su forma original (no se guardó) — se documenta; el downgrade corre sin error y la ida y vuelta queda sin diferencias de esquema.

*Alternativas descartadas para la unicidad*: (a) índice único funcional sobre `lower(email)` sin reescribir datos: obliga a que cada consulta use `func.lower(...)` para aprovecharlo y a recordar la regla en cada búsqueda; (b) extensión `citext`: suma una dependencia de extensión a la base y a los tests por un solo campo. El CHECK + el índice actual dan la misma garantía con menos piezas.

**Seed y fixtures (verificado 2026-11-19)**: `backend/app/db/seed.py` usa solo emails en minúsculas (`admin@foodstore.com`, `cliente@foodstore.com`, `pedidos@foodstore.com`, `stock@foodstore.com`) y los tests de `backend/tests/` también (no hay ningún email con mayúsculas en los `.py`). No hace falta tocar el seed; con el CHECK, un email sin normalizar insertado a mano falla en la base (deseable).

**Impacto en tests existentes**: la cabeza pasa de `004` a `005` → actualizar las aserciones de versión en `tests/integration/test_migrations.py`, `tests/integration/test_reset.py` y `tests/unit/test_alembic_config.py`; agregar el CHECK a `tests/support/schema_expectations.py` si enumera restricciones.

### Skills aplicables (`.atl/skill-registry.md`)
`feature-sliced-design`, `tanstack-query`, `tanstack-form`, `zustand` (solo ideas generales), `react-testing`, `vitest`, `tdd`; para el backend `python-testing-patterns`; para los mockups `design-system`, `emil-design-eng`, `design-taste-frontend-v1`, `tailwind-design-system` (prevalecen los tokens del proyecto).

## Risks / Trade-offs

- [Auto-login tras registro choca con el rate limit] → solo cuentan los fallos; con las mismas credenciales recién creadas el login no falla. Si igual falla, D5 lleva a `/ingresar` con aviso.
- [El 409 del registro no trae `field`] → se decide por `status`; un test fija ese contrato para detectar si el backend cambia.
- [Enumeración de cuentas por el 409 del registro] → es el contrato de la spec (RN-AU-07); el login no revela cuál dato falló (D3).
- [Colisiones de email al normalizar datos existentes] → la `005` aborta y lista los casos; nada se borra solo (D13, OQ-6). En la base de desarrollo y en la de tests no se esperan colisiones (seed y fixtures en minúsculas).
- [La `005` modifica datos de usuarios y no es reversible en los datos] → el downgrade quita el CHECK pero no restaura mayúsculas; se pide OK explícito (HIGH, OQ-7) y se recomienda backup antes de migrar una base con usuarios reales.
- [Minúsculas en la parte local del email] → en teoría la parte local distingue mayúsculas (RFC 5321); en la práctica ningún proveedor lo hace. Aceptado.
- [Endurecer `UserUpdateClient` afecta al ADMIN (`UserUpdateAdmin` hereda)] → deseado: mismo invariante; C-23 parte de él.
- [Retirar `GET /usuarios/me` rompe clientes externos] → no hay otros clientes; el frontend no lo usa (verificado con grep).
- [El bloqueo de 429 se pierde al recargar] → aceptado: el backend es la fuente de verdad (D4).

## Migration Plan

Una migración Alembic nueva, `005_email_normalizado` (D13): pre-chequeo de colisiones (aborta si hay), normalización de `usuario.email` y `CHECK ck_usuario_email_normalizado`. Despliegue: backup de la base → `alembic upgrade head` (desde `backend/`) → si aborta por colisiones, resolverlas a mano y repetir. Rollback: `alembic downgrade 004` (quita el CHECK; los emails quedan en minúsculas, que el código anterior también acepta) y revertir el commit (las rutas vuelven a la página provisoria y el `GET /usuarios/me` reaparece).

## Open Questions

OQ-1..OQ-5 resueltas el 2026-11-19 (ver «Decisiones del usuario», DU-1..DU-5). Quedan para confirmar con el usuario antes de apply (tienen valor recomendado aplicado en specs y tasks):

- **OQ-6 (RESUELTA 2026-11-19: la `005` aborta y lista las colisiones para resolverlas a mano) — Colisiones al normalizar emails existentes.** Recomendado: la `005` aborta y lista los casos para resolverlos a mano (D13). Alternativa: resolver automáticamente (p. ej. dar de baja la cuenta más nueva).
- **OQ-7 (RESUELTA 2026-11-19: migración `005` aprobada, incluida la minúscula de la parte local) — OK explícito a la migración de datos `005`** (dominio HIGH: reescribe emails de usuarios; los datos no vuelven atrás con el downgrade).

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-14-fe-auth-cuenta/mockups/`
- Approval: approved (2026-11-19, by user) (revisión de mockup 2026-11-19: botón «Cerrar sesión» en Mi cuenta; las pantallas de Ingresar y Registrarse siguen aprobadas)
- Revisión de mockup 2026-11-19: botón «Cerrar sesión» en Mi cuenta (tarjeta «Sesiones»: «Cerrar sesión» neutro + «Cerrar todas las sesiones» en peligro; solo cambia `mi-cuenta.html` y sus 14 capturas). La revisión fue aprobada por el usuario el 2026-11-19.
- Preview: rendered (2026-11-19, `mockups/previews/` — 18 estados × 1440x900 y 390x844 = 36 capturas; Edge + playwright-core porque el Playwright MCP no tiene Chrome; sin errores de consola ni scroll horizontal)
- Visual verify: passed (2026-11-19; ver `## Verify`). Incluye la revisión del botón «Cerrar sesión» en Mi cuenta a 1440x900 y 390x844, tras corregir una especificidad CSS (`.danger-zone .row > .sesiones-actions` en `frontend/src/pages/mi-cuenta/ui/mi-cuenta.css` pisaba el estilo del botón).

Archivos: `mockups/ingresar.html` (vacío, errores, credenciales, bloqueo, enviando, red, cuenta-creada), `mockups/registrarse.html` (vacío con «Repetir contraseña», errores, email-duplicado, enviando), `mockups/mi-cuenta.html` (datos, `?rol=admin`, guardando, guardado, validacion, error-servidor, cerrar-todas), con `mockup.css`/`mockup.js` (copiados de C-19) y `cuenta.js` (shell con y sin sesión); detalle en `mockups/README.md`. Panel lateral de la Revision 2. Al aprobarse, son criterio de aceptación de los bloques 4–6 de `tasks.md`.

## Notas de implementación

Resultado (2026-11-19): backend 1729 tests verdes (línea base 1706); frontend 116 archivos / 1079 tests verdes (línea base 107 / 986), `typecheck` y `lint` sin errores.

### Escenario → test

Rutas relativas a `frontend/src/` y `backend/tests/`. `ing` = `pages/ingresar/__tests__/ingresar-page.test.tsx`, `reg` = `pages/registrarse/__tests__/registrarse-page.test.tsx`, `cta` = `pages/mi-cuenta/__tests__/mi-cuenta-page.test.tsx`, `uv` = `integration/test_usuarios_validacion.py`, `mig` = `integration/test_migrations.py`.

| Spec / escenario | Test |
|------------------|------|
| frontend-account · Login correcto | `ing` «login correcto…»; `entities/session/__tests__/iniciar-sesion.test.tsx` (cuerpo urlencoded) |
| · Vuelta a la ruta recordada | `ing` «vuelve a /direcciones…» |
| · Usuario no recuperable tras el login | `ing` «login 200 pero /auth/me 404…»; `iniciar-sesion.test.tsx` |
| · Campos vacíos / Email mal formado | `ing` «enviar vacío…», «un email mal formado…»; `pages/ingresar/__tests__/validacion.test.ts` |
| · Contraseña equivocada | `ing` «401: alerta…» (sin `/auth/refresh`) |
| · Bloqueo con tiempo / Fin del bloqueo / 429 sin Retry-After | `ing` bloque «bloqueo por 429» (timers falsos 838 s / 841 s) |
| · Backend caído | `ing` «sin respuesta…» |
| · Doble clic en Ingresar | `ing` «doble clic…» |
| · Cuerpo enviado (registro) | `reg` «envía el cuerpo exacto…»; `registrarse/__tests__/validacion.test.ts` (`aDatosRegistro`) |
| · Registro y sesión / Registro correcto con login fallido | `reg` «registro 201 + login 200…», «…login 429…»; `cuenta.test.tsx` (`useRegistrarse`) |
| · Contraseña corta / Contraseñas distintas / Nombre y apellido en blanco / Nombre de 81 | `reg` (los cuatro) y `registrarse/__tests__/validacion.test.ts` |
| · Email duplicado | `reg` «409 (field null)…» |
| · Email rechazado por el servidor / Campo desconocido | `reg` «422 con field email», «422 con field body» (y `nombre`) |
| · Cliente ve su perfil | `cta` «un cliente ve sus datos…» (sin pedidos a `/usuarios/me`) |
| · Cambio de nombre / Validación del perfil / Error del servidor al guardar | `cta` «cambiar el nombre…», «apellido vacío…», «503…» (+ 422 `celular`, celular de 21, doble clic) |
| · Confirmar / Cancelar / Backend caído (cerrar todas) | `cta` bloque «cerrar todas las sesiones»; `cuenta.test.tsx` (`useCerrarTodasLasSesiones`) |
| · Formulario de registro con errores (a11y) / Autocompletado del ingreso | `reg` «axe…», «autocompletado…»; `ing` «axe…», «autocompletado…» |
| user-profile · Cambio de nombre / Intento de cambiar roles o email / Sin token / Textos recortados | `integration/test_auth.py::TestMe`, `uv::TestNombreYApellidoEnElPerfil::test_nombre_con_espacios…` |
| · Nombre nulo / Apellido en blanco / Celular nulo | `uv::TestNombreYApellidoEnElPerfil` |
| · GET del duplicado retirado / Lectura vigente | `integration/test_auth.py::TestMe` (405 y `GET /auth/me`) |
| user-registration · Registro con mayúsculas y espacios / Duplicado que solo difiere en mayúsculas | `uv::TestEmailNormalizado` (+ `unit/test_normalizar_email.py`) |
| · Nombre en blanco / Apellido vacío / Textos recortados | `uv::TestNombreYApellidoEnElAlta` (incluye alta ADMIN) |
| auth-session · Email con mayúsculas y espacios / Contraseña incorrecta con email en mayúsculas | `uv::TestEmailNormalizado` |
| backend-db-migrations · Esquema tras el upgrade / Email sin normalizar insertado directamente | `mig` `test_tras_upgrade_head_la_version_es_005…`, `test_la_base_rechaza_un_email_sin_normalizar…` |
| · Emails existentes normalizados / Colisión entre activos / Colisión con un dado de baja | `mig` `test_upgrade_de_004_a_005…`, `…colisionan_falla_listando…`, `…un_activo_y_un_dado_de_baja…` |
| · Downgrade a la 004 | `mig` `test_downgrade_de_005_a_004…` y `test_ida_y_vuelta_005_004_005…` |

### Desvíos y observaciones

- Los tests de `nombre`/`apellido` y de email normalizado del backend viven en un archivo nuevo, `backend/tests/integration/test_usuarios_validacion.py`, en lugar de `test_auth.py` (que ya tiene ~330 líneas de otros temas); `test_auth.py` conserva la clase `TestMe` (perfil, 405, `PATCH`).
- El campo `email` de `/ingresar` es `type="email"`: el navegador recorta los espacios al borde al asignar el valor, así que el campo nunca contiene ` ana@example.com ` (los tests esperan `ana@example.com`); `iniciarSesionRemota` también recorta, por si el valor llega de otro origen.
- «Cerrar todas las sesiones»: `ConfirmModal` (`uiStore`) solo tiene `titulo` y `mensaje`; el aviso «Para volver a entrar vas a necesitar tu email y tu contraseña.» del mockup (que era un bloque aparte) va como segunda oración del `mensaje`. `.btn-danger-outline` se implementó con utilidades de Tailwind sobre los tokens (`border-danger`, `text-danger`, `hover:bg-danger-bg`) en lugar de una clase nueva.
- Los hooks `useRegistrarse`, `useActualizarPerfil` y `useCerrarTodasLasSesiones` (3.4–3.6) y los validadores de las páginas se escribieron con sus tests en el mismo paso: la ejecución en rojo se comprobó en los bloques de página y en el backend; en esos hooks y validadores los tests nacieron en verde.
- `normalizar_email` vive en `backend/app/core/email_normalizado.py` (no `email.py`, para no confundir con el módulo estándar `email`).
- `.err a` en `shared/ui/campo`: `Campo.error` pasó de `string` a `ReactNode` para poder incluir el enlace «Ingresar» del 409.
- Línea base del backend: `test_limitador_por_clave.py::test_retry_after_es_el_tiempo_hasta_que_vence_el_fallo_mas_antiguo` falló una vez cuando la suite corría en paralelo con otros procesos; pasa aislado y en la corrida final (intermitente de temporización, ajeno al change).
- Sin cambios en `route-map.test.ts`, `routes.test.tsx` ni `guards.test.tsx`: no dependían de la página provisoria (se usan los títulos «Ingresar», «Mi cuenta» y los redirects, que no cambiaron).

## Verify (2026-11-19)

- Visual verify: passed (2026-11-19). Cierre: el botón «Cerrar sesión» de Mi cuenta (bloque 9) se revisó en el navegador a 1440x900 y 390x844 después de corregir la especificidad CSS de `.danger-zone .row > .sesiones-actions` en `frontend/src/pages/mi-cuenta/ui/mi-cuenta.css`; ambos viewports quedan OK.
- Visual verify: passed (2026-11-19; re-verificación tras los arreglos de abajo; el resultado original fue `differences`). Resultado original (2026-11-19, con aprobación del usuario para levantar los servidores). App real (backend + PostgreSQL de desarrollo migrada a `005` sin colisiones + seed, Vite) capturada con Edge + playwright-core a 1440x900 y 390x844 en `mockups/verify/` (~35 capturas + `_log.txt`): `/ingresar` (vacío, validación, 401, 429 real), `/registrarse` (vacío, validación, contraseñas distintas, 409, registro correcto con auto-login), `/mi-cuenta` (CLIENT y ADMIN, validación, guardado con toast y panel actualizado, diálogo «Cerrar todas las sesiones» y cierre efectivo → `/catalogo`) y login con email en mayúsculas y espacios (OK). Coincide en lo esencial con los mockups. Diferencias: (major) el 429 real no muestra el tiempo ni bloquea el botón: el backend no expone `Retry-After` por CORS (`CORSMiddleware` sin `expose_headers`), así que el navegador cross-origin no lo lee y la pantalla muestra «unos minutos» con «Ingresar» habilitado (los tests con MSW no lo detectan); (minor) los enlaces dentro de texto («Registrate», «Ingresá», «Ingresar» del 409) sin subrayado, el mockup sí; (minor) el diálogo «Cerrar todas» une el aviso del mockup (caja ámbar) como segunda oración del mensaje (desvío ya documentado). Sin errores de consola propios: solo los 401 esperados (refresh previo al login, credenciales malas) y el 409.
- No capturados: `ingresar-enviando`, `registrarse-enviando`, `mi-cuenta-guardando` (estados transitorios), `ingresar-red` y `mi-cuenta-error-servidor` (requieren backend caído/503; cubiertos por tests), `ingresar-cuenta-creada` (requiere login fallido tras registro; cubierto por tests).
- Arreglos (2026-11-19, aprobados por el usuario): (1) **major corregido** — `CORSMiddleware` en `backend/app/main.py` ahora tiene `expose_headers=["Retry-After"]` (causa raíz: CORS solo deja leer al navegador las cabeceras «safelisted»; los tests con MSW no pueden detectarlo). Tests en `backend/tests/integration/test_rate_limit.py::TestRetryAfterExpuestoPorCors` (429 cross-origin y respuesta normal exponen `Retry-After`; origen no permitido sigue sin `Allow-Origin`). Re-verificado en el navegador: `/ingresar` tras 5 fallos muestra «Probá de nuevo en 15 minutos» y el botón «Ingresar» queda deshabilitado (`mockups/verify/ingresar-bloqueo-fix-{desktop,mobile}.png`). (2) **minor corregido** — los enlaces en texto («Registrate», «Ingresá», «Ingresar» del 409) llevan `text-decoration:underline` en `shared/ui/tarjeta-auth/tarjeta-auth.css` (causa: el preflight de Tailwind quita el subrayado por defecto que sí tenían los mockups); cambio de estilo puro, sin test; captura `mockups/verify/ingresar-enlace-fix-desktop.png`.

### Cerrar sesión desde Mi cuenta (bloque 9, 2026-11-19)

`cta` = `pages/mi-cuenta/__tests__/mi-cuenta-page.test.tsx`, describe «cerrar sesión». El botón vive en la tarjeta «Sesiones» (`useCerrarSesion`, sin diálogo); la cabecera de la app también tiene un «Cerrar sesión», por eso los tests acotan a `region «Sesiones»`. Frontend: 116 archivos / 1084 tests verdes (+5), `typecheck` y `lint` sin errores.

| Escenario | Test |
|-----------|------|
| Cerrar sesión (Bearer A1, 0 pedidos a logout-all, sin diálogo, `/catalogo`, sin «Mi cuenta») | `cta` ««Cerrar sesión» sin diálogo…» |
| Sin respuesta del backend: sesión anónima y `/catalogo` | `cta` «sin respuesta del backend…» (describe cerrar sesión) |
| Doble clic: un solo `POST /auth/logout` | `cta` «doble clic: un solo POST /auth/logout» |
| «Cerrar todas» sigue con confirmación y sin llamar a logout | `cta` ««Cerrar todas las sesiones» sigue pidiendo confirmación…» |
| Copy de la tarjeta y axe | `cta` «muestra el copy de la tarjeta…» |
