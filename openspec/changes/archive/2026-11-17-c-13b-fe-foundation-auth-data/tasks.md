# Tasks — C-13b `fe-foundation-auth-data`

> **Governance ALTO**: no escribir código hasta que el usuario (1) apruebe proposal, design y specs, (2) responda o acepte por defecto OQ-1..OQ-9 de `design.md` (OQ-1 —dónde vive el access token— es obligatoria y explícita) y (3) **apruebe los mockups** del bloque 0 (`design.md` §UI Mockups con `Approval: approved`). Al cerrar los bloques 4, 6, 8 y 10, reportar al usuario (checkpoint).
> **Criterios de aceptación visual**: `mockups/forbidden.html` y `mockups/session-loading.html` de este change (a crear en el bloque 0) y, para el shell con sesión, `openspec/changes/archive/2026-11-15-c-13a-fe-foundation-scaffold/mockups/shell-admin.html` (sin el contador del carrito, que es de C-18).
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `feature-sliced-design`; `zustand` solo ideas generales): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR con la suite verde después de cada paso. Red simulada **solo** en el borde con MSW (`server.use` por test, `onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()` con `await`); stores por `getState()`; QueryClient nuevo por test con reintentos apagados. Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (el test `fsd-boundaries` debe seguir en cero violaciones); TS `strict` sin `any`; datos del servidor en TanStack Query, Zustand solo estado de cliente; no leer ni escribir `.env*` (solo `frontend/.env.example` si hiciera falta); **no** correr `npm run dev`, `vite build`, `docker compose up` ni servidores (regla 13): la verificación es `npm test`, `npm run typecheck`, `npm run lint`. No commitear. Comandos desde `frontend/`.
> **Si OQ-1 = B** (persistir el access): las tareas marcadas «(OQ-1)» cambian como se indica en cada una y la spec `frontend-session` se ajusta en 4.4 antes de escribir código.

## 0. Gate previo (antes de apply; lo hace el orquestador con el usuario)

- [x] 0.1 Registrar en `design.md` §Open Questions las respuestas del usuario a OQ-1..OQ-9 (o «por defecto» explícito) con fecha; verificar que OQ-1 tiene respuesta explícita.
- [x] 0.2 Crear `mockups/` con `forbidden.html` (CLIENT en `/admin/usuarios`: shell con sesión + «Sin permiso» + «Ir al catálogo»), `session-loading.html` (pantalla de carga con logo y «Cargando…») y, si OQ-8/OQ-9 toman la alternativa, sus estados extra; importar `design-system/tokens.css` y `brand.js`, reutilizar `mockup.css`/`mockup.js` de C-13a por ruta relativa; `README.md` con brief, pantallas y `Approval: pending`. Verificar que cada HTML abre desde `file://` sin errores de consola.
- [x] 0.3 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, mostrarlas al usuario y registrar `Preview: rendered` en `design.md`; esperar aprobación y registrar `Approval: approved (<fecha>, by user)`.

## 1. Red de seguridad, dependencias y entorno de tests

- [x] 1.1 Safety net: correr `npm test`, `npm run typecheck`, `npm run lint` y anotar la línea base (archivos/tests verdes; C-13a cerró con 15 archivos / 76 tests). Si algo falla, frenar y reportar como falla previa.
- [x] 1.2 Agregar dependencias: `npm install axios@^1.13 @tanstack/react-query@^5` y `npm install -D msw@^2`. Verificar que `package.json` las lista y que `npm test` sigue con la línea base.
- [x] 1.3 Spike MSW + Axios + jsdom (riesgo R3): test temporal que hace `GET` con una instancia de Axios a un handler MSW y lee `request.credentials`; verificar que pasa con el stub de `Request` de `setup.ts`. Si falla, resolver (versiones, adaptador `fetch` de Axios) y reportar antes de seguir; borrar el test temporal al terminar el bloque 2.
- [x] 1.4 `src/test/msw/server.ts` (`setupServer` con handlers base: `POST /auth/refresh` → 401 `HTTP_401`, `POST /auth/logout` → 204) e integración en `setup.ts` (`listen({ onUnhandledRequest: 'error' })`, `resetHandlers` en `afterEach`, `close` al final), solo cuando hay DOM. Verificar con `npm test` que la suite completa sigue verde.
- [x] 1.5 Heredado V-5 (stub de `Request`): RED → test que, después de un test que llama `vi.unstubAllGlobals()`, un `createMemoryRouter` navega sin error; GREEN → mover el stub al `beforeEach` de `setup.ts` y cambiar `error-page.test.tsx` para restaurar solo su stub de `location`. Verificar `npm test` verde.

