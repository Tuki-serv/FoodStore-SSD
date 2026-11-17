# Proposal — C-13b `fe-foundation-auth-data`

## Why

C-13a dejó el frontend sin sesión: el shell muestra siempre la variante anónima, las rutas no tienen control de acceso y no existe cliente HTTP. Los 14 changes de pantallas que siguen (C-14..C-24) necesitan hablar con el backend ya corregido en la Fase 0 (Bearer + refresh rotativo en cookie HttpOnly, C-02; errores `{detail, code, field}` y paginación, C-11) y saber quién es el usuario. C-13b es la base de datos y sesión del frontend: sin él no se puede loguear (C-14) ni mostrar una sola pantalla con datos. Está en el camino crítico (`C-11 → C-13b → C-16 → …`) y la rúbrica lo puntúa en «Zustand» (10 pts: 4 stores tipados, `persist` correcto, suscripción por slice) y «TanStack Query» (15 pts: incluye el interceptor de refresh ante 401).

Observado en el repo (`dev`, 2026-11-17):

- `frontend/package.json` tiene `react-router-dom ^6.30.6` y `zustand ^4.5.7`; **no** tiene `axios`, `@tanstack/react-query` ni ninguna herramienta para simular la red en tests (MSW o similar).
- `AppShell` (`src/app/layouts/app-shell/app-shell.tsx`) ya acepta `roles`, `usuario` y `onCerrarSesion`, pero `routes.tsx` lo monta sin props. `UsuarioShell` no se exporta por la API pública del shell y `RUTAS.raiz` no se usa (hallazgos V-7 del verify de C-13a).
- `src/test/setup.ts` reemplaza el `Request` global y `error-page.test.tsx` lo borra con `vi.unstubAllGlobals()`; los tests imprimen el aviso de future flags de React Router (V-5).
- Contrato real del backend (`backend/app/modules/auth/router.py`): `POST /api/v1/auth/login` (form OAuth2) devuelve `{access_token, token_type, expires_in}` y setea la cookie `refresh_token` (`Path=/api/v1/auth`); `POST /auth/refresh` sin cuerpo rota la cookie y devuelve un access nuevo, o 401 `{detail, code: "HTTP_401", field: null}` y borra la cookie; `GET /auth/me` devuelve `{id, nombre, apellido, email, celular, roles: [{codigo, nombre}]}`; `POST /auth/logout` y `/auth/logout-all` exigen Bearer y responden 204.
- La KB se contradice sobre dónde vive el access token: RN-AU-10, KB/08 §Seguridad y PA-04 dicen «en memoria» (C-02, D3); KB/08 §Estado del cliente, KB/07 §Auth paso 5 e IN-07 dicen «`persist` + `partialize` solo `accessToken`» (spec `[INT]`). Es la decisión OQ-1 de `design.md`.
- KB/08 asigna `cartStore` a C-18 y `paymentStore` a C-20, pero el roadmap de C-13b pide los cuatro stores (OQ-2).

## What Changes

- **Cliente HTTP** (`shared/api`, Axios 1.x): URL base `VITE_API_URL` + `/api/v1`, credenciales del navegador habilitadas (la cookie del refresh viaja sola, nunca se lee desde JS), `Authorization: Bearer` con el access de `authStore`.
- **Renovación transparente (US-003)**: ante un 401, un único `POST /auth/refresh` compartido por todos los pedidos concurrentes, actualización de `authStore` y reintento de cada pedido original una sola vez; sin renovar para `/auth/login` y `/auth/refresh`; si la renovación falla, la sesión se cierra localmente.
- **Errores normalizados**: todo error HTTP llega a la UI como un `ApiError` tipado con `status`, `detail`, `code`, `field` (y `retryAfter` en 429); errores de red y respuestas sin el formato esperado se mapean a códigos propios.
- **TanStack Query v5**: `QueryClientProvider` con defaults deliberados (sin reintentos en 4xx, `ApiError` como tipo de error por defecto) y convención de claves jerárquicas.
- **Sesión** (`authStore` + slice `entities/session`): rehidratación al arrancar (refresh por cookie y `GET /auth/me`), estados `verificando` / `autenticada` / `anonima`, roles tomados **solo** de `GET /auth/me` (DD-24), primitiva para abrir sesión con un access (la usa el login de C-14), cierre de sesión que llama al backend, limpia los datos privados en caché y conserva el carrito (CE-14).
- **Guards por rol**: tabla única de acceso por ruta (pública, solo anónimos, con sesión, por roles) que usan el router y la navegación; anónimo → `/ingresar` recordando el destino; rol insuficiente → página «Sin permiso» dentro del shell; usuario con sesión en `/ingresar` o `/registrarse` → catálogo.
- **Shell con sesión**: el shell recibe roles, usuario y «Cerrar sesión» reales.
- **Stores de cliente**: `cartStore` y `paymentStore` con su forma tipada y su política de persistencia; `uiStore` suma los campos que define la KB (según OQ-2/OQ-3).
- **Heredado de C-13a**: future flags de React Router activos, stub de `Request` que no se pierde entre tests, `RUTAS.raiz` retirado si sigue sin uso, `UsuarioShell` exportado, verificación visual de la variante con sesión contra `shell-admin.html`.
- **Docs al cerrar**: KB 05/07/08/09/10 según la respuesta a OQ-1, nuevo DD con la decisión; `CHANGES.md`.

