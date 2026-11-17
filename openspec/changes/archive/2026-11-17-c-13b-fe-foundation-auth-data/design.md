# Design — C-13b `fe-foundation-auth-data`

## Context

Motivación y estado observado: ver `proposal.md` (Why). Restricciones que condicionan el diseño:

- **Contrato del backend (C-02, C-08, C-11)**: login `POST /api/v1/auth/login` (form OAuth2: `username`, `password`) → `{access_token, token_type, expires_in}` + `Set-Cookie: refresh_token` (HttpOnly, `Path=/api/v1/auth`, `SameSite`/`Secure` configurables). `POST /auth/refresh` sin cuerpo → 200 con access nuevo (rota la cookie salvo en el período de gracia de 30 s) o 401 `{detail, code: "HTTP_401", field: null}` que además borra la cookie. `GET /auth/me` → `UserPublicAdminPanel` `{id, nombre, apellido, email, celular, roles: [{codigo, nombre}]}`. `POST /auth/logout` y `/auth/logout-all`: Bearer, sin cuerpo, 204, idempotentes. Un refresh rotado reenviado después de la gracia cierra **todas** las sesiones del usuario (RN-AU-05): dos renovaciones en paralelo desde la misma pestaña pueden disparar esa alarma si la segunda llega fuera de la gracia, por eso la renovación debe ser única.
- **Errores** (`api-conventions`): toda respuesta 4xx/5xx es `{detail, code, field}`; códigos `HTTP_<status>`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED` (+ `Retry-After`), `INTERNAL_ERROR` y los de negocio (`INVALID_TRANSITION`, `INSUFFICIENT_STOCK`, `DUPLICATE_VALUE`, `CATEGORY_HAS_*`, `PAYMENT_NOT_ALLOWED`). Precios: `Decimal` de Pydantic v2, serializado como **string** (`"1250.50"`).
- **Frontend actual (C-13a)**: FSD v2.1 con `app`, `pages`, `shared`; test de fronteras `tests/architecture/fsd-boundaries.test.ts` (capas hacia abajo, sin cross-import entre slices de la misma capa, imports por API pública; `shared` admite imports entre segmentos por su `index.ts`). `AppShell` es presentacional y ya recibe `roles`, `usuario`, `onCerrarSesion`. `uiStore` en `shared/model` con `persist` sobre un almacenamiento seguro (try/catch). Tests: Vitest 2 + jsdom 31 + Testing Library; `setup.ts` reemplaza `Request` (jsdom + data router).
- **Reglas duras**: TS estricto sin `any`; datos del servidor en TanStack Query, Zustand solo para estado de cliente; no levantar servidores; TDD estricto.
- **Skills aplicadas**: `feature-sliced-design` (tokens/sesión en `shared/auth` o `shared/api`; no crear capas vacías), `tanstack-query` (v5, `queryOptions`, claves jerárquicas, `retry: false` y QueryClient nuevo por test), `zustand` (solo ideas generales: selectores, `reset()`, `getState()` fuera de React), `react-testing` (MSW para la red, consultas accesibles), `vitest`, `tdd`. APIs verificadas con context7: Axios 1.x (`interceptors`, `InternalAxiosRequestConfig`, `AxiosHeaders#set`, `isAxiosError`), React Router 6.30 (`future` en `createBrowserRouter`/`createMemoryRouter` y `v7_startTransition` en `RouterProvider`, `Navigate` con `state`).

## Goals / Non-Goals

**Goals:**
- Una sola puerta de salida HTTP, tipada, que resuelva Bearer, renovación y errores para todos los changes siguientes.
- Sesión determinista (tres estados) que los guards y el shell consumen sin conocer HTTP.
- Fronteras FSD verificadas por el test existente, sin excepciones nuevas.
- Todo probado sin backend: la red se simula en el borde (MSW), nunca mockeando módulos propios.

**Non-Goals:**
- Pantallas de login/registro/perfil (C-14), UI del carrito (C-18), checkout/pago (C-19/C-20).
- Renderizar toasts o el modal de confirmación: C-13b deja su estado tipado; los dibuja el primer change que los use.
- Sincronizar sesión entre pestañas (`BroadcastChannel`/evento `storage`).
- Renovación proactiva antes de `exp` (se renueva solo ante 401).

## Decisions

### D1 — Ubicación FSD de cada pieza

