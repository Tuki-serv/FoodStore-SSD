# Food Store — Frontend

React 18 + TypeScript 5 (`strict`, sin `any`) + Vite 5 + Tailwind CSS 3 + Zustand 4 + TanStack Query 5 + Axios + react-router-dom 6. Tests con Vitest, React Testing Library y MSW. Organizado en Feature-Sliced Design (FSD).

## Requisitos

- Node.js 24 (o 22.22 en adelante) y npm. Con Node 20 los tests no corren: jsdom 31 y jest-dom 7 piden Node 22 o superior.
- El backend (`backend/`) para usar datos reales; la suite de tests **no** lo necesita.

## Puesta en marcha

Desde `frontend/`:

```bash
cp .env.example .env     # una vez; .env no se versiona
npm install
npm run dev              # http://localhost:5173
```

Con Docker Compose, desde la raíz del repo (requiere `frontend/.env`, creado con el `cp` de arriba; si no existe, `docker compose config` falla):

```bash
docker compose up -d frontend
```

### Variables de entorno

Solo se leen variables `VITE_*`, de forma explícita y sin valores por defecto ocultos (módulo `src/shared/config/env.ts`). Si falta una obligatoria, la app falla al arrancar nombrándola.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_API_URL` | Sí | URL base del backend FastAPI, tal como la ve el navegador (`http://localhost:8000`). |

Las variables `VITE_*` van en `frontend/.env`, nunca en el `.env` de la raíz (que es solo de Docker Compose).

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm test` | Corre toda la suite una vez (`vitest run`), sin backend ni red. |
| `npm run test:watch` | Tests en modo watch. |
| `npm run typecheck` | `tsc --noEmit` con `strict`. |
| `npm run lint` | ESLint (`@typescript-eslint/no-explicit-any` es error). |

Para correr un archivo: `npm test -- fsd` (filtra por nombre).

## Estructura (FSD) y mapeo con la estructura de la spec `[INT]`

`src/` usa las capas de FSD v2.1: `app`, `pages`, `entities` y `shared`. `features` y `widgets` se crean cuando un change tenga dos consumidores reales (`features/` llega con C-14). Un módulo solo importa de capas inferiores, nunca de otro slice de su misma capa, y entre capas solo por la API pública (`index.ts`) del slice o segmento. Alias: `@/` apunta a `src/`; `@design-system/` apunta a `../design-system/`.

```text
src/
  app/        providers/ (AppProviders, SesionGate), router/ (rutas, mapa con dueño, guards), layouts/app-shell/ (panel lateral), styles/
  pages/      un slice por pantalla: placeholder/, not-found/, error/, forbidden/ (las de negocio llegan en C-14 y siguientes)
  entities/   session/ (operaciones y hooks de sesión), cart/ (cartStore), payment/ (paymentStore)
  shared/     api/ (cliente HTTP, ApiError, QueryClient), auth/ (authStore), config/ (env, roles, rutas y acceso, marca),
              model/ (uiStore), lib/ (useMediaQuery, almacenamiento seguro), ui/ (Icon, PantallaCarga, botones)
  test/       setup de Vitest (MSW y reset de stores), msw/, render-app, router, query (no es una capa de la app)