**Fuera de alcance (con dueño):** pantallas y formularios de login, registro, perfil y «cerrar todas las sesiones» (C-14; C-13b solo deja la primitiva `abrirSesion` y la llamada de logout); UI del carrito, contador en el panel y personalización (C-18); checkout y brick de pago (C-19/C-20); renderizado de toasts y modal de confirmación (primer change que los muestre); sincronización de sesión entre pestañas; rol `COCINA` (PA-07, C-26); endpoints de datos de cada pantalla (cada change).

## Capabilities

### New Capabilities
- `frontend-api-client`: cliente HTTP del frontend — base URL y credenciales, Bearer, renovación transparente ante 401 (una sola a la vez, reintento único, exclusiones), errores `{detail, code, field}` normalizados y defaults de TanStack Query.
- `frontend-session`: sesión del usuario en el navegador — `authStore`, dónde vive el access, rehidratación al arrancar, roles desde `GET /auth/me`, apertura y cierre de sesión, expiración.
- `frontend-route-guards`: control de acceso por ruta en el frontend — tabla de acceso única, espera de la sesión, redirecciones y página «Sin permiso».
- `frontend-client-stores`: estado de cliente en Zustand — `cartStore`, `paymentStore` y `uiStore`, con su persistencia y su relación con el cierre de sesión.

### Modified Capabilities
- `frontend-app-shell`: el shell deja de estar fijo en «sin sesión» (lo alimenta la sesión) y se retira «Rutas sin control de acceso en el scaffold» (lo reemplaza `frontend-route-guards`).

`frontend-foundation` no cambia de requisitos: FSD, TS estricto, tokens, configuración y suite sin red siguen igual (las piezas nuevas deben cumplirlos).

## Impact

- **Código nuevo** (`frontend/src/`): `shared/api/` (cliente, renovación, errores, contratos de auth y paginación, fábrica del QueryClient), `shared/auth/` (`authStore`), `entities/session/`, `entities/cart/`, `entities/payment/`, `pages/forbidden/`, `shared/ui` (pantalla de carga), `app/router/` (guards y tabla de acceso), `app/providers/` (QueryClientProvider y espera de sesión); `src/test/` (servidor MSW y helpers).
- **Código modificado**: `app/router/routes.tsx`, `route-map.ts`, `app/providers/app-providers.tsx`, `app/layouts/app-shell/` (navegación lee la tabla de acceso, export de `UsuarioShell`), `shared/config/routes.ts`, `shared/model/ui-store.ts`, `src/test/setup.ts`, `error-page.test.tsx`.
- **Dependencias a agregar** (tarea de apply, no se instalan en el propose): `axios@^1.13`, `@tanstack/react-query@^5`; dev: `msw@^2`.
- **Backend**: sin cambios. Requisitos de entorno ya cubiertos por C-02: `CORS_ORIGINS` con el origen del frontend y credenciales; `REFRESH_COOKIE_SAMESITE=lax` funciona entre `localhost:5173` y `localhost:8000` (mismo sitio).
- **Docs**: KB/05 RN-AU-10, KB/07 §Auth, KB/08 §Estado del cliente y §Seguridad y §Estructura, KB/09 (DD nuevo), KB/10 IN-07/PA-04, `frontend/README.md`, `CHANGES.md`.
- **Governance ALTO**: el usuario aprueba estos artefactos y responde las Open Questions antes de escribir código.
- **UI**: superficie visual nueva (página «Sin permiso», pantalla de carga de la sesión): `design.md` §UI Mockups registra `Decision: yes` con aprobación pendiente; los mockups se producen después de aprobar la propuesta y antes de apply.
