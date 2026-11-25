# Design — `revocacion-sesion-inmediata`

## Context

Ver `proposal.md` (Why). Estado actual verificado en el código:

- `backend/app/modules/auth/dependencies.py`: `_claims_desde_token` decodifica el JWT y exige `sub` y `sid`; `get_access_claims` lo usa sin tocar la BD; `get_current_user` → `_cargar_usuario` (UoW de usuarios) → `get_current_active_user` (404 si `deleted_at`) → `get_current_roles` → `require_role`. `lector_privilegiado` (lecturas públicas del catálogo) llama a `_claims_desde_token` + `_cargar_usuario` directo. `logout` y `logout-all` del router dependen de `get_access_claims`.
- `AuthService` (`service.py`) ya tiene `logout` idempotente (no hace nada si la sesión no existe, es de otro usuario o ya está cerrada) y `revocar_sesiones_abiertas` (logout-all, reuso). `UsuarioService` cierra las sesiones con motivo `BAJA` al desactivar un usuario. `AuthUnitOfWork` expone `sesiones: SesionRepository` (hereda `get_by_id` de `BaseRepository`, `session.get` por PK UUID).
- `UnitOfWork` es reentrante sobre la `Session` del pedido (FastAPI cachea `SessionDep` por request): abrir una UoW de auth y luego la de usuarios en el mismo pedido es seguro (dos transacciones cortas de solo lectura).
- Tests: `tests/support/auth_helpers.py::bearer_de_usuario` emite un access con `sid=uuid4()` **sin fila de sesión**; lo usan la fixture `usuario_con_roles` y ~50 llamadas (RBAC, pedidos, pagos, admin). `test_auth_logout.py` tiene el test «el access sigue autenticando después del logout» (contrato que se invierte). `test_pedidos_websocket.py` emite access sin sesión, pero el WebSocket no pasa por estas dependencias.
- Frontend: `shared/api/renovacion.ts` serializa las renovaciones (`renovarUnaVez`) y ante un refresh fallido llama `expirarSesion(previo)` → sesión `anonima` con motivo `expirada`; `RequiereAcceso` lleva a `/ingresar` recordando la ruta; `SesionGate` (fuera del router) borra las consultas privadas al pasar a `anonima`. `ShellConSesion` es el layout raíz dentro del router (ve `useLocation`). `/carrito` tiene acceso `sesion`. El `QueryClient` tiene `staleTime` 30 s y no reintenta 4xx.

## Goals / Non-Goals

**Goals:**
- Una sola verificación de sesión, reutilizada por todas las rutas protegidas y por las lecturas públicas con header, respetando `router → service → UoW → repository`.
- Logout idempotente; logout-all solo desde una sesión abierta.
- Revalidación en el frontend sin pedidos de más y sin nuevas carreras con la renovación.

**Non-Goals:**
- WebSocket `/pedidos/ws` (autentica por cookie `access_token`, legado de C-27 / Fase 2): queda como está y se anota en Riesgos.
- Caché de sesiones revocadas (Redis, lista negra en memoria) o acortar el `exp` del access.
- Polling periódico de la sesión sin interacción del usuario (ver Open Questions).
- Cambios de esquema: la PK de `sesion` ya es el índice que hace falta.

## Decisions

### D1. La verificación vive en `get_access_claims` (y en `lector_privilegiado`)
`get_access_claims` pasa a: decodificar (`_claims_desde_token`) y luego exigir sesión abierta con `AuthService.sesion_abierta(sid, usuario_id) -> bool` (nuevo método de solo lectura: `with self.uow` → `uow.sesiones.get_by_id(sid)` → `True` solo si existe, `usuario_id` coincide, `revoked_at is None` y `expires_at > utc_now()`). Si es `False`, `_credentials_exception()` (mismo 401, cuerpo y `WWW-Authenticate: Bearer`). La dependencia recibe el service con `AuthServiceDep` (patrón de composición existente). Como `get_current_user` → `require_role` dependen de `get_access_claims`, **toda** ruta protegida queda cubierta sin tocar los routers de los módulos.

`lector_privilegiado` hoy no usa `get_access_claims` (necesita el header opcional). Se extrae un helper `_claims_con_sesion_abierta(token, svc)` usado por ambas dependencias, de modo que la regla no se duplica (DRY).

- *Alternativa descartada*: dependencia nueva `get_sesion_abierta` agregada solo a `get_current_user`. Dejaría afuera a `logout-all` y obligaría a recordar sumarla en cada ruta nueva que use claims sin usuario.
- *Alternativa descartada*: consultar la sesión desde la dependencia con la `Session`/repositorio directo (como hace `_cargar_usuario` con la UoW). Pasar por `AuthService` mantiene la regla de negocio («sesión abierta y vigente») en el service, junto a `logout`/`refresh`, que ya la evalúan.
- *Alternativa descartada*: unir la sesión y el usuario en una sola consulta con JOIN. Ahorra una ida a la BD pero acopla `auth` con el repositorio de usuarios en una consulta ad hoc; el costo de dos lecturas por PK es despreciable para este proyecto.