## 2. Router: future flags y limpieza heredada de C-13a

- [x] 2.1 RED: test de arranque que espía `console.warn` y espera cero mensajes con «React Router Future Flag Warning» al renderizar la app y navegar. Ejecutar → falla.
- [x] 2.2 GREEN: constante `FUTURO_ROUTER` (design D11) usada por `createBrowserRouter` y por todos los `createMemoryRouter` de los tests (helper en `src/test/`), y `RouterProvider future={{ v7_startTransition: true }}`. Ejecutar `npm test` → verde (ajustar los `findBy` que dependan del timing).
- [x] 2.3 `export type { UsuarioShell }` desde `app/layouts/app-shell/index.ts` y retirar `RUTAS.raiz` si `grep -rn "RUTAS.raiz" src` sigue vacío. Verificar `npm run typecheck` y `npm run lint` verdes.

## 3. Errores de la API (spec `frontend-api-client`: «Errores con forma única», «Espera indicada…», «Errores sin respuesta…»)

- [x] 3.1 RED: `src/shared/api/__tests__/api-error.test.ts`: `aApiError` de un error Axios 409 `{detail: "Stock insuficiente", code: "INSUFFICIENT_STOCK", field: null}` → `status` 409, `code`, `detail`, `field` literales. Ejecutar → falla.
- [x] 3.2 GREEN + TRIANGULATE: `api-error.ts` (`ApiError`, `aApiError`, `esApiError`, `mensajeDeCampo`) + `shared/api/index.ts`; casos 422 con `field` `email`; 429 con `Retry-After: 840` → `retryAfter` 840 y con `Retry-After: abc` → ausente; sin respuesta → `status` null y `NETWORK_ERROR`; 502 con cuerpo HTML → `HTTP_502` y `detail` genérico sin el HTML; valor que no es error Axios → `UNKNOWN_ERROR`. Ejecutar → verde.
- [x] 3.3 REFACTOR: mensajes genéricos como constantes exportadas; `npm run typecheck` y `npm run lint` verdes.

## 4. `authStore` (spec `frontend-session`: «Estado de la sesión», «El access token vive solo en memoria»)

- [x] 4.1 RED: `src/shared/auth/__tests__/auth-store.test.ts`: estado inicial `verificando` sin access ni usuario; `establecerSesion('A1', usuarioCliente)` → `autenticada`, `selectRoles` = `['CLIENT']`. Ejecutar → falla.
- [x] 4.2 GREEN + TRIANGULATE: `src/shared/auth/auth-store.ts` + selectores + `index.ts` (design D9): `cerrarLocal({motivo:'logout'})` → `anonima` sin access/usuario y `motivo` `logout`; `expirarSesion()` → `anonima` con `motivo` `expirada`; `establecerUsuario` actualiza solo el usuario; `reset()` vuelve a `verificando`. Ejecutar → verde.
- [x] 4.3 (OQ-1) Persistencia: **A** → test: tras `establecerSesion('A1', …)`, ninguna clave de `localStorage`/`sessionStorage` contiene `A1`. **B** → test: `localStorage['foodstore.auth']` contiene solo `accessToken` (sin usuario ni estado) y un valor precargado rehidrata el access; almacenamiento que lanza → store vivo en memoria. Ejecutar → verde.
- [x] 4.4 (N/A: OQ-1 = A) (OQ-1 = B solamente) Actualizar `specs/frontend-session/spec.md` («El access token vive solo en memoria» → requisito de persistencia solo del access) y correr `openspec validate c-13b-fe-foundation-auth-data --strict` → válido.
- [x] 4.5 Reset de `useAuthStore` en el `beforeEach` de `setup.ts`. Checkpoint bloque 4: `npm test`, `npm run typecheck`, `npm run lint` verdes; reportar al usuario.

