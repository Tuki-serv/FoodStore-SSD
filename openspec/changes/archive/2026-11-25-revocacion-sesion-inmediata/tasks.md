# Tasks — `revocacion-sesion-inmediata` (ajuste extra post-roadmap)

> **Governance CRÍTICO (auth)**: no se empieza ninguna tarea hasta que el usuario apruebe `proposal.md`, `design.md`, `specs/` y este archivo. Cualquier decisión no obvia durante el apply (en especial algo que cambie una respuesta HTTP fuera de lo que dicen los deltas) se consulta antes de seguir.
> Strict TDD: cada comportamiento sigue RED → GREEN → TRIANGULATE → REFACTOR y los tests se **ejecutan** en cada gate. Backend: skills `python-testing-patterns`, `tdd` — AAA, nombres `test_<unidad>_<escenario>_<esperado>`, literales a mano, por la interfaz HTTP pública (TestClient) contra PostgreSQL real `foodstore_test` (`backend/tests/.env.test`; prerrequisito `docker compose up -d db` desde la raíz, puerto 5433; si no está, frenar y reportarlo). Frontend: skills `react-testing`, `vitest`, `tanstack-query`, `feature-sliced-design`, `tdd` — Vitest + RTL + MSW (`@/test/msw`), `vi.useFakeTimers` para el intervalo de 15 s, sin aserciones triviales.
> Hard rules: capas `router → service → UoW → repository` (sin `Session` nueva en dependencias); type hints; TS estricto sin `any`; FSD; sin migración (D8); sin build ni dev server (regla 13); sin commit ni push (regla 14). Comandos de backend desde `backend/`, de frontend desde `frontend/`. Referencias: D1..D8 de `design.md`; requisitos en `specs/auth-session`, `specs/catalog-visibility`, `specs/frontend-session`.
> Rojos esperados: solo el RED de cada tarea y el test que fijaba «el access sigue autenticando después del logout» (se invierte en 2.1). Cualquier otro test que se rompa es una regresión: frenar y corregir.

## 0. Safety net

- [x] 0.1 (baseline: backend 1707 passed + 3 fallas PREEXISTENTES ajenas en `tests/unit/test_entrega_docs.py` [CE-01, CE-09, CE-14: el checklist de entrega ya declara «cumplido» lo que el test exige «pendiente»]; frontend 2187 passed, 0 failed; las 3 se reportan y no se tocan) Correr `pytest` completo desde `backend/` y `npm test` desde `frontend/` antes de tocar nada; registrar passed/failed/xfail. Verificar: 0 failed en ambos. Si algo falla, frenar y reportarlo como falla preexistente.

## 1. Tests con sesión real (D5)

- [x] 1.1 RED: en `tests/integration/test_rbac_helpers.py` (o un test nuevo junto a los helpers) agregar `test_bearer_de_usuario_emite_access_cuyo_sid_es_una_sesion_abierta_del_usuario` (decodifica el access, busca la `Sesion` por `sid`: existe, `usuario_id` del usuario, `revoked_at` nulo, vence en el futuro). Ejecutar → falla (hoy el `sid` es aleatorio).
- [x] 1.2 GREEN: `bearer_de_usuario(session, usuario, claims_roles)` inserta una `Sesion` abierta (vence en `REFRESH_TOKEN_EXPIRE_DAYS`) y firma con su `id`; actualizar `bearer_con_roles` y la fixture `usuario_con_roles` de `tests/conftest.py`; agregar `access_sin_sesion(usuario_id, roles)` explícito. Ejecutar el test nuevo → verde y `pytest` completo → mismo resultado que 0.1 (todavía no cambió producción).
- [x] 1.3 REFACTOR: revisar que ningún test fuera de `test_pedidos_websocket.py` emita access con `create_access_token(..., sid=str(uuid4()))` salvo vía `access_sin_sesion`. Verificar con `grep -rn "sid=str(uuid4())" tests` y `pytest` completo verde.

## 2. Sesión abierta en las rutas protegidas (D1, D4; spec `auth-session` «El access token viaja por Authorization Bearer», «Cerrar la sesión invalida sus access»)