### D2. Logout: dependencia de claims sin sesión (`get_access_claims_firmados`)
Se separa la validación pura actual en `get_access_claims_firmados` (firma, `exp`, `type`, `sub`, `sid`; sin BD) y **solo** `POST /auth/logout` la usa. `AuthService.logout` ya es idempotente y solo toca la sesión del `sid` si es del `sub`, así que aceptar un access de una sesión cerrada no da ningún poder nuevo y permite que el frontend cierre sin pasar por un 401 → refresh fallido. Respuesta: siempre 204 + borrar cookie.

`POST /auth/logout-all` sigue con `get_access_claims` (exige sesión abierta): un access robado de una sesión ya cerrada no debe poder cerrar las sesiones que el usuario abrió después. El frontend de «Cerrar todas las sesiones» ya deja la sesión local `anonima` responda lo que responda (spec `frontend-account`), así que el 401 no cambia su UX.

### D3. Lecturas públicas con header de una sesión cerrada → 401
Se mantiene la regla vigente de `catalog-visibility` («con header inválido, 401; sin header, anónimo») y se extiende a sesión cerrada/vencida/inexistente. *Alternativa descartada*: tratarlo como anónimo. Ocultaría al frontend que la sesión murió (seguiría mostrando el menú con sesión) y abriría una diferencia entre «access vencido» (401) y «sesión cerrada» (anónimo) sin motivo. La UX del 401 se resuelve en el frontend (D6).

### D4. Orden de las verificaciones y efecto sobre la baja
Orden: claims → sesión abierta (401) → usuario existe (401) → `deleted_at` (404). Como la baja cierra las sesiones con `BAJA` en la misma transacción, el usuario desactivado recibe ahora 401 en rutas protegidas en lugar del 404 «Cuenta de usuario desactivada». Es coherente con `user-administration` («no puede operar») y con el frontend (401 → renovación falla → sesión `anonima`). El 404 de `_exigir_usuario_activo` se conserva como defensa en profundidad (p. ej. `deleted_at` puesto a mano sin cerrar sesiones). Se actualiza la KB 03, que documenta ese 404.

### D5. Tests: el helper emite access con sesión real
`bearer_de_usuario` pasa a recibir la `Session` de tests e insertar una `Sesion` abierta (vence en `REFRESH_TOKEN_EXPIRE_DAYS`) antes de firmar el access con su `id`. Firma nueva: `bearer_de_usuario(session, usuario, claims_roles)`; se actualizan `bearer_con_roles` y la fixture `usuario_con_roles` (que ya tiene `session`). Se agrega un helper `access_sin_sesion(...)` explícito para los tests que necesitan un `sid` inexistente. Se reescribe el test que fijaba el contrato anterior («el access sigue autenticando después del logout») como su opuesto. El WebSocket no cambia, así que `test_pedidos_websocket.py` no se toca.

### D6. Frontend: revalidación con `useRevalidarSesion(ruta)` en `entities/session/model`
- **Consulta**: `sesionQueries.vigencia()` = `queryOptions({ queryKey: ['sesion', 'vigencia'], queryFn: obtenerUsuarioActual, retry: false, staleTime: 0 })`. Vive bajo `CLAVE_SESION`, así que `esConsultaPrivada` no la trata como dato del usuario; `SesionGate` la quita (`removeQueries`) al pasar a `anonima` junto con las privadas.
- **Hook** `useRevalidarSesion(ruta: string)` (FSD: modelo de la entidad `session`; datos del servidor por TanStack Query, estado de la sesión por Zustand):
  - `revalidar()`: si `estado !== 'autenticada'` o `document.visibilityState === 'hidden'` → no hace nada; si `ahora - ultimaVerificacion < INTERVALO_REVALIDACION_MS` (15 000) → no hace nada; si no, fija `ultimaVerificacion = ahora` y llama `queryClient.fetchQuery(sesionQueries.vigencia())` (TanStack deduplica un pedido en vuelo). Éxito → `establecerUsuario(usuario)`. Error → se ignora: un 401 ya pasó por el interceptor (`renovarUnaVez` → `expirarSesion`) y un error de red/5xx no debe cerrar la sesión.
  - `ultimaVerificacion` es un `useRef`; se fija a «ahora» cuando `estado` pasa a `autenticada` (login o rehidratación ya pidieron `GET /auth/me`), lo que cumple «sin verificación al abrir la sesión».
  - Efectos: `ruta` cambia → `revalidar()` (no en el primer render); `window` `focus` y `document` `visibilitychange` → `revalidar()`; limpieza de listeners al desmontar.
  - Reloj inyectable (`ahora = Date.now` por defecto) para tests con `vi.useFakeTimers`.