| Pieza | Ubicación | Por qué |
|-------|-----------|---------|
| Cliente Axios, interceptores, renovación single-flight | `src/shared/api/` (`http-client.ts`, `renovacion.ts`) | Infraestructura sin dominio; la skill FSD manda el cliente a `shared/api` |
| `ApiError` y normalización | `src/shared/api/` (`api-error.ts`) | Lo consumen todas las capas |
| Contratos HTTP comunes: `Paginado<T>`, DTO de `/auth/me`, llamadas `renovarAccess`, `obtenerUsuarioActual`, `cerrarSesionRemota`, `cerrarTodasLasSesionesRemota` | `src/shared/api/` (`auth.ts`, `paginacion.ts`) | El interceptor necesita `refresh`; el resto de auth es CRUD de infraestructura (regla de la skill) y C-14 suma `login` acá |
| `authStore` (`useAuthStore`), tipos `UsuarioSesion`, `EstadoSesion`, selectores | `src/shared/auth/` (segmento nuevo) | El interceptor (`shared/api`) debe leer/escribir el access con `getState()`; `shared` no puede importar `entities`. `shared/auth` **no** importa `shared/api` (sin ciclo) |
| Fábrica del QueryClient (`crearQueryClient`) y augment de `Register` | `src/shared/api/` (`query-client.ts`) | Defaults compartidos por la app y los tests |
| Operaciones de sesión: `rehidratarSesion`, `abrirSesion`, hooks `useSesion`, `useRolesSesion`, `useCerrarSesion`, `sesionQueries` | `src/entities/session/` (`api/`, `model/`, `index.ts`) | Combinan `shared/api` + `shared/auth`; las usan `app` (arranque, shell) y `pages`/`features` de C-14 (login, «Mi cuenta»). `entities` es la capa con slices más baja importable por todas |
| `cartStore` | `src/entities/cart/model/` | Dominio del carrito; lo consumen C-16 (agregar), C-18 (pantalla), C-19 (checkout) |
| `paymentStore` | `src/entities/payment/model/` | Dominio del pago en curso; C-20 lo usa |
| `uiStore` (campos nuevos) | `src/shared/model/ui-store.ts` (existente) | Ya vive ahí desde C-13a |
| Tabla de acceso por ruta (`ACCESO_RUTAS`) | `src/shared/config/routes.ts` | Fuente única que leen el router y la navegación (D7) |
| Guards (`RequiereAcceso`), espera de sesión (`SesionGate`), contenedor del shell con sesión (`ShellConSesion`) | `src/app/router/` y `src/app/providers/` | Composición de rutas y providers es responsabilidad de `app` |
| Página «Sin permiso» | `src/pages/forbidden/` | Una página por slice, como `not-found` |
| Pantalla de carga | `src/shared/ui/pantalla-carga/` | UI genérica sin dominio |
| Servidor MSW y handlers base de auth | `src/test/msw/` | Fuera de las capas, como el resto de `src/test` |

*Alternativas descartadas*: (a) `authStore` en `entities/session` con el token inyectado en `shared/api` por un «puerto» configurado desde `app`: más indirección y estado mutable de módulo para el mismo resultado; (b) todo en `shared/auth` (incluidas `rehidratar`/`cerrar`): crea el ciclo `shared/auth ↔ shared/api`; (c) `features/auth` para la sesión: C-14 crea `features/auth` para los formularios y una feature no puede importar otra.

### D2 — Cliente HTTP

- `axios.create({ baseURL: unirUrl(readConfig(import.meta.env).apiUrl, '/api/v1'), withCredentials: true, timeout: 15000 })`. `unirUrl` normaliza la barra final (spec «URL base»).
- `withCredentials: true` **global**: login (C-14), refresh, logout y logout-all la necesitan (sin ella el navegador descarta el `Set-Cookie` del login cross-origin `5173 → 8000`); el resto de rutas no recibe la cookie porque su `Path` es `/api/v1/auth`. El backend ya tiene CORS con credenciales y sin `*` (C-02, D14). *Alternativa*: `withCredentials` solo en las llamadas de `/auth`: obliga a recordarlo en cada llamada nueva de auth (C-14) sin ganancia de seguridad.
- Interceptor de request: si `useAuthStore.getState().accessToken` existe, `config.headers.set('Authorization', 'Bearer …')`.
- Las pantallas nunca usan `axios` directo: importan `apiClient` (o las funciones de cada `api/`) desde `@/shared/api`.

### D3 — Algoritmo de renovación (interceptor de response)

```
on error(err):
  si !isAxiosError(err) o sin response o status != 401 → rechazar ApiError(err)
  cfg = err.config
  si cfg.url ∈ {/auth/login, /auth/refresh} o cfg._reintentado → rechazar ApiError(err)
  cfg._reintentado = true
  tokenEnviado = Bearer de cfg.headers; actual = authStore.accessToken
  si actual && actual != tokenEnviado → return apiClient(cfg con Bearer actual)      // 401 tardío
  try   nuevo = await renovarUnaVez()   // single-flight
  catch → authStore.expirarSesion(); rechazar ApiError(err)
  return apiClient(cfg con Bearer nuevo)

renovarUnaVez():
  si enCurso → return enCurso
  enCurso = renovarAccess().then(t => { authStore.establecerAccess(t); return t })
                           .finally(() => enCurso = null)
  return enCurso
```

- `_reintentado` se tipa con *module augmentation* de `InternalAxiosRequestConfig` (sin `any`).
- **Exclusiones**: solo `/auth/login` (un 401 ahí son credenciales inválidas) y `/auth/refresh` (bucle). **Logout y logout-all no se excluyen** (desvío deliberado de la sugerencia inicial): con el access vencido, un logout sin renovar dejaría la sesión abierta en el servidor y la cookie viva (solo el backend puede borrarla), y la próxima recarga re-loguearía en silencio. El bucle no es posible por `_reintentado`. Si la renovación falla, el backend ya borró la cookie en su 401.
- `expirarSesion()` deja `anonima` y marca `motivo: 'expirada'` (D8 usa el motivo).
- La renovación en curso es estado de módulo; se expone `reiniciarRenovacion()` solo para tests (`src/test/setup.ts` la llama en `afterEach`).