## 5. Cliente HTTP (spec `frontend-api-client`: «URL base», «Credenciales…», «Access token en Authorization Bearer»)

- [x] 5.1 RED: `src/shared/api/__tests__/http-client.test.ts` con MSW: `apiClient.get('/auth/me')` con `VITE_API_URL=http://localhost:8000` llega al handler de `http://localhost:8000/api/v1/auth/me`. Ejecutar → falla.
- [x] 5.2 GREEN + TRIANGULATE: `http-client.ts` (design D2) con `unirUrl`; casos: URL con barra final; `request.credentials === 'include'`; con access `A1` en el store → header `Authorization: Bearer A1`; sin access → sin header; el interceptor final rechaza `ApiError` (409 del handler → `esApiError` true). Ejecutar → verde.

## 6. Renovación ante 401 (spec `frontend-api-client`: «Renovación transparente», «Una sola renovación…», «Reintento único», «Pedidos que no disparan…», «Reintento sin renovar…», «Renovación fallida…»)

- [x] 6.1 RED: `src/shared/api/__tests__/renovacion.test.ts`: `GET /pedidos` responde 401 con Bearer `A1` y 200 con `A2`; `/auth/refresh` responde 200 `{access_token:'A2'}` → la promesa resuelve con el 200, el store queda con `A2` y hubo 1 refresh. Ejecutar → falla.
- [x] 6.2 GREEN: `renovacion.ts` + interceptor de response (design D3), `renovarAccess` en `auth.ts`, augment de `_reintentado` sin `any`, `reiniciarRenovacion()` llamada en `afterEach` de `setup.ts`. Ejecutar → verde.
- [x] 6.3 TRIANGULATE: (a) tres pedidos concurrentes con 401 y refresh demorado (`delay`) → exactamente 1 refresh y los tres resuelven; (b) reintento que vuelve a dar 401 → `ApiError` 401 y 1 refresh; (c) `POST /auth/login` 401 → 0 refresh; (d) `POST /auth/refresh` 401 directo → 0 refresh extra; (e) `POST /auth/logout` 401 y refresh 200 → logout repetido con el access nuevo; (f) 401 de un pedido enviado con `A1` cuando el store ya tiene `A2` → reintento con `A2` y 0 refresh; (g) refresh 401 → store `anonima` con `motivo` `expirada` y todos los pedidos en espera rechazan con `ApiError` 401; (h) lectura pública `GET /productos` 401 → renueva y devuelve el listado. Ejecutar → verde.
- [x] 6.4 REFACTOR: extraer la exclusión de URLs y la lectura del Bearer enviado a funciones puras con nombre; suite verde. Checkpoint bloque 6: reportar al usuario (incluye conteo de refresh de 6.3a).

## 7. TanStack Query (spec `frontend-api-client`: «Política de reintentos…»)

- [x] 7.1 RED: `src/shared/api/__tests__/query-client.test.tsx` con `renderHook` + `crearQueryClient()`: consulta a un handler que responde 404 → 1 pedido y `error.code` `HTTP_404`. Ejecutar → falla.
- [x] 7.2 GREEN + TRIANGULATE: `query-client.ts` (design D5) + augment `Register.defaultError = ApiError`; casos 503 y luego 200 → datos tras 2 pedidos; mutación que falla con 503 → 1 pedido; `crearQueryClient({ conReintentos: false })` → 503 sin reintento. Ejecutar → verde.
- [x] 7.3 `AppProviders` envuelve el router con `QueryClientProvider` (instancia de módulo); `src/app/__tests__/app.test.tsx` sigue verde. Documentar convenciones de claves y `CLAVES_PUBLICAS` en `frontend/README.md`; verificar que el ejemplo del README usa nombres que existen en el código.