- **Montaje**: `ShellConSesion` (layout raíz del router, ya conoce `pathname`) llama `useRevalidarSesion(pathname)`. No se monta en `SesionGate` porque está fuera del `RouterProvider`.
- **Throttle por timestamp propio y no por `staleTime`**: con `staleTime` una consulta que falló (sin datos) se volvería a pedir en cada evento; el timestamp acota también los reintentos tras errores de red.
- **Carreras con la renovación**: el `GET /auth/me` pasa por `apiClient`, así que un 401 simultáneo con otros pedidos comparte la única renovación (`renovarUnaVez`). No se agrega ningún camino de refresh nuevo.
- *Alternativa descartada*: polling cada N segundos con `refetchInterval`. Pide aunque el usuario no haga nada; el pedido explícito del usuario es «al navegar y al volver».
- *Alternativa descartada*: `BroadcastChannel`/`storage` entre pestañas. Solo sirve dentro del mismo navegador; el problema es entre dispositivos.

### D7. Frontend: reintentar consultas públicas en error al vencer la sesión
En `SesionGate`, en la transición `autenticada → anonima`, además de borrar las privadas: `queryClient.refetchQueries({ predicate: q => !esConsultaPrivada(q.queryKey) && q.queryKey[0] !== CLAVE_SESION && q.state.status === 'error' })`. Sin access en el store, `instancia.ts` no manda `Authorization` y el catálogo vuelve como anónimo. Sin esto, la pantalla del catálogo que recibió el 401 de D3 quedaría en error (las consultas no reintentan 4xx).

### D8. Costo
Backend: +1 `SELECT` por PK UUID de `sesion` por pedido autenticado (y por lectura pública con header). Sin índice nuevo, sin migración. Frontend: como máximo 1 `GET /auth/me` cada 15 s por pestaña y solo ante navegación/foco/visibilidad.

## UI Mockups

- Design system revision: 4 (sin cambios)
- Decision: no (no UI) — 2026-11-24. Solo comportamiento: reutiliza la redirección existente a «Ingresar» con ruta recordada y el estado `anonima`; no agrega pantallas, componentes, textos ni estilos.
- Mockups: —
- Approval: —
- Preview: —
- Visual verify: —

## Risks / Trade-offs

- [TOCTOU: un pedido que pasó la verificación justo antes del logout-all termina igual] → Aceptado: la ventana es la duración de un request; el objetivo es cortar los pedidos **siguientes**.
- [~50 tests usan access sin sesión y pasarían a 401] → D5 cambia el helper en un solo lugar; la tarea de safety net corre la suite completa antes y después.
- [Usuario dado de baja: 404 → 401 cambia un comportamiento observable] → Ninguna spec ni test fija hoy el 404 tras la baja con el access propio; se documenta en KB 03 y en el delta de `auth-session` (escenario «Access de un usuario dado de baja»).
- [WebSocket `/pedidos/ws` sigue aceptando un access de sesión cerrada hasta `exp`] → Fuera de alcance (C-27, Fase 2, cookie `access_token` legada); se registra en la entrada de CHANGES.md como pendiente para quien retome C-27.
- [Una pestaña abierta sin interacción sigue mostrando la pantalla con sesión hasta el próximo evento] → Aceptado; no puede operar (todo pedido da 401 → sesión `anonima`). Polling diferido por decisión del usuario (ver Open Questions).
- [Revalidar con `GET /auth/me` actualiza el usuario en el store y re-renderiza el shell] → `establecerUsuario` solo cambia la referencia del usuario; los selectores de roles son estables. Bajo costo.
- [Un error de red repetido nunca cierra la sesión local] → Correcto por diseño: sin backend no hay forma de saber; el próximo pedido real lo resuelve.

## Migration Plan

Sin migración de datos ni de esquema. Despliegue = backend y frontend juntos (el frontend viejo con el backend nuevo también funciona: el 401 dispara la renovación fallida y cierra la sesión local). Rollback: revertir el commit; no deja estado.

## Open Questions

Resueltas por el usuario el 2026-11-25 (antes del apply):

1. **Baja de usuario 404 → 401 en rutas protegidas**: aprobado (401). Se conserva el 404 de `_exigir_usuario_activo` como defensa en profundidad (D4).
2. **`logout-all` con el access de una sesión ya cerrada**: aprobado que responda 401 (el `logout` simple sigue tolerante y responde siempre 204) (D2).
3. **Polling periódico (p. ej. cada 60 s, solo con la pestaña visible)**: **diferido, no se implementa ahora**. Sigue como follow-up posible para pantallas que el usuario deja abiertas sin tocar; no cambia specs ni tareas de este change.