### D4 — Modelo de error

```ts
export class ApiError extends Error {
  readonly status: number | null;      // null = sin respuesta
  readonly code: string;               // del backend, o NETWORK_ERROR / HTTP_<status> / UNKNOWN_ERROR
  readonly detail: string;
  readonly field: string | null;
  readonly retryAfter?: number;        // solo 429 con Retry-After entero > 0
}
export function aApiError(error: unknown): ApiError
export function esApiError(error: unknown): error is ApiError
```

- El interceptor de response rechaza **siempre** `ApiError` (última etapa), así `useQuery`/`useMutation` reciben un tipo conocido. Se declara `interface Register { defaultError: ApiError }` de TanStack Query v5 para que `error` quede tipado sin casteos.
- Cuerpo válido = objeto con `detail` y `code` string (`field` string o null). Si no: `HTTP_<status>` y `detail` genérico «Ocurrió un error inesperado. Probá de nuevo.». Sin respuesta: `NETWORK_ERROR`, «No pudimos conectar con el servidor.». Cualquier otra cosa: `UNKNOWN_ERROR`.
- Consumo en pantallas (C-14+): `error.code` para decidir el mensaje, `error.field` para marcar el campo del formulario (`VALIDATION_ERROR`, `DUPLICATE_VALUE`), `error.retryAfter` para el aviso de bloqueo de login. Un helper `mensajeDeCampo(error, campo)` devuelve `detail` si `field === campo`. Nunca se muestra `detail` de un 5xx tal cual (ya es genérico por backend).

### D5 — TanStack Query

- `crearQueryClient()`: `queries.retry = (n, e) => esApiError(e) && e.status !== null && e.status < 500 ? false : n < 1`; `queries.staleTime = 30_000`; `refetchOnWindowFocus` por defecto; `mutations.retry = false`. Los tests usan `crearQueryClient({ conReintentos: false })` (o `retry: false`), uno nuevo por test.
- `QueryClientProvider` en `AppProviders` con **una** instancia creada a nivel de módulo de la app (no en render).
- **Claves**: arrays jerárquicos con el dominio primero, fábricas `xxxQueries` con `queryOptions` en el `api/` del slice dueño: `['sesion', 'me']`, `['productos', 'lista', filtros]`, `['productos', 'detalle', id]`, `['pedidos', 'lista', filtros]`, `['pedidos', 'detalle', id]`. Datos **privados** (dependen del usuario) = toda clave cuyo primer elemento no está en la lista pública `CLAVES_PUBLICAS = ['productos', 'categorias', 'ingredientes', 'unidades-medida']`. Se documenta en `frontend/README.md`.

### D6 — Rehidratación y espera de sesión

- `SesionGate` (en `app/providers`, envuelve el `RouterProvider`) ejecuta `useQuery({ ...sesionQueries.rehidratar(), staleTime: Infinity, retry: false })` cuyo `queryFn` es `rehidratarSesion()`:
  1. Si hay access en el store (solo posible con OQ-1 = B) → `GET /auth/me` (si venció, el interceptor renueva).
  2. Si no → `renovarAccess()`; 401 → `anonima`; éxito → guardar access y `GET /auth/me`.
  3. Éxito → `establecerSesion(access, usuario)` (`autenticada`); cualquier error → `cerrarLocal()` (`anonima`, D6/OQ-8).
- TanStack Query deduplica el doble montaje de `StrictMode` (spec «Montaje doble»).
- Mientras `estado === 'verificando'`, `SesionGate` renderiza `PantallaCarga` (logo + «Cargando…», `role="status"`) **en lugar del router**: ninguna ruta ni guard ve el estado desconocido (OQ-4). Los guards igualmente tratan `verificando` como «mostrar carga» por defensa.
- `abrirSesion(access)` (para C-14): `establecerAccess` → `GET /auth/me` → `establecerSesion`; si falla → `cerrarLocal()` y relanza el `ApiError`.

### D7 — Guards y tabla de acceso