## 8. Sesión: rehidratación, apertura y cierre (spec `frontend-session`)

- [x] 8.1 RED: `src/entities/session/__tests__/rehidratar.test.ts`: refresh 200 `A1` + `/auth/me` con roles `[{codigo:'CLIENT'}]` → `rehidratarSesion()` deja `autenticada` con roles `['CLIENT']`. Ejecutar → falla.
- [x] 8.2 GREEN + TRIANGULATE: `entities/session` (`api/`, `model/`, `index.ts`; design D1, D6) con `obtenerUsuarioActual` en `shared/api/auth.ts` (DTO → `UsuarioSesion`, roles = `codigo`); casos: refresh 401 → `anonima`, 0 llamadas a `/auth/me`, sin error; refresh sin respuesta → `anonima`; refresh 503 → `anonima`; (OQ-1 = B) access precargado → `/auth/me` directo sin refresh. Ejecutar → verde.
- [x] 8.3 RED → GREEN `abrirSesion`: con `A1` y `/auth/me` ADMIN → `autenticada` con `A1`; TRIANGULATE `/auth/me` 404 → `anonima` sin access y rechaza `ApiError` 404. Ejecutar → verde.
- [x] 8.4 RED → GREEN `useCerrarSesion` (`renderHook` con QueryClient): logout 204 → `anonima` `motivo` `logout`; TRIANGULATE: logout sin respuesta → `anonima` igual; logout 401 + refresh 200 → logout repetido; con `cartStore` de 2 líneas (bloque 11 puede ir antes si se prefiere; si no, precargar `localStorage['foodstore.cart']`) → el carrito persistido sigue intacto. Ejecutar → verde.
- [x] 8.5 RED → GREEN `SesionGate` (design D6, D8): renderiza `PantallaCarga` (`role="status"`, «Cargando…») hasta resolver; con StrictMode hace 1 solo refresh; al pasar `autenticada → anonima` (por `cerrarLocal` y por `expirarSesion`) elimina de la caché una consulta `['pedidos','lista',{}]` y conserva `['productos','lista',{}]`. Crear `src/shared/ui/pantalla-carga/` según el mockup aprobado `session-loading.html`. Ejecutar → verde. Checkpoint bloque 8: reportar al usuario.

## 9. Tabla de acceso, navegación y guards (spec `frontend-route-guards`)

- [x] 9.1 RED: `src/shared/config/__tests__/acceso.test.ts`: `ACCESO_RUTAS` con la lista literal de la spec («Tabla de acceso por ruta») y `puedeAcceder` por tabla (anónimo/`CLIENT`/`PEDIDOS`/`STOCK`/`ADMIN` × cada tipo de acceso). Ejecutar → falla.
- [x] 9.2 GREEN: `ACCESO_RUTAS`, `Acceso`, `puedeAcceder` en `shared/config` (design D7). Ejecutar → verde.
- [x] 9.3 REFACTOR navegación: `navigation.ts` deriva la visibilidad de `ACCESO_RUTAS`; `navigation.test.ts` de C-13a sin cambios → verde; test nuevo de coherencia (spec «Navegación coherente con el acceso») para todas las combinaciones de roles. Ejecutar → verde.
- [x] 9.4 RED: `src/app/router/__tests__/guards.test.tsx` con el árbol real (`renderApp`): anónimo en `/mis-pedidos?page=2` → URL `/ingresar` y ruta recordada `/mis-pedidos?page=2`. Ejecutar → falla.
- [x] 9.5 GREEN + TRIANGULATE: `RequiereAcceso` en `app/router` y `src/pages/forbidden/` según el mockup aprobado `forbidden.html`; casos: anónimo en `/admin/usuarios` → `/ingresar`; `CLIENT` en `/admin/usuarios` → «Sin permiso», URL intacta, enlace «Ir al catálogo» a `/catalogo`; `STOCK` en `/admin/productos` → página «Productos y stock»; `STOCK` en `/admin/categorias` → «Sin permiso»; `CLIENT` en `/ingresar` → `/catalogo`; anónimo llevado a `/ingresar` desde `/direcciones` y luego `abrirSesion` como `CLIENT` → `/direcciones`; `desde` = `//evil.example` o ruta inexistente → `/catalogo`; recarga en `/mis-pedidos` con rehidratación demorada → pantalla de carga y URL intacta, luego «Mis pedidos»; `CLIENT` en `/mis-pedidos` y refresh 401 en un pedido → `/ingresar` con `/mis-pedidos` recordada; anónimo en `/catalogo` → «Catálogo»; `ADMIN` en `/no-existe` → 404 con navegación ADMIN. Ejecutar → verde.
- [x] 9.6 Actualizar `routes.test.tsx` de C-13a (el escenario «`/admin/usuarios` sin sesión muestra la provisoria» se retira con su requisito) y verificar `npm test` verde.