- [x] 2.1 RED: nuevo `tests/integration/test_auth_revocacion.py` con: logout y el mismo access en `GET /auth/me` → 401 (reemplaza a `test_el_access_sigue_autenticando_despues_del_logout_hasta_su_vencimiento` de `test_auth_logout.py`, que se borra); tres sesiones, logout-all con una, `GET /auth/me` con otra → 401 con el mismo cuerpo y `WWW-Authenticate: Bearer` que un access inválido. Ejecutar `pytest tests/integration/test_auth_revocacion.py` → fallan.
- [x] 2.2 GREEN: `AuthService.sesion_abierta(sid, usuario_id) -> bool` (`with self.uow`, `uow.sesiones.get_by_id`) y `get_access_claims` que la exige vía `AuthServiceDep` (401 `_credentials_exception()` si es falsa). Ejecutar → verde.
- [x] 2.3 TRIANGULATE: agregar en `test_auth_revocacion.py`: `sid` inexistente (`access_sin_sesion`) → 401; `sid` de una sesión abierta de **otro** usuario → 401; sesión con `expires_at` en el pasado y sin cerrar → 401; dos sesiones, logout de una, `GET /auth/me` con la otra → 200; reuso detectado (refresh rotado presentado fuera de la gracia) → el access de esas sesiones da 401; baja por `ADMIN` → el access del usuario da 401 en `GET /auth/me`. Ejecutar → verde.
- [x] 2.4 TRIANGULATE (pedido): cliente con dos sesiones, logout-all desde una, `POST /api/v1/pedidos/` con payload válido y el access de la otra → 401, cero pedidos nuevos del cliente y stock del producto sin cambios. Ejecutar → verde.
- [x] 2.5 REFACTOR: docstrings de `dependencies.py` (flujo y `AccessClaims`) reflejan la verificación de sesión; sin lógica duplicada. Ejecutar `pytest tests/integration/test_auth*.py tests/integration/test_rbac*.py tests/integration/test_pedidos*.py` → verde.

## 3. Logout idempotente y logout-all con sesión abierta (D2; spec «Logout cierra la sesión actual», «Logout en todos los dispositivos»)

- [x] 3.1 RED: en `test_auth_logout.py`: logout repetido → ambas 204 y **ambas** borran la cookie; dos sesiones, logout-all desde una, logout con el access de la otra → 204, cookie borrada y la sesión conserva `LOGOUT_ALL`. Ejecutar → fallan (con 2.2, el segundo logout da 401).
- [x] 3.2 GREEN: `get_access_claims_firmados` (validación pura actual, sin BD) y `POST /auth/logout` la usa; `get_access_claims` = firmados + sesión abierta. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: logout con A1, login nuevo, logout-all con A1 → 401 y la sesión nueva sigue abierta; logout sin `Authorization` → 401 (ya existe, debe seguir verde). Ejecutar `pytest tests/integration/test_auth_logout.py` → verde.
- [x] 3.4 REFACTOR: `get_access_claims` compone `get_access_claims_firmados` (sin repetir la decodificación). Ejecutar `pytest tests/integration/test_auth*.py` → verde.

## 4. Lecturas públicas con header de una sesión cerrada (D3; spec `catalog-visibility`)

- [x] 4.1 RED: en `test_catalogo_visibilidad.py`: `ADMIN` hace logout-all y llama a `GET /api/v1/productos?estado=ELIMINADO` con el access cerrado → 401 con el mismo cuerpo que `Bearer no-es-un-jwt`. Ejecutar → falla (hoy lista como ADMIN).
- [x] 4.2 GREEN: helper `_claims_con_sesion_abierta(token, svc)` usado por `get_access_claims` y por `lector_privilegiado` (que recibe `AuthServiceDep`). Ejecutar → verde.
- [x] 4.3 TRIANGULATE: mismo caso en `GET /api/v1/categorias?estado=ELIMINADO` y en un detalle de unidad de medida; sin header sigue 200 anónimo. Ejecutar `pytest tests/integration/test_catalogo_visibilidad.py` → verde.
- [x] 4.4 REFACTOR + suite backend: revisar SOLID/DRY en `dependencies.py` (una sola regla de «sesión abierta» en `AuthService`). Ejecutar `pytest` completo desde `backend/` → 0 failed (mismos xfail que 0.1).

## 5. Frontend: consulta y hook de revalidación (D6; spec `frontend-session` «Revalidación…», «Revalidación acotada»)