- `ACCESO_RUTAS: Record<Ruta, Acceso>` en `shared/config/routes.ts`, con `Acceso = 'publica' | 'anonima' | 'sesion' | { roles: readonly Rol[] }` y los valores de la spec «Tabla de acceso por ruta». `puedeAcceder(acceso, estado, roles)` es una función pura en el mismo segmento, probada por tabla.
- `navigation.ts` deja de declarar `visibleFor` propio: cada ítem deriva su visibilidad de `ACCESO_RUTAS[item.to]` (`publica` → siempre; `anonima` → sin roles conocidos; `sesion` → algún rol conocido; `roles` → intersección). Un solo lugar define quién entra y quién ve el ítem; los tests literales de C-13a (`navigation.test.ts`) garantizan que el resultado no cambia.
- `routes.tsx`: cada ruta de `MAPA_RUTAS` se envuelve en `<RequiereAcceso acceso={ACCESO_RUTAS[path]}>`. Comportamiento:
  - `anonima` en ruta `sesion`/`roles` → `<Navigate to="/ingresar" replace state={{ desde: {pathname, search, hash} }} />`.
  - `autenticada` sin rol requerido → `<ForbiddenPage />` en el lugar (URL intacta), dentro del shell.
  - `autenticada` en ruta `anonima` → `<Navigate replace to={desde accesible ?? '/catalogo'} />` (así C-14 no programa la vuelta al destino: al abrir la sesión el guard redirige solo).
  - Sesión perdida por logout voluntario → el contenedor del shell navega a `/catalogo` (D8); por vencimiento → la regla anónima normal.
- `desde` se valida: debe empezar con `/`, no con `//`, y su ruta debe existir en `ACCESO_RUTAS` (evita *open redirect*).

### D8 — Shell con sesión y cierre de sesión

- `ShellConSesion` (en `app/layouts/app-shell/`, mismo slice que `AppShell`) lee `useSesion()` de `@/entities/session` con selectores y pasa `roles`, `usuario={{ nombre: \`${nombre} ${apellido}\`, rolPrincipal }}` y `onCerrarSesion`. `AppShell` sigue presentacional (sus tests de C-13a no cambian). `rolPrincipal` = primer rol en `ADMIN > PEDIDOS > STOCK > CLIENT`, mostrado como código (igual que el mockup aprobado `shell-admin.html`, OQ-9).
- `useCerrarSesion()` (entities/session) = `useMutation({ mutationFn: cerrarSesionRemota })` con `onSettled`: `cerrarLocal({ motivo: 'logout' })`. `ShellConSesion` navega a `/catalogo` al terminar y no dispara si `isPending` (spec «Doble clic»).
- **Limpieza de caché por transición**: `SesionGate` se suscribe al store (`useAuthStore.subscribe`) y, cuando el estado pasa de `autenticada` a `anonima` (logout o vencimiento), hace `queryClient.removeQueries({ predicate: q => !CLAVES_PUBLICAS.includes(q.queryKey[0]) && q.queryKey[0] !== 'sesion' })`. Un único lugar cubre los dos caminos de la spec. El carrito (Zustand) no se toca (CE-14).
- «Cerrar todas las sesiones» (`/auth/logout-all`) queda como función en `shared/api`; su botón es de C-14.

### D9 — Stores

| Store | Ubicación | Estado | Persistencia |
|-------|-----------|--------|--------------|
| `useAuthStore` | `shared/auth` | `accessToken: string \| null`, `usuario: UsuarioSesion \| null`, `estado: EstadoSesion`, `motivo: 'logout' \| 'expirada' \| null`; acciones `establecerAccess`, `establecerSesion`, `establecerUsuario`, `cerrarLocal`, `expirarSesion`, `reset`; selectores `selectEstado`, `selectUsuario`, `selectRoles`, `selectEstaAutenticado` | **Según OQ-1.** A (recomendada): ninguna. B: `persist` `foodstore.auth` v1, `partialize` solo `accessToken`, mismo almacenamiento seguro que `uiStore` |
| `useCartStore` | `entities/cart` | `lineas: LineaCarrito[]` (`productoId`, `nombre`, `precioUnitario: string` decimal, `imagenUrl: string \| null`, `cantidad`, `personalizacion: number[]` ordenado); acciones `agregar`, `fijarCantidad`, `quitar`, `vaciar`, `reset`; selectores `selectTotalItems`, `selectTotalPrecio` (centavos enteros → string con 2 decimales), `selectLinea(clave)` | `persist` `foodstore.cart` v1 con `lineas` completas, `merge` que valida la forma (datos corruptos → vacío) |
| `usePaymentStore` | `entities/payment` | `pedidoId`, `estado: 'inactivo' \| 'procesando' \| 'aprobado' \| 'rechazado' \| 'pendiente' \| 'error'`, `mpPaymentId`, `statusDetail`, `error`; acciones `iniciar`, `registrarResultado`, `registrarError`, `reset` | Ninguna |
| `useUiStore` | `shared/model` | + `cartOpen`, `toasts: Toast[]` (`id`, `tipo`, `titulo`, `mensaje?`), `confirmModal: ConfirmModal \| null`; acciones `abrirCarrito`, `cerrarCarrito`, `notificar`, `descartarToast`, `pedirConfirmacion`, `cerrarConfirmacion` | Sin cambios: solo `sidebarCollapsed` |

- La clave de línea del carrito es `${productoId}:${personalizacion ordenada}`; los precios se suman en centavos enteros parseando el string decimal (sin `parseFloat` acumulado).
- `tema` no se agrega: el design system Revision 2 no define tema oscuro (OQ-3).
- Selectores centralizados y exportados; los componentes nunca leen un store entero. `src/test/setup.ts` resetea los cuatro stores en `beforeEach`.

### D10 — Estrategia de tests