## 10. Shell con sesión (spec `frontend-app-shell`: «Shell alimentado por la sesión», «Cerrar sesión desde el panel»)

- [x] 10.1 RED: test con `renderApp('/catalogo', { sesion: Ana Gómez CLIENT+ADMIN })`: grupo «Administración» con 5 enlaces, pie con «Ana Gómez», «ADMIN» y botón «Cerrar sesión». Ejecutar → falla.
- [x] 10.2 GREEN + TRIANGULATE: `ShellConSesion` (design D8) como elemento del layout en `routes.tsx`; casos: anónimo → 3 enlaces y sin pie; `PEDIDOS`+`CLIENT` → rol principal «PEDIDOS»; «Cerrar sesión» → 1 `POST /auth/logout`, URL `/catalogo`, sin pie; doble clic → 1 solo logout; logout desde `/admin/dashboard` → `/catalogo` (no `/ingresar`). Ejecutar → verde.
- [x] 10.3 REFACTOR: `AppShell` sigue presentacional y sus tests de C-13a pasan sin cambios. Checkpoint bloque 10: `npm test`, `npm run typecheck`, `npm run lint` verdes; reportar al usuario.

## 11. Stores de cliente (spec `frontend-client-stores`; alcance según OQ-2 y OQ-3)

- [x] 11.1 RED: `src/entities/cart/__tests__/cart-store.test.ts`: `agregar` producto 7 sin `[3,1]` ×1 y sin `[1,3]` ×2 → 1 línea con 3 unidades. Ejecutar → falla.
- [x] 11.2 GREEN + TRIANGULATE: `entities/cart` (design D9); casos: otra personalización → 2 líneas; `fijarCantidad(…, 0)` → vacío; `fijarCantidad(…, 1.5)` → sin cambio; totales 3×«0.10» + 1×«1250.50» → 4 y «1250.80»; recarga simulada (rehidratar desde `localStorage['foodstore.cart']`) → mismas líneas; entrada corrupta → vacío sin excepción; `reset()` → vacío también en el almacenamiento. Ejecutar → verde.
- [x] 11.3 RED → GREEN + TRIANGULATE `entities/payment`: `iniciar(12)` → `procesando` con pedido 12; `registrarResultado` aprobado con `mpPaymentId`; `registrarError`; nada en `localStorage`; `reset()` → `inactivo`. Ejecutar → verde.
- [x] 11.4 RED → GREEN + TRIANGULATE `uiStore` (campos de OQ-3): `abrirCarrito`/`cerrarCarrito`; `notificar` devuelve ids únicos y `descartarToast(id)` conserva el resto; `pedirConfirmacion`/`cerrarConfirmacion`; `localStorage['foodstore.ui']` sigue teniendo solo `sidebarCollapsed`; los tests de C-13a de `ui-store.test.ts` siguen verdes. Ejecutar → verde.
- [x] 11.5 Reset de `useCartStore` y `usePaymentStore` en el `beforeEach` de `setup.ts`; selectores exportados por la API pública de cada slice. Verificar `npm test` verde.