- [x] 5.1 RED: `entities/session/__tests__/revalidar-sesion.test.tsx` (hook montado en un `MemoryRouter` con un componente que navega): con sesión `autenticada` hace 16 s (fake timers), cambiar de ruta → un `GET /auth/me`; MSW responde 401 en `/auth/me` y en `/auth/refresh` → sesión `anonima` con motivo `expirada`. Ejecutar `npm test -- revalidar-sesion` → falla (no existe el hook).
- [x] 5.2 GREEN: `sesionQueries.vigencia()` en `session-queries.ts` y `useRevalidarSesion(ruta)` en `entities/session/model/` (exportado por el `index.ts` de la entidad) según D6. Ejecutar → verde.
- [x] 5.3 TRIANGULATE: `visibilitychange` a visible y `focus` disparan la verificación; pestaña oculta no; `anonima` no pide nada; ráfaga (3 navegaciones + focus + visibilidad en < 15 s) → un solo `GET /auth/me`; navegar 16 s después de una verificación → dos en total; recién abierta la sesión, navegar antes de 15 s → ninguno; 200 → `usuario` del store con los roles de la respuesta; red caída y 503 → sigue `autenticada`; `/auth/me` y otro pedido con 401 simultáneo → un solo `POST /auth/refresh`. Ejecutar → verde.
- [x] 5.4 REFACTOR: constante `INTERVALO_REVALIDACION_MS = 15_000` con comentario; reloj inyectable; sin `any`. Ejecutar `npm test -- session` → verde.

## 6. Frontend: montaje en el shell y vencimiento (D6, D7; spec `frontend-session` «Sesión perdida por vencimiento», `frontend-route-guards` sin cambios)

- [x] 6.1 RED: en `app/layouts/app-shell/__tests__/shell-con-sesion.test.tsx` (o test de rutas): `CLIENT` en `/carrito` hace > 15 s, navega a `/mis-pedidos`, `/auth/me` 401 y refresh 401 → URL `/ingresar` con `/mis-pedidos` recordada; variante volviendo a la pestaña en `/carrito` → `/ingresar` con `/carrito` recordada. Ejecutar → falla.
- [x] 6.2 GREEN: `ShellConSesion` llama `useRevalidarSesion(pathname)`. Ejecutar → verde.
- [x] 6.3 RED: en `app/providers/__tests__/sesion-gate.test.tsx`: al pasar a `anonima` se quita `['sesion','vigencia']` de la caché, y una consulta pública (`['productos', …]`) en error por 401 se vuelve a pedir sin `Authorization` y queda con datos. Ejecutar → falla.
- [x] 6.4 GREEN: `SesionGate` agrega el `removeQueries` de la vigencia y el `refetchQueries` de públicas en error (D7). Ejecutar → verde.
- [x] 6.5 TRIANGULATE: una consulta pública con datos (sin error) no se vuelve a pedir; las privadas siguen descartadas (test existente verde). Ejecutar `npm test -- sesion-gate shell-con-sesion` → verde.
- [x] 6.6 Suite frontend: `npm test`, `npm run typecheck` y `npm run lint` desde `frontend/` → todo verde, 0 errores.

## 7. Documentación y cierre

- [x] 7.1 KB: `knowledge-base/05_reglas_de_negocio.md` RN-AU-06 (el access de una sesión cerrada deja de autenticar en el pedido siguiente; logout idempotente sin exigir sesión abierta; logout-all la exige); `03_actores_y_roles.md` línea de implementación RBAC (verificación de sesión en `get_access_claims`; baja → 401, el 404 queda como defensa); `08_arquitectura_propuesta.md` Seguridad/Autenticación (revocación inmediata y revalidación del frontend); `09_decisiones_y_supuestos.md` DD-27 (quitar «no revocable antes de `exp`»). Conservar CRLF. Verificar con `grep -rn "no se invalida\|no revocable" knowledge-base` → sin resultados.
- [x] 7.2 (backend 2126 passed + 3 fallas preexistentes ajenas de `test_entrega_docs.py`, corregidas después por el orquestador el 2026-11-25: el test ahora exige «pendiente» solo en CE-13 y «cumplido (2026-11-24)» en CE-01, CE-09 y CE-14; prueba manual con 3 navegadores: OK; frontend 2204 passed, typecheck y lint limpios; `openspec validate --strict` válido) Verificación final: `pytest` completo (backend) y `npm test`, `npm run typecheck`, `npm run lint` (frontend) → verdes; `openspec validate revocacion-sesion-inmediata --strict` → válido. Registrar la tabla «TDD Cycle Evidence» en el resumen del apply.

## Workflow follow-up

- Verify (`openspec-verify`) con prueba manual del usuario: misma cuenta en tres navegadores, «Cerrar todas las sesiones» desde uno, en los otros navegar o volver a la pestaña → «Ingresar»; intentar confirmar un pedido → no se crea.
- `/opsx:archive` → sincroniza los deltas de `auth-session`, `catalog-visibility` y `frontend-session`, y marca `[x]` la entrada `[C-25b+] revocacion-sesion-inmediata` en `CHANGES.md`.
- Commits a pedido del usuario (flujo A de `CLAUDE.md`, sin `Co-Authored-By`).