- **MSW 2** (`msw/node`, `setupServer`) en `src/test/msw/server.ts`, iniciado en `setup.ts` con `onUnhandledRequest: 'error'` (un pedido no previsto hace fallar el test); handlers base para `/auth/refresh` (401 por defecto = anónimo), `/auth/me` y `/auth/logout`; overrides por test con `server.use`. Elegido porque la skill `react-testing` lo manda, simula en el borde de la red (el interceptor real de Axios corre completo, incluido el adaptador XHR) y sirve a todos los changes siguientes. *Alternativa*: `axios-mock-adapter` reemplaza el adaptador de Axios: más simple, pero no prueba la capa de transporte (credenciales, headers reales) y ata los tests a Axios.
- Contar llamadas a `/auth/refresh` con un contador en el handler; concurrencia con `Promise.all` de tres pedidos y un refresh con demora controlada (`delay()` de MSW).
- `withCredentials` se verifica por `request.credentials === 'include'` en el handler (los interceptores XHR de MSW lo mapean); si jsdom no lo refleja, se cae a verificar la configuración del cliente (riesgo R3).
- Guards y shell: `createMemoryRouter(routes, { initialEntries, future })` sobre el **mismo** árbol de la app, con `QueryClientProvider` y `SesionGate` reales (helper `renderApp(ruta, { sesion })` en `src/test/`). Stores por `getState()`.
- Arquitectura: el test FSD existente debe seguir sin violaciones con `entities/` nuevo; se agrega un fixture válido `entities → shared` y uno inválido `shared → entities`.

### D11 — Heredado de C-13a

- **Future flags**: constante `FUTURO_ROUTER` (`v7_relativeSplatPath`, `v7_fetcherPersist`, `v7_normalizeFormMethod`, `v7_partialHydration`, `v7_skipActionErrorRevalidation`) usada por `createBrowserRouter` y por los `createMemoryRouter` de los tests; `RouterProvider future={{ v7_startTransition: true }}`. Test: renderizar la app no emite `console.warn` con «React Router Future Flag Warning».
- **Stub de `Request`**: se mueve al `beforeEach` de `setup.ts` (se re-instala en cada test), así un `vi.unstubAllGlobals()` de un test no lo pierde; `error-page.test.tsx` restaura solo su propio stub (`vi.spyOn`/restore de `location`) en lugar de `unstubAllGlobals`.
- `RUTAS.raiz`: se elimina si sigue sin uso (el enlace «Volver al inicio» usa `'/'` literal del 404/error; se decide en apply: si se usa, se conserva).
- `export type { UsuarioShell }` desde `app/layouts/app-shell/index.ts`.
- Verificación visual de la variante con sesión contra `shell-admin.html` en verify.

## Risks / Trade-offs

- **R1 [XSS]** Con OQ-1 = A, un XSS puede usar la sesión mientras la pestaña está abierta pero no exfiltrar un token reutilizable desde el almacenamiento; con B, puede leer el access (30 min). → Recomendar A; en ambos casos nada de `dangerouslySetInnerHTML` y sin scripts de terceros fuera de MercadoPago (C-20).
- **R2 [Rúbrica]** «persist correcto» podría leerse como «authStore persiste el accessToken» (`[INT]` literal). → Con A, registrar la desviación como DD nuevo en KB/09 y en `frontend/README.md` (la spec `[INT]` dice también «NO en localStorage directamente»: es ambigua) para defenderla en la evaluación.
- **R3 [MSW + jsdom]** El stub de `Request` de `setup.ts` o el `AbortSignal` de jsdom pueden chocar con MSW. → Primera tarea de apply: spike con un test mínimo de MSW + Axios; si falla, fijar versiones compatibles o usar `fetch`-adapter de Axios; reportar antes de seguir.
- **R4 [Reuso por gracia]** Dos pestañas que recargan a la vez renuevan con el mismo refresh: el backend lo cubre con la gracia de 30 s (C-02, D7). Una pestaña dormida > 30 s con un refresh viejo no existe porque la cookie es compartida por el navegador. → Sin acción.
- **R5 [Pestañas desincronizadas]** Logout en una pestaña: la otra sigue con su access hasta su próximo 401 (≤ 30 min). → Aceptado (RN-AU-06 ya lo acepta en backend); sincronización fuera de alcance.
- **R6 [SameSite en ngrok]** Con el frontend en un dominio distinto del backend (ngrok), `SameSite=lax` bloquea la cookie del refresh en pedidos XHR cross-site. → Documentar en README: en ese escenario `REFRESH_COOKIE_SAMESITE=none` + `REFRESH_COOKIE_SECURE=true` (ya validado por `Settings`).
- **R7 [Pantalla de carga]** Un visitante anónimo espera un `POST /auth/refresh` (401 rápido) antes de ver el catálogo. → Aceptado (OQ-4); timeout de 15 s acota el peor caso.
- **R8 [Rol desconocido]** Un usuario solo con `COCINA` está `autenticada` pero la navegación lo ve como anónimo (C-13a ignora roles desconocidos). → Fuera de alcance hasta PA-07; se anota.

## Migration Plan