## 12. Fronteras FSD

- [x] 12.1 RED → GREEN: fixtures nuevos en `tests/architecture/fixtures/` — válido `entities/x/model/a.ts → @/shared/api`; inválidos `shared/api/a.ts → @/entities/session` (capa superior) y `entities/a/… → @/entities/b` (cross-import); lista literal de violaciones esperadas. Ejecutar `npm test -- fsd` → verde, y «`src/` real sin violaciones» sigue verde con `shared/auth`, `shared/api`, `entities/*` y `pages/forbidden`.

## 13. Documentación (KB y roadmap; el código ya está probado en los bloques anteriores)

- [x] 13.1 `frontend/README.md`: capas y slices nuevos (tabla de D1), cliente HTTP y `ApiError` (cómo consumir `code`/`field`/`retryAfter`), claves de consulta, sesión y guards, MSW en tests, nota de `SameSite` con ngrok (R6). Verificar que cada path citado existe (`ls`).
- [x] 13.2 KB según OQ-1 (ver `design.md` OQ-1, A o B): `knowledge-base/05` RN-AU-10, `07` §Auth paso 5, `08` §Estado del cliente (fila `authStore` y tabla de ubicación de stores según OQ-2) y §Seguridad, `10` IN-07 (y PA-04 si B), `09` nuevo **DD-27** con la decisión, alternativas y fecha. Verificar con `grep -n "DD-27" knowledge-base/*.md` que la decisión aparece en 09 y es citada desde 05/08/10.
- [x] 13.3 KB/08 §Estructura de directorios: árbol real con `shared/api`, `shared/auth`, `entities/{session,cart,payment}`, `pages/forbidden` y la fila `[INT] api/` → `src/shared/api/` cumplida. Verificar con `grep -n "shared/auth" knowledge-base/08_arquitectura_propuesta.md`.
- [x] 13.4 `knowledge-base/06` US-003 (y US-004 en su parte de frontend: limpiar store) marcadas como cubiertas por C-13b. Verificar con `grep -n "US-003" -A3 knowledge-base/06_funcionalidades.md`.
- [x] 13.5 `CHANGES.md`: estado de C-13b, «Punto de partida (C-13b)» para C-14 (`abrirSesion`, redirección automática al destino, `ApiError.retryAfter`, `cerrarTodasLasSesionesRemota`), C-16 (`apiClient`, `Paginado<T>`, claves públicas), C-18 (`cartStore` ya persistente; `cartOpen`) y C-20 (`paymentStore`); ajustar la nota de KB/08 sobre dueños de stores según OQ-2. Verificar con `grep -n "Punto de partida (C-13b)" CHANGES.md`.

## 14. Verificación final

- [x] 14.1 `npm test`, `npm run typecheck`, `npm run lint` verdes; comparar contra la línea base de 1.1 (más tests, ninguno perdido); `git diff --stat backend/` vacío; `git status` sin `node_modules`, `coverage` ni `.env`.
- [x] 14.2 `openspec validate c-13b-fe-foundation-auth-data --strict` → válido; cada escenario de las 5 specs delta tiene al menos un test que lo cubre (tabla escenario → test en `design.md` §Notas de implementación).
- [x] 14.3 Revisión SOLID/DRY: un solo lugar para el Bearer, la renovación, la forma de error, la tabla de acceso y la limpieza de caché; sin `any` ni `as unknown as`. Anotar desvíos en `design.md`.

## Workflow follow-up

- Verify (`openspec-verify`): comparar con `mockups/forbidden.html`, `mockups/session-loading.html` y `shell-admin.html` de C-13a a 1440x900 y 390x844 con el backend real (login de prueba del seed), revisar consola y red (un solo refresh al recargar; ningún token en `localStorage` si OQ-1 = A); capturas en `mockups/verify/`; registrar `Visual verify` en `design.md`.
- Archive (`/opsx:archive`) tras el OK del usuario; marcar `[x]` C-13b en `CHANGES.md`.