tests/architecture/   fronteras FSD y tokens de Tailwind (corren con `npm test`)
```

| `[INT]` (spec) | FSD en este repo |
|----------------|------------------|
| `app/` (providers, router, estilos) | `src/app/` (`providers/`, `router/`, `layouts/app-shell/`, `styles/`) |
| `pages/` | `src/pages/<slice>/` (uno por ruta) |
| `features/` | `src/features/<slice>/` (desde C-14) |
| `components/` | `src/shared/ui/` |
| `hooks/` | segmentos `api/` y `model/` de cada slice |
| `store/` (4 stores) | `uiStore` en `src/shared/model/`; `authStore` en `src/shared/auth/`; `cartStore` en `src/entities/cart/`; `paymentStore` en `src/entities/payment/` |
| `api/` | `src/shared/api/` |
| `types/` | segmento `model/` del slice; contratos HTTP en `shared/api` |

## Tokens y estilos

La fuente visual es `design-system/tokens.css` (Revision 2): se importa tal cual desde `src/app/styles/index.css`, sin copiarlo. El tema de Tailwind (`tailwind.config.ts`) solo referencia esas variables con `var(--…)`; un test (`tests/architecture/tailwind-tokens.test.ts`) falla si aparece un valor literal o una variable inexistente. Para cambiar un color o espaciado, se edita `design-system/tokens.css`.

El CSS del panel lateral (`src/app/layouts/app-shell/app-shell.css`) es el aprobado en `design-system/components.html`. Las páginas usan utilidades de Tailwind.

## Tests

`npm test` ejecuta tests de componentes en jsdom (por lo que el usuario ve y hace: roles accesibles, texto, interacción) y los tests de arquitectura. La red se simula en el borde con **MSW** (`src/test/msw/server.ts`, iniciado en `src/test/setup.ts` con `onUnhandledRequest: 'error'`: un pedido sin handler hace fallar el test); cada test sobrescribe con `server.use(...)`. `renderApp(ruta, { sesion })` (`src/test/render-app.tsx`) monta el árbol real con sesión y router; los stores se reinician solos entre tests. jsdom no evalúa CSS ni media queries: el comportamiento desktop/mobile se prueba con un `matchMedia` simulado (`setViewport(ancho)` en `src/test/viewport.ts`); la apariencia se verifica contra los mockups.

## Cliente HTTP y errores (`src/shared/api/`)

Las pantallas nunca usan `axios` directo: importan `apiClient` (o las funciones de cada `api/`) desde `@/shared/api`. El cliente apunta a `VITE_API_URL` + `/api/v1` (se indica solo el path: `apiClient.get('/auth/me')`), envía las credenciales del navegador (la cookie HttpOnly del refresh viaja sola a `/api/v1/auth`) y agrega `Authorization: Bearer <access>` si hay access en el `authStore`.

- **Renovación ante 401** (`renovacion.ts`): `POST /auth/refresh`, guarda el access nuevo y repite el pedido una sola vez. Los 401 concurrentes comparten **una** renovación (evita el reuso del refresh rotado). `/auth/login` y `/auth/refresh` no renuevan; `/auth/logout` sí. Si la renovación falla, la sesión queda anónima (`motivo: 'expirada'`).
- **Errores**: todo pedido fallido llega como `ApiError` (`status`, `code`, `detail`, `field`, `retryAfter`). Decidí por `code` (`INSUFFICIENT_STOCK`, `VALIDATION_ERROR`, `RATE_LIMIT_EXCEEDED`, `NETWORK_ERROR`, `HTTP_<status>`...), nunca por el texto de `detail`; usá `field` para marcar un campo (`mensajeDeCampo(error, 'email')`) y `retryAfter` (segundos, solo en 429) para el aviso de bloqueo de login. `esApiError(error)` acota el tipo; con TanStack Query `error` ya es `ApiError`.
- **Sesión**: el access vive **solo en memoria** (DD-27, `knowledge-base/09`); al recargar, `SesionGate` (`src/app/providers/sesion-gate.tsx`) rehidrata con `POST /auth/refresh` + `GET /auth/me` una sola vez y muestra `PantallaCarga` mientras tanto. Operaciones: `abrirSesion(access)` (la usa el login de C-14), `useCerrarSesion()`, `useSesion()` desde `@/entities/session`. Los roles de la interfaz salen de `GET /auth/me`.
- **Carrera logout/renovación**: la renovación solo aplica si el access vigente sigue siendo el que tenía el pedido al empezar (`renovarAccess(previo, nuevo)` en `authStore`); una respuesta de refresh tardía tras un logout o un login nuevo se descarta.
- **Logout con el backend caído**: la cookie HttpOnly del refresh sigue viva, porque el frontend no puede borrarla y solo el servidor puede invalidarla. El estado del cliente se limpia igual (sesión anónima, sin access en memoria).
- **Nota ngrok / `SameSite`**: si el frontend se sirve en otro dominio que el backend (por ejemplo un túnel de ngrok), `SameSite=lax` bloquea la cookie del refresh en los pedidos XHR cross-site. En ese caso el backend necesita `REFRESH_COOKIE_SAMESITE=none` y `REFRESH_COOKIE_SECURE=true` (ya validado por su `Settings`).

### Claves de consulta (TanStack Query)

Arrays jerárquicos con el **dominio primero**, definidos con `queryOptions` en el `api/` del slice dueño (por ejemplo `sesionQueries` en `src/entities/session/api/session-queries.ts`): `['sesion', 'rehidratar']`, `['productos', 'lista', filtros]`, `['productos', 'detalle', id]`, `['pedidos', 'lista', filtros]`, `['pedidos', 'detalle', id]`. Son **públicas** (sobreviven al cierre de sesión) las que empiezan con una de `CLAVES_PUBLICAS` (`productos`, `categorias`, `ingredientes`, `unidades-medida`); todo lo demás es privado y se descarta de la caché cuando la sesión pasa de `autenticada` a `anonima` (`esConsultaPrivada` en `src/shared/api/query-client.ts`). La caché no reintenta 4xx, reintenta una vez ante red o 5xx, y nunca reintenta mutaciones (`crearQueryClient`).

### Acceso por ruta

`ACCESO_RUTAS` (`src/shared/config/routes.ts`) es la única tabla de quién entra a cada ruta; la leen los guards (`src/app/router/requiere-acceso.tsx`) y la navegación (`src/app/layouts/app-shell/model/navigation.ts`). Es ayuda de UX: el backend autoriza cada pedido.

## Estado actual

- La app arranca verificando la sesión y muestra el panel lateral con la variante de los roles del usuario (o «sin sesión»: Catálogo, Ingresar, Registrarse) y páginas provisorias por ruta. Las rutas tienen guards por rol (anónimo → `/ingresar`, rol insuficiente → «Sin permiso»).
- Las páginas provisorias no piden ni muestran datos del backend.
- Cada ruta declara en `src/app/router/route-map.ts` el change que implementa su pantalla (`owner`).