Sin migración de datos ni cambios en backend. Pasos de apply: agregar dependencias (`npm install axios @tanstack/react-query` y `npm install -D msw`; las ejecuta el agente de apply, no este propose), spike R3, luego bloques TDD de `tasks.md`. Rollback: revertir el commit del change (no hay datos persistidos nuevos salvo `foodstore.cart` en el navegador).

## Open Questions

> Governance ALTO: el usuario responde (o acepta el valor por defecto de) cada una antes de apply. OQ-1 cambia una spec y la KB; el resto ajusta detalles.

- **OQ-1 — ¿Dónde vive el access token? (decisión pedida por el roadmap).**
  - **A — Solo en memoria (recomendada).** Coincide con C-02 D3, RN-AU-10, KB/08 §Seguridad y PA-04. Al recargar: un `POST /auth/refresh` (la cookie viaja sola) + `GET /auth/me`; la sesión sobrevive a la recarga igual. Un XSS no encuentra un token en el almacenamiento para robarlo. Costo: un refresh por carga (el refresh rota cada vez; la gracia cubre varias pestañas) y desviarse del texto `[INT]` «`partialize` solo `accessToken`». Ediciones de KB: KB/08 §Estado del cliente (fila `authStore`: «sin `persist`; el access vive en memoria (DD-27); `[INT]` pedía `partialize` del `accessToken`»), KB/07 §Auth paso 5, KB/10 IN-07 (resolución: «access en memoria; la cookie del refresh rehidrata»), KB/05 RN-AU-10 (solo agregar «(DD-27)»), KB/09 nuevo **DD-27**.
  - **B — `persist` + `partialize` solo `accessToken` en `localStorage` (texto literal de `[INT]`).** Al recargar: `GET /auth/me` directo (sin refresh si el access no venció). Costo: el access (30 min, no revocable antes de `exp`, RN-AU-06) queda legible por cualquier XSS y sobrevive al cierre del navegador; contradice C-02 D3 y RN-AU-10. Ediciones de KB: KB/05 RN-AU-10 («el frontend lo persiste en `localStorage` vía `authStore`, solo el access»), KB/08 §Seguridad (ídem), KB/10 PA-04 («el access vive en memoria» → «persistido»), KB/09 **DD-27** con el trade-off; la spec `frontend-session` cambia el requisito «El access token vive solo en memoria» por «solo el access se persiste» (cambio en tasks: bloque 3).
- **OQ-2 — ¿`cartStore` y `paymentStore` ahora o en C-18/C-20?** Por defecto: **ahora** (el roadmap de C-13b pide los 4 stores y la rúbrica los evalúa juntos), con forma tipada, persistencia y acciones puras probadas (D9); C-18 suma la UI y la personalización visual, C-20 el flujo del brick. Corregir KB/08 (tabla de ubicación «`cartStore` (C-18); `paymentStore` (C-20)»). Alternativa: solo `authStore` + `uiStore` ahora y respetar KB/08 (se corrige el roadmap).
- **OQ-3 — ¿Qué campos suma `uiStore`?** Por defecto: `cartOpen`, `toasts` y `confirmModal` (estado y acciones, sin renderizado); `tema` no (el design system no tiene tema oscuro). Alternativa: solo `cartOpen` y que cada change sume lo suyo.
- **OQ-4 — ¿Espera global o por ruta mientras se verifica la sesión?** Por defecto: **global** (`SesionGate` muestra la pantalla de carga antes del router; sin parpadeo de la navegación anónima → con sesión). Alternativa: el shell y las rutas públicas se muestran enseguida y solo las protegidas esperan (más rápido para anónimos, pero el panel cambia de variante a la vista y requiere un estado visual extra del shell).
- **OQ-5 — ¿Qué ve un usuario con rol insuficiente?** Por defecto: página «Sin permiso» en el lugar (URL intacta, dentro del shell, enlace a Catálogo). Alternativa: redirigir a `/catalogo` en silencio (menos claro, oculta enlaces compartidos rotos).
- **OQ-6 — ¿A dónde lleva «Cerrar sesión»?** Por defecto: `/catalogo`. Alternativa: `/ingresar`.
- **OQ-7 — ¿MSW o `axios-mock-adapter` para los tests?** Por defecto: MSW 2 (D10).
- **OQ-8 — ¿Qué pasa si el backend no responde al arrancar?** Por defecto: sesión `anonima` y la app sigue (las pantallas muestran su propio error de red; la ruta protegida lleva a `/ingresar`, donde C-14 mostrará el error al intentar). Alternativa: pantalla de error con «Reintentar» antes del router (otro estado visual a mockear).
- **OQ-9 — ¿Cómo se muestra el rol en el pie del panel?** Por defecto: el código (`ADMIN`), igual que el mockup aprobado `shell-admin.html`. Alternativa: etiqueta legible («Administración», «Pedidos», «Stock», «Cliente»), que cambia el mockup.

> **Respuesta del usuario (2026-11-17): OQ-1 → A, el access token vive solo en memoria (no se persiste).** 
>
> **Respuesta del usuario (2026-11-17): OQ-2..OQ-9, aceptados los valores recomendados (por defecto).**

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-17)
- Mockups: mockups/ (`forbidden.html`, `session-loading.html`, `mockup.css`, `mockup.js`, `README.md`, `previews/`); creados antes de que OQ-4/OQ-5/OQ-8/OQ-9 tengan respuesta, con los valores por defecto; si cambian, se rehacen
- Approval: approved (2026-11-17, by user)
- Preview: rendered (2026-11-17, headless Edge, 1440x900 y 390x844: `mockups/previews/forbidden-{desktop,mobile,mobile-drawer}.png`, `session-loading-{desktop,mobile}.png`)
- Visual verify: passed (2026-11-17, backend real + Vite, browser pane; capturas en `mockups/verify/`: `forbidden-desktop.jpg`, `forbidden-mobile.jpg`, `forbidden-mobile-drawer.jpg`, `logout-catalogo-mobile.jpg`). Revisado: forbidden a 1440x900 y 375x812 dentro del shell con la nav de CLIENT y el pie «Cliente Prueba / CLIENT»; drawer mobile igual al mockup salvo el contador del carrito (es de C-18); anónimo en ruta protegida → `/ingresar` con `desde` en el state del router; cada recarga hace un solo `POST /auth/refresh` + `GET /auth/me`; storage solo `foodstore.ui` y cookie HttpOnly no visible; logout → `POST /auth/logout` 204, vuelve a `/catalogo` y una ruta protegida posterior lleva a `/ingresar`. Consola: solo el 401 esperado del refresh anónimo. No capturado: `PantallaCarga` (el refresh local responde demasiado rápido para verla; cubierta por los tests de `SesionGate`).

Estados visibles y cobertura:

| Estado | ¿Cubierto por un mockup aprobado? | Acción |
|--------|-----------------------------------|--------|
| Shell con sesión: navegación por rol, pie con usuario y «Cerrar sesión» | Sí: `openspec/changes/archive/2026-11-15-c-13a-fe-foundation-scaffold/mockups/shell-admin.html` (ADMIN, pie, botón de logout; las variantes CLIENT/PEDIDOS/STOCK son subconjuntos de la misma navegación) | Verificar contra ese mockup en verify (sin el contador del carrito, que es de C-18) |
| Shell sin sesión, 404, error, páginas provisorias (incluida «Ingresar» como destino de la redirección) | Sí: `shell-anon.html`, `not-found.html`, `error.html` de C-13a | Ninguna |
| **Página «Sin permiso»** (403 dentro del shell, p. ej. `CLIENT` en `/admin/usuarios`), desktop y mobile | **No** | Mockup nuevo `forbidden.html` |
| **Pantalla de carga de la sesión** (antes del router, logo + «Cargando…»), desktop y mobile | **No** | Mockup nuevo `session-loading.html` |
| Error de arranque con «Reintentar» | Solo si OQ-8 = alternativa | Mockup nuevo condicional |
| Rol con etiqueta legible en el pie | Solo si OQ-9 = alternativa | Re-render de `shell-admin` con la etiqueta |

Toasts y modal de confirmación no se renderizan en C-13b (solo estado), así que no requieren mockup acá.

## Notas de implementación

Desvíos respecto del diseño original (apply 2026-11-17) y su motivo:

- **`renovarAccess` vive en `shared/api/renovar-access.ts` (reexportada por `auth.ts`)**, con una instancia de Axios propia sin el interceptor de renovación. Así `http-client.ts` instala la renovación sin ciclo de imports (`http-client → renovar-access`, `auth → http-client`) y un `POST /auth/refresh` interno nunca puede entrar en bucle. La exclusión de `/auth/refresh` en el interceptor se mantiene para llamadas directas.
- **Instancia de Axios con Bearer en `shared/api/instancia.ts` (`crearInstancia`)**: único lugar que arma el header de autorización; `apiClient` y el cliente de renovación la comparten.
- **Orden de interceptores**: la renovación se registra antes que la normalización a `ApiError`, que es la última etapa.
- **`crearQueryClient` suma `reintentoEspera`** (ms entre reintentos) además de `conReintentos`, para probar el reintento único sin esperar el retroceso exponencial.
- **`authStore.limpiarMotivo()`** (acción no prevista): el motivo `logout` debe atenderse una vez (redirección a `/catalogo`) y no quedar pegado para una visita posterior a una ruta protegida (que debe ir a `/ingresar`). Lo consume `ShellConSesion`.
- **Heading de «Sin permiso»**: el mockup aprobado `forbidden.html` usa «No tenés acceso a esta sección»; se implementó ese texto (el criterio visual aprobado) y se ajustó el escenario de `frontend-route-guards` para nombrarlo. La página sigue llamándose «Sin permiso».
- **Ícono `candado`** agregado a `shared/ui/icon` (aprobado en el mockup): sigue faltando en el sprite de `design-system/components.html` (no se edita `design-system/` en este change).
- **`vite.config.ts` fija `VITE_API_URL=http://localhost:8000` solo para los tests** (`test.env`), para no depender de un `.env` local.
- **`almacenamientoSeguro` movido a `shared/lib`** y reutilizado por `uiStore` y `cartStore`.
- **El segundo test del arranque de future flags** (routers en memoria) se descartó: con `vi.resetModules()` se duplica el servidor MSW; los routers de prueba comparten `FUTURO_ROUTER` con la app y el test de arranque cubre el comportamiento.
- **OQ-1 = A**: la tarea 4.4 (ajustar la spec de sesión por persistencia) no aplica; la spec `frontend-session` queda como está.
- **Verify fixes (2026-11-17)**:
  1. **Carrera logout/renovación**: una respuesta de refresh tardía dejaba un token en memoria o pisaba el motivo `logout`. La regla vive en un solo lugar, `authStore`: `renovarAccess(previo, nuevo)` solo aplica si el access vigente sigue siendo `previo` (el que tenía el pedido al iniciar la renovación) y `expirarSesion(previo)` solo actúa sobre una sesión `autenticada` con ese mismo access. `establecerAccess` queda sin condición porque lo usan el login (`abrirSesion`) y la rehidratación, que parten de una sesión sin access (`anonima`/`verificando`); un guard por estado los rompería. La comparación por access también cubre «logout y login nuevo con un refresh viejo en vuelo». `renovacion.ts` captura `previo` al iniciar la renovación.
  2. **Sin rastro en el storage**: `app/__tests__/sin-rastro-storage.test.tsx` cubre rehidratación + renovación tras un 401 y verifica que ningún almacén contiene los access y que `localStorage` solo tiene `foodstore.ui`/`foodstore.cart`.
  3. **Redirect abierto**: `guards.test.tsx` suma `/\evil`, `/%2f%2fevil` y `/__proto__`; `destino.ts` ya los rechazaba (no hizo falta cambiarlo).
  4. **Documentación**: ver «Logout con el backend caído» abajo; `frontend-route-guards` nombra el encabezado «No tenés acceso a esta sección».
- **Logout con el backend caído**: si `POST /auth/logout` no llega, la cookie HttpOnly del refresh sigue viva: el frontend no puede borrarla y solo el servidor puede invalidarla. El estado del cliente se limpia igual (sesión `anonima`, sin access). Que el backend siempre expire la cookie queda fuera de alcance de este change.
- Sin `any`; el único `as unknown as` del frontend es de C-13a (`src/test/viewport.ts`, `matchMedia` simulado).

Cobertura escenario → test (todas las specs delta):

| Spec | Escenarios | Test |
|------|------------|------|
| `frontend-api-client` | URL con/sin barra final | `shared/api/__tests__/http-client.test.ts` |
| | Renovación con cookie / credenciales / Bearer / anónimo | `http-client.test.ts` |
| | Access vencido, lectura pública con access inválido, tres concurrentes, reintento rechazado, login sin renovar, logout con access vencido, 401 tardío, sesión vencida en el servidor | `shared/api/__tests__/renovacion.test.ts` |
| | Error de negocio, validación, 429 con `Retry-After`, backend apagado, respuesta de proxy | `shared/api/__tests__/api-error.test.ts` |
| | Recurso inexistente, falla transitoria | `shared/api/__tests__/query-client.test.tsx` |
| `frontend-session` | Arranque, sesión establecida, sin rastro en el almacenamiento | `shared/auth/__tests__/auth-store.test.ts`, `app/__tests__/sin-rastro-storage.test.tsx` |
| | Cookie vigente, sin cookie, backend caído, varios roles, login correcto, usuario no recuperable | `entities/session/__tests__/rehidratar.test.ts` |
| | Montaje doble, vencimiento (limpieza de caché) | `app/providers/__tests__/sesion-gate.test.tsx` |
| | Logout correcto / con backend caído / con carrito | `entities/session/__tests__/cerrar-sesion.test.tsx`, `app/layouts/app-shell/__tests__/shell-con-sesion.test.tsx` |
| | Refresh rechazado durante el uso | `app/router/__tests__/guards.test.tsx`, `sesion-gate.test.tsx` |
| `frontend-route-guards` | Toda ruta tiene acceso declarado, navegación coherente | `shared/config/__tests__/acceso.test.ts`, `navigation-acceso.test.ts` |
| | Recarga en ruta protegida, sesión recuperada, anónimo en Mis pedidos / administración, rol insuficiente, destino tras iniciar sesión, vencimiento, cierre voluntario, catálogo anónimo, ruta inexistente | `app/router/__tests__/guards.test.tsx`, `shell-con-sesion.test.tsx` |
| `frontend-app-shell` | Administradora con sesión, visitante anónimo, cerrar sesión, doble clic | `app/layouts/app-shell/__tests__/shell-con-sesion.test.tsx` |
| `frontend-client-stores` | Carrito persistente, líneas por personalización, cantidades, totales, datos corruptos, reinicio | `entities/cart/__tests__/cart-store.test.ts` |
| | Estado del pago no persistente | `entities/payment/__tests__/payment-store.test.ts` |
| | Estado de interfaz no persistente, notificaciones con id propio | `shared/model/__tests__/ui-store-estado.test.ts` |

