# Design — C-13a `fe-foundation-scaffold`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/frontend-foundation` y `specs/frontend-app-shell` (capacidades nuevas; ninguna capacidad de backend cambia).

Restricciones que dan forma al enfoque:

- **Stack fijado por la spec `[INT]`** (KB/02): React 18, TypeScript 5 `strict`, Vite 5, Tailwind CSS **3**, Zustand 4, TanStack Query 5 (llega en C-13b). La skill `tailwind-design-system` describe Tailwind v4 (CSS-first); manda el stack del proyecto y los tokens de `design-system/tokens.css`.
- **Design system Revision 2 aprobado** (`design-system/README.md` §Sidebar navigation): marcado, clases, estados (`.is-collapsed`, `.drawer-open`, `.is-ready`), tokens del shell y el sprite de íconos están en `components.html`. No se rediseña nada: se traslada a React.
- **No hay sesión todavía**: C-13a no tiene `authStore` ni `GET /auth/me` (C-13b), pero la navegación depende de roles (DD-25) y del `uiStore` (KB/08).
- **Variables `VITE_*`**: el `.env.example` de la raíz debe tener exactamente `POSTGRES_*`/`PGADMIN_*` (`backend/tests/unit/test_env_example.py::test_example_de_la_raiz_solo_define_variables_de_docker_compose`). DD-18: variables explícitas, sin defaults ocultos.
- **`design-system/` vive fuera de `frontend/`**: Vite solo sirve archivos fuera de su raíz si se habilitan con `server.fs.allow`, y el contexto de build de Docker `./frontend` no lo incluye.
- **Reglas duras**: FSD (8), estado de servidor en TanStack Query y Zustand solo para cliente (8), TS estricto sin `any` (7), nunca correr build ni dev server por iniciativa propia (13): la verificación de apply es tests + `tsc --noEmit` + lint.
- `.gitignore` de la raíz no ignora `node_modules/`.

## Goals / Non-Goals

**Goals:** proyecto que arranca con el shell aprobado y la variante «sin sesión»; la navegación de todos los roles ya decidida y probada como datos, para que C-13b solo conecte la fuente de roles; fronteras FSD y tokens verificados por tests (no por convención); cada ruta futura con su dueño explícito.

**Non-Goals:** autenticación, guards, datos del backend, contadores (carrito), toasts, modales, tema oscuro, i18n, build de producción, PWA, e2e con navegador (Playwright) — la verificación visual se hace contra los mockups en verify.

## Decisions

**D1 — Capas FSD v2.1 con mapeo explícito a la estructura `[INT]` (OQ-1).**
`frontend/src/` usa las capas de FSD v2.1 (`app`, `pages`, `shared`; `entities`/`features`/`widgets` se crean cuando un change tenga dos consumidores reales, regla «empezar simple» de la skill). Se documenta en `frontend/README.md` (y luego en KB/08) el mapeo con los nombres de `[INT]`:

| `[INT]` | FSD en este repo |
|---------|------------------|
| `app/` (providers, router, estilos) | `src/app/` (`providers/`, `router/`, `layouts/app-shell/`, `styles/`) |
| `pages/` | `src/pages/<slice>/` (uno por ruta) |
| `features/` | `src/features/<slice>/` (desde C-14) |
| `components/` | `src/shared/ui/` |
| `hooks/` | segmentos `api/`/`model/` de cada slice |
| `store/` (4 stores) | `uiStore` → `src/shared/model/`; `authStore` → `shared/auth` o `entities/session` (C-13b); `cartStore` (C-18); `paymentStore` (C-20) |
| `api/` | `src/shared/api/` (C-13b) |
| `types/` | segmento `model/` del slice; contratos HTTP en `shared/api` |

Alias `@/` → `src/`. Cada slice exporta por `index.ts`; `shared` tiene `index.ts` por segmento y no uno global.
*Alternativa:* carpetas literales de `[INT]` (`components/`, `hooks/`, `store/`): no es FSD (no hay slices ni regla de capas verificable) y la rúbrica pide «feature-sliced sin cross-imports».

**D2 — Test de fronteras de import sin dependencias extra.**
El test vive en `frontend/tests/architecture/fsd-boundaries.test.ts` (fuera de `src/`, para no pertenecer a ninguna capa). Recorre `src/**/*.{ts,tsx}`, extrae los especificadores de `import`/`export … from` con una expresión regular sobre el texto (suficiente para imports estáticos; los dinámicos `import()` también se capturan) y verifica: (a) capa destino estrictamente inferior, (b) sin imports entre slices de la misma capa, (c) desde otra capa solo `@/<capa>/<slice>` o `@/shared/<segmento>` (sin rutas internas), (d) sin imports relativos que salgan del slice. Es el análogo de `backend/tests/unit/test_arquitectura_capas.py`. El test se escribe RED con un archivo fixture que viola cada regla (carpeta `tests/architecture/fixtures/`), así no es tautológico.
*Alternativas:* `steiger` (linter oficial de FSD) o `eslint-plugin-boundaries`: dependencia más y reglas configurables por fuera de la suite; se pueden sumar después sin cambiar el contrato.

**D3 — Tokens: `tokens.css` importado tal cual y tema de Tailwind 3 con `var(--…)`.**
Alias Vite `@design-system` → `../design-system`; `src/app/styles/index.css` hace `@import "@design-system/tokens.css";` y luego `@tailwind base/components/utilities`. `server.fs.allow` incluye `..` (la raíz del repo). `tailwind.config.ts` define `theme.extend` (colores, `fontFamily`, `fontSize`, `spacing`, `borderRadius`, `boxShadow`, `transitionDuration`, `transitionTimingFunction`, `zIndex`) **solo** con `var(--token)`; ningún hex. El test `tests/architecture/tailwind-tokens.test.ts` parsea `design-system/tokens.css` (nombres de custom properties) y recorre el tema exportado por `tailwind.config.ts`: cada hoja debe ser `var(--x)` con `--x` declarado; un fixture con un hex lo hace fallar. Resuelve el TBD del README del design system («mapear tokens a Tailwind: sí»).
*Alternativa:* copiar los valores al config de Tailwind (dos fuentes de verdad; contradice «project tokens prevail»).

**D4 — CSS del shell trasladado desde `components.html`, no reescrito en utilidades.**
`src/app/layouts/app-shell/app-shell.css` porta literalmente las reglas aprobadas del shell (`.shell`, `.sidebar*`, `.nav-*`, `.icon-btn`, `.topbar`, `.scrim`, `.btn-close`, `.tip`, media query 1023.98px, `.is-ready`) dentro de `@layer components`. Las páginas usan utilidades de Tailwind. Garantiza fidelidad 1:1 con la Revision 2 y que verify compare contra los mockups, que usan las mismas reglas. Los íconos del sprite se trasladan a `src/shared/ui/icon/` como componente `Icon` con un `name` tipado (unión literal), mismo `viewBox` y trazos.
*Alternativa:* reescribir todo con utilidades de Tailwind: más idiomático, pero cada clase reinterpretada es una oportunidad de divergir del diseño aprobado; se puede refactorizar después con los mockups como referencia.

**D5 — Navegación como configuración tipada + función pura (resuelve «roles sin auth»).**
`src/app/layouts/app-shell/model/navigation.ts` declara los ítems una sola vez, en orden canónico: `{ id, label, to, icon, visibleFor }`, donde `visibleFor` es `'anon'` o un conjunto de `Rol`, y grupos `{ id: 'administracion', title: 'Administración', items }`. `seccionesParaRoles(roles: readonly string[]): SeccionNav[]` es pura: normaliza (ignora roles desconocidos como `COCINA`), sin roles conocidos → ítems `anon`; con roles → unión, sin duplicados, orden canónico; grupos vacíos se omiten. `Rol = 'ADMIN' | 'STOCK' | 'PEDIDOS' | 'CLIENT'` vive en `src/shared/config/roles.ts` (contrato del backend, sin lógica). Se testea para cada rol y combinación (spec «Secciones de navegación por rol», «Unión…», «Secciones del gestor de stock»).
El componente `AppShell` recibe `roles?: readonly string[]` (por defecto `[]`) y `usuario?: { nombre: string; rolPrincipal: string }` para el pie; el router de C-13a lo monta sin props → variante «sin sesión». C-13b solo cambia el elemento de layout del router para pasar los roles de `GET /auth/me` (fuente de autoridad para la UI según C-08; ver «Hallazgos» sobre DD-25). Ningún archivo de C-13a importa sesión ni fetch.
*Alternativas:* (a) leer roles de un `authStore` stub creado en C-13a: adelanta una pieza de C-13b con forma que esa decisión (ALTO) todavía no fijó; (b) un contexto React `RolesProvider`: agrega indirección sin beneficio mientras haya un solo consumidor.

**D6 — `uiStore` ahora, solo con el estado del panel (OQ-3).**
`src/shared/model/ui-store.ts` (Zustand 4 + `persist`, nombre `foodstore.ui`, `partialize` → solo `sidebarCollapsed`, `version: 1`) con `sidebarCollapsed`, `sidebarOpen`, acciones `toggleSidebarCollapsed`, `openSidebar`, `closeSidebar`, `reset`; selectores exportados (`selectSidebarCollapsed`…) para suscripción por slice (rúbrica Zustand). Está en `shared` porque el estado de UI global lo consumirán varias capas (`cartOpen` del drawer del carrito en C-18, toasts). `cartOpen`, `confirmModal`, tema y toasts los agrega el change que los usa. Storage envuelto en try/catch: si falla, arranca expandido (spec «Almacenamiento no disponible»).
*Alternativa:* `useState` local en `AppShell` + `localStorage` a mano: cumple hoy, pero KB/08 ya ubica estos campos en `uiStore` y C-18 necesitaría migrarlo.

**D7 — Breakpoint y drawer.**
`useMediaQuery('(min-width: 1024px)')` en `src/shared/lib/media-query/` (con `matchMedia` y listener `change`). Colapso aplicado solo si desktop; drawer solo si mobile; al pasar a desktop se cierra el drawer. Abrir mueve el foco a «Cerrar menú»; cerrar por botón/scrim/Esc devuelve el foco a «Abrir menú»; navegar cierra el drawer (efecto sobre `location.pathname`). Mientras el drawer está abierto se bloquea el scroll del documento. Sin animación inicial: el shell agrega `is-ready` tras dos `requestAnimationFrame` (mismo patrón que `components.html`); el estado persistido está disponible en el primer render porque `persist` con `localStorage` hidrata de forma síncrona.

**D8 — Router: `react-router-dom` 6 con `createBrowserRouter` y mapa de rutas declarativo.**
`src/shared/config/routes.ts` exporta `RUTAS` (paths en español, spec «Mapa de rutas con dueño») y `src/app/router/route-map.ts` declara cada ruta con `{ path, title, owner }` (`owner: 'C-14' | … | 'C-24'`). Las rutas sin pantalla usan `pages/placeholder` (`PlaceholderPage` con `title`): encabezado + «Estamos preparando esta sección.»; el dueño queda en la configuración y en un `data-owner`, no en el texto visible (OQ-6). Árbol: raíz con `errorElement: <ErrorPage/>` → hijo layout `AppShell` (con `<Outlet/>`) → `index` = `<Navigate to="/catalogo" replace/>`, las 13 rutas y `*` = `NotFoundPage`. Tests con `createMemoryRouter` sobre el **mismo** arreglo de rutas que usa la app (`routes` exportado), así se prueban las rutas reales.
Dueños: `/catalogo` C-16 · `/ingresar`, `/registrarse`, `/mi-cuenta` C-14 · `/direcciones` C-15 · `/carrito` C-18 · `/mis-pedidos` C-21 · `/gestion-pedidos` C-22 · `/admin/categorias`, `/admin/ingredientes` C-17a · `/admin/productos` C-17b · `/admin/usuarios` C-23 · `/admin/dashboard` C-24.
*Alternativas:* TanStack Router (no está en el stack de la spec); rutas declaradas como JSX (`createRoutesFromElements`): equivalentes, pero el arreglo permite recorrerlo en tests.

**D9 — Página de error fuera del shell; 404 dentro (OQ-7).**
`errorElement` en la ruta raíz renderiza `pages/error` a pantalla completa (logo, «Algo salió mal», «Reintentar» = `window.location.reload()`, «Volver al inicio» = `<a href="/">`); no depende del shell porque el error puede venir del shell mismo. En desarrollo, el error se registra en consola; nunca se muestra en la UI. `*` es hijo del layout → la 404 conserva la navegación.

**D10 — Configuración: `readConfig(env)` pura y fail-fast.**
`src/shared/config/env.ts`: `readConfig(env: Record<string, string | undefined>): AppConfig` valida `VITE_API_URL` (no vacía; se exige URL `http(s)://` válida) y lanza `Error('Falta la variable VITE_API_URL …')`; `config = readConfig(import.meta.env)` se evalúa en `main.tsx` antes de montar React. `src/vite-env.d.ts` tipa `ImportMetaEnv`. `frontend/.env.example`: `VITE_API_URL=http://localhost:8000` con comentario. `VITE_MP_PUBLIC_KEY` lo agrega C-20. Un test compara las claves leídas por `readConfig` con las de `.env.example`.

**D11 — Compose: servicio de desarrollo (OQ-4).**
`frontend/Dockerfile` (`node:20-alpine`, `npm ci`, `CMD ["npm","run","dev","--","--host","0.0.0.0","--port","5173"]`) y en `docker-compose.yml` de la raíz: `build: ./frontend`, `env_file: ./frontend/.env`, `ports: "5173:5173"`, `volumes: ./frontend:/app`, volumen anónimo `/app/node_modules`, `./design-system:/design-system:ro` (así `../design-system` desde `/app` resuelve igual que en local), `depends_on: backend`. `VITE_API_URL` apunta al host (`http://localhost:8000`) porque lo usa el navegador, no el contenedor. El apply **no** levanta el servicio (regla 13); se verifica con `docker compose config` (no arranca nada).
*Alternativa:* imagen de producción (build + nginx): corresponde a la entrega/deploy (C-25b, bonus).

**D12 — Tooling y versiones.**
`vite@5`, `@vitejs/plugin-react@4`, `typescript@5`, `tailwindcss@3.4`, `postcss`, `autoprefixer`, `react@18`, `react-dom@18`, `react-router-dom@6`, `zustand@4`; tests: `vitest@2` (compatible con Vite 5), `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; lint: `eslint@9` + `typescript-eslint` (`no-explicit-any: error`) + `eslint-plugin-react-hooks`. Scripts: `dev`, `test`, `test:watch`, `typecheck` (`tsc -b --noEmit` o `tsc --noEmit -p`), `lint`. `src/test/setup.ts` registra jest-dom, un `matchMedia` controlable (`setViewport(width)`), limpia `localStorage` y resetea `uiStore` entre tests. Versiones exactas: las fija `package-lock.json` al instalar.

**D13 — Marca.**
El logo se importa de `@design-system/assets/logo.svg` (punto único de reemplazo). El nombre visible sale de `src/shared/config/brand.ts` (`BRAND_NAME = 'Food Store'`, comentario que remite a `design-system/brand.js`); el `alt` del logo dice «Food Store (logo provisional)» mientras el logo sea provisional. Ver OQ-8.

## Risks / Trade-offs

- [jsdom no aplica CSS ni media queries] → el comportamiento desktop/mobile se prueba con el `matchMedia` simulado y atributos accesibles (`aria-expanded`, nombres, foco); la apariencia se verifica contra los mockups en verify con capturas.
- [Test de imports por regex] puede no ver imports armados dinámicamente con strings calculados → el repo no los usa; el test falla si encuentra un `import()` no literal.
- [Rutas alcanzables sin guard hasta C-13b] → las páginas provisorias no muestran datos; C-13b agrega guards (riesgo nulo para datos).
- [CSS portado con nombres globales (`.sidebar`)] → colisiones con utilidades: se encapsulan bajo `.shell` y `@layer components`; Tailwind no define esas clases.
- [`server.fs.allow: ['..']` amplía lo que sirve el dev server] → solo en desarrollo local; se restringe a `['.', '../design-system']`.
- [Versiones en un proyecto nuevo] → `npm install` con las mayores fijadas en D12; si `vitest@2` exige otra mayor de Vite, se respeta Vite 5 (stack de la spec) y se ajusta vitest.

## Migration Plan

Proyecto nuevo: no hay datos ni usuarios que migrar. Rollback = revertir los commits del change (el backend y su compose no cambian salvo el servicio agregado, que no lo afecta).

## Open Questions

- **OQ-1 — ¿Capas FSD v2.1 o carpetas literales de `[INT]`?** Por defecto: FSD v2.1 (`app`/`pages`/`shared`, demás capas a demanda) con la tabla de mapeo de D1 en `frontend/README.md` y KB/08. Alternativa: `pages/features/components/hooks/store/api/types` literales.
- **OQ-2 — ¿Qué ve el rol `STOCK` en el panel?** DD-25 no lo menciona. Por defecto: lo de `CLIENT` + grupo «Administración» con solo «Productos y stock» (mismo patrón que `PEDIDOS` = `CLIENT` + su sección; la pantalla la limita C-17b). Requiere agregar `STOCK` a DD-25 al cerrar. Alternativas: solo Catálogo + Mi cuenta + Productos y stock; o no mostrarle nada extra hasta C-17b.
- **OQ-3 — ¿`uiStore` ahora o estado local?** Por defecto: `uiStore` ahora en `shared/model`, solo con `sidebarCollapsed` (persistido) y `sidebarOpen`; los demás stores y campos, en sus changes. Alternativa: estado local en el shell y migrar en C-18.
- **OQ-4 — ¿Servicio `frontend` en Compose y de qué tipo?** Por defecto: sí, servidor de desarrollo de Vite en 5173 con `frontend/.env` y `design-system/` montado en solo lectura. Alternativas: no agregarlo todavía (quitar el comentario en C-25b) o imagen de producción con nginx.
- **OQ-5 — ¿Paths de rutas?** Por defecto: en español, como la UI (`/catalogo`, `/mis-pedidos`, `/admin/productos`…) y `/` → `/catalogo`. Alternativa: inglés (`/catalog`, `/orders`) o `/` como landing propia.
- **OQ-6 — ¿Texto de las páginas provisorias?** Por defecto: título de la sección + «Estamos preparando esta sección.», con el dueño solo en la configuración (`owner`) y `data-owner`. Alternativa: mostrar «Llega en C-xx» visible (útil para la demo interna, raro para un usuario).
- **OQ-7 — ¿Página de error dentro o fuera del shell?** Por defecto: fuera (pantalla completa), porque el shell puede ser el que falló; la 404 sí va dentro. Alternativa: ambas dentro del shell con un límite de error propio.
- **OQ-8 — ¿Fuente del nombre de marca en la app?** Por defecto: `shared/config/brand.ts` (constante con comentario a `design-system/brand.js`) y agregar ese archivo a los «Replacement steps» del README del design system en el próximo change que lo toque. Alternativa: generar `brand.ts` desde `brand.js` en un script (más maquinaria para un solo string).

### Respuestas (2026-11-15)

El usuario pidió seguir de largo sin responder una por una, así que OQ-1..OQ-8 se toman **con el valor por defecto** de cada una. No son respuestas explícitas del usuario: quedan para su revisión posterior. OQ-2 (`STOCK`) es la más discutible porque completa una decisión suya (DD-25): se implementa el valor por defecto y se marca como provisorio en DD-25.

## Hallazgos para el usuario (no se tocan en este propose)

- **DD-25 vs C-08/C-13b:** DD-25 dice que los ítems visibles «se derivan del claim `roles`»; C-08 y la entrada de C-13b en CHANGES.md dicen que la UI toma los roles de `GET /auth/me`. Este diseño es agnóstico (el shell recibe roles); conviene alinear el texto de DD-25 cuando se cierre C-13b.
- **DD-25 sin `STOCK`:** ver OQ-2; al decidir, actualizar KB/09 DD-25 y `design-system/README.md` §Sidebar navigation.
- **`design-system/README.md`:** el TBD «mapear tokens a Tailwind» queda resuelto por D3, y el nombre de marca gana un segundo punto de reemplazo (D13). Actualizar el README al archivar (requiere tocar `design-system/`, fuera de este propose).
- **`.gitignore`** sin `node_modules/`: lo agrega este change (tarea 1.2).

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-15)
- Mockups: openspec/changes/c-13a-fe-foundation-scaffold/mockups/
- Approval: pending (el usuario NO revisó los mockups; el 2026-11-15 pidió aplicar sin esperar su revisión: «apenas termine, aplicalo» / «dale, seguí de largo». Dispensa solo para este change; los mockups siguen siendo criterio de aceptación y el usuario los revisa después del apply) **Actualización 2026-11-15:** el usuario revisó los mockups después del apply y los aprobó → `approved (2026-11-15, by user)`.
- Preview: rendered (2026-11-15, mockups/previews/shell-anon-desktop-expanded.png, shell-anon-desktop-collapsed.png, shell-anon-mobile-closed.png, shell-anon-mobile-drawer.png, shell-admin-desktop-expanded.png, shell-admin-desktop-collapsed.png, shell-admin-mobile-drawer.png, not-found-desktop.png, not-found-mobile.png, error-desktop.png, error-mobile.png)
- Visual verify: differences (2026-11-15; 2 major corregidas en el mismo change y re-capturadas, quedan diferencias menores; ver ## Verify y «Correcciones posteriores al verify»)

Pantallas: `mockups/shell-anon.html` (lo que entrega C-13a), `mockups/shell-admin.html` (vista futura, depende de C-13b), `mockups/not-found.html`, `mockups/error.html`. Brief, estados y pasos de previsualización: `mockups/README.md`. Los íconos nuevos `i-obra`, `i-brujula` e `i-alerta` se suman al sprite del design system si se aprueban.

## Notas de implementación

### Respuestas a OQ-1..OQ-8 (aplicadas el 2026-11-15, valores por defecto; no son respuestas explícitas del usuario, quedan para su revisión)

| OQ | Valor aplicado |
|----|----------------|
| OQ-1 | FSD v2.1 (`app`/`pages`/`shared`), mapeo a `[INT]` en `frontend/README.md` y KB/08 |
| OQ-2 | `STOCK` = CLIENT + grupo «Administración» con solo «Productos y stock»; marcado como provisorio en KB/09 DD-25 |
| OQ-3 | `uiStore` ahora, en `src/shared/model/ui-store.ts`, solo `sidebarCollapsed` (persistido) y `sidebarOpen` |
| OQ-4 | Servicio `frontend` de desarrollo en `docker-compose.yml` (5173, `frontend/.env`, `design-system/` en solo lectura) |
| OQ-5 | Paths en español; `/` redirige a `/catalogo` |
| OQ-6 | Páginas provisorias: título + «Estamos preparando esta sección.»; dueño en `data-owner` y en `route-map.ts` |
| OQ-7 | Error a pantalla completa fuera del shell; 404 dentro del shell |
| OQ-8 | `src/shared/config/brand.ts` (`BRAND_NAME`, `LOGO_ALT`); falta sumarlo a los «Replacement steps» de `design-system/README.md` |

### Versiones instaladas (`package-lock.json`)

Node 24.22.1 / npm 11.19.1 (host). react 18.3.1, react-dom 18.3.1, react-router-dom 6.30.6, zustand 4.5.7, vite 5.4.21, @vitejs/plugin-react 4.7.0, typescript 5.9.3, tailwindcss 3.4.19, postcss 8.5.33, autoprefixer 10.6.2, postcss-import 16.2.0 (solo tests), vitest 2.1.9, jsdom 31.0.1, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, @testing-library/user-event 14.6.10, @testing-library/jest-dom 7.0.1, eslint 9.39.5, typescript-eslint 8.72.2, eslint-plugin-react-hooks 7.1.1, @types/node 26.6.6. Vitest 2 funciona con Vite 5 sin ajustes.

### Desviaciones respecto del diseño

- **Tests de arquitectura en entorno `node`** (`// @vitest-environment node`): jsdom reemplaza `URL` y rompe `fileURLToPath`; `src/test/setup.ts` no toca el DOM si no existe `window`.
- **`Request` sin señal en el setup de tests** (`src/test/setup.ts`): el `Request` de Node rechaza el `AbortSignal` de jsdom que react-router crea en cada navegación del data router. Se descarta la señal solo en tests.
- **`uiStore` con almacenamiento propio y `merge`**: `createJSONStorage` por defecto no atrapa `setItem` que lanza, y rehidrataba `sidebarOpen` si venía guardado; se agregó un `StateStorage` con try/catch y un `merge` que solo toma `sidebarCollapsed` (ambos casos los detectaron tests en rojo).
- **`CSS del shell` se importa desde `src/app/styles/index.css`** (`@import`), no desde el componente: Tailwind 3 exige que `@layer` esté en un archivo con las directivas `@tailwind`. Un test (`tests/architecture/styles-compile.test.ts`, con `postcss` + `postcss-import` + `tailwindcss`) compila esa hoja sin levantar Vite y verifica reglas del shell y utilidades con `var(--…)`. Se agregó `postcss-import` como devDependency para eso.
- **Nombres accesibles al colapsar**: además de `title`, los enlaces reciben `aria-label` cuando el panel está colapsado (la etiqueta pasa a `display:none`).
- **`aria-label` en cada lista** solo en el grupo con título; las demás listas no lo llevan.
- **Botón «Cerrar sesión»** del pie solo se muestra si `AppShell` recibe `onCerrarSesion` (C-13b lo conecta); sin handler sería un botón muerto. El mockup admin lo muestra siempre.
- **Contador del carrito (`.count`) no se portó** al CSS del shell: lo agrega C-18.
- **`Icon`** acepta `className` opcional (tamaño/color) y usa SVG en línea por nombre (sin sprite `<use>`).
- **`claseBoton`** (`shared/ui`) concentra las clases de botón primario/secundario para 404 y error (DRY).
- **Verificación de `docker compose config`**: con `frontend/.env` ausente el comando falla (esperado, no se crea el `.env` real). Se verificó con una copia temporal del compose que apuntaba `env_file` a `frontend/.env.example` (ya borrada): el diff contra la configuración anterior es solo el servicio `frontend` (puerto 5173, `VITE_API_URL`, volúmenes `/app`, `/app/node_modules` y `design-system` en solo lectura, `depends_on: backend`).
- **No se corrió `vite build` ni el dev server** (regla 13): el pipeline de CSS se comprobó con el test de compilación y la fidelidad visual queda para la fase verify.

### TDD Cycle Evidence

Capa: Unit = función pura / store; Integration = componente + router en jsdom; Arquitectura = test sobre archivos. «Safety net» N/A: todo el código es nuevo (backend sin cambios, `git diff --stat backend/` vacío).

| Tarea | Archivo de test | Capa | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|-------|-----------------|------|------------|-----|-------|-------------|----------|
| 1.1-1.4 | `src/test/*` (setup, viewport) | Infra | N/A | Lint: `const x: any` hizo fallar `npm run lint` antes de borrarlo | Smoke `1 + 1` pasó (se borró al existir tests reales) | — | — |
| 2.1-2.2 | `tests/architecture/fsd-boundaries.test.ts` | Arquitectura | N/A | Falló: módulo `./fsd` inexistente | Pasó 1/1 al implementar `violacionesFsd` | 5 casos más (válido, import dinámico no literal, literal, multilínea y profundo en shared, `src/` real); pasaron al primer intento | Estructura ya limpia; sin cambios |
| 2.3-2.4 | `tests/architecture/tailwind-tokens.test.ts` | Arquitectura | N/A | Falló: módulo `./tokens` inexistente | 5/5 al crear `tokens.ts` y `tailwind.config.ts` | Hex, variable inexistente, literal `4px`/`40`, tema anidado y tema real; pasaron al primer intento | Sin cambios |
| 2.5-2.6 | `src/shared/config/__tests__/env.test.ts`, `env-example.test.ts` | Unit | N/A | Falló: `../env` inexistente | 3/3 al crear `readConfig` | `no-es-url`, `ftp://`, https con puerto, claves del `.env.example`; pasaron al primer intento | Sin cambios |
| 3.1-3.3 | `src/app/layouts/app-shell/model/__tests__/navigation.test.ts` | Unit | N/A | Falló: `../navigation` inexistente | 1/1 (anon) | 10 casos por rol/unión/STOCK/COCINA/orden: **8 en rojo** (Catálogo solo era visible para `anon`); se agregó visibilidad `'todos'` y pasaron 11/11 | Navegación referencia `RUTAS`; `index.ts` |
| 3.4-3.5 | `src/app/router/__tests__/route-map.test.ts` | Unit | N/A | Falló: `../route-map` inexistente | 2/2 | Consistencia etiqueta de navegación = título de ruta (3.º caso, pasó al primer intento) | Sin cambios |
| 4.1-4.2 | `src/shared/model/__tests__/ui-store.test.ts` | Unit | N/A | Falló: `../ui-store` inexistente | 4/4 | 4 casos de almacenamiento: **2 en rojo** (`sidebarOpen` rehidratado; `setItem` que lanza); se corrigió con `merge` y `StateStorage` seguro y pasaron 8/8 | Comentarios y selectores |
| 4.3 | `src/shared/lib/media-query/__tests__/use-media-query.test.ts`, `src/shared/ui/icon/__tests__/icon.test.tsx` | Unit | N/A | `useMediaQuery`: falló por módulo inexistente; `Icon` se escribió antes que su test (no hubo RED; el test llegó después y pasó) | 3/3 y 4/4 | 1440→true, 390→false, cruce en ambos sentidos; 20 nombres literales y trazo de `menu` | Se quitó un test débil («deja de escuchar al desmontar») por no probar nada observable |
| 4.4-4.5 | `src/app/layouts/app-shell/__tests__/app-shell.test.tsx` | Integración | N/A | Falló: `../app-shell` inexistente | 3/3 | — | — |
| 4.6-4.7 | idem | Integración | N/A | Los 12 casos nuevos pasaron al primer intento salvo «elegir Ingresar»: falló por el `AbortSignal` de jsdom (infra de tests, ver desviaciones) | 15/15 | Colapso/expansión, preferencia guardada sin `is-ready`, ADMIN + pie, drawer: abrir/foco, Escape, botón, scrim, navegar, pasar a desktop, no persistir, scroll lock, colapso ignorado en mobile | Componentes internos (`Sidebar`, `Topbar`, `NavSections`) ya separados desde el GREEN |
| 4.5 (CSS) | `tests/architecture/styles-compile.test.ts` | Arquitectura | N/A | La utilidad `bg-primary` no salía porque `src/` aún no la usaba: se pasó contenido HTML propio al test | 2/2 | Tokens, reglas del shell, utilidades con `var(--…)` | Sin cambios |
| 5.1-5.2 | `src/app/router/__tests__/routes.test.tsx` | Integración | N/A | Falló: `../routes` inexistente | 4/4 | `/`, `/mis-pedidos`, `/admin/usuarios` sin roles, `data-owner` | Sin cambios |
| 5.3 | `src/app/router/__tests__/not-found.test.tsx` | Integración | N/A | 2/3 en rojo (sin ruta `*`) | 3/3 | `/no-existe`, `/admin/no-existe`, ruta real no es 404 | Sin cambios |
| 5.4 | `src/app/router/__tests__/error-page.test.tsx` | Integración | N/A | 2/2 en rojo (sin `errorElement`) | 2/2 | Error de render sin detalle ni shell; «Reintentar» llama `location.reload` | Sin cambios |
| 5.5 | `src/app/__tests__/app.test.tsx` | Integración | N/A | Falló: `../providers` inexistente | 1/1 | — (un solo escenario de la spec) | — |
| 6.x | Sin test de comportamiento (Dockerfile, compose, README, KB) | Config/docs | N/A | — | `docker compose config` (con la salvedad de arriba) | — | — |

## Verify (2026-11-15)

Veredicto: **PASS WITH FINDINGS**. Gates re-ejecutados: `npm test` 15 archivos / 74 tests verdes; `npm run typecheck` y `npm run lint` sin salida de error; `openspec validate --strict` valido; `git diff --stat backend/` vacio; `git status` sin node_modules/coverage/.env. Mutaciones (3, revertidas y verificadas con cmp): quitar el foco de vuelta a «Abrir menu» (3 tests fallan), quitar el cierre al navegar (1 falla), quitar STOCK de «Productos y stock» (1 falla).

| id | prioridad | area | hallazgo | recomendacion |
|----|-----------|------|----------|---------------|
| V-1 | major | visual | `h1`: peso 400 en la app, 700 en los mockups (preflight de Tailwind resetea font-weight; `@layer base` de index.css solo fija familia y line-height). Afecta Catalogo/placeholder, 404 y error; en mobile el titulo del 404 entra en 1 linea en vez de 2. | fix in this change: `font-weight` de h1..h3 en `src/app/styles/index.css` |
| V-2 | major | visual | `Icon` con `className="h-10 w-10"` no cambia el tamano: `svg.ico{width:22px;height:22px}` (componentes, especificidad 0,1,1) gana a `.h-10` (0,1,0). Iconos de placeholder, 404 y error se ven de 22 px en vez de 40/28 px (medido: svg 22x22 vs 40x40 en mockup). Tests no lo detectan (jsdom sin CSS). | fix in this change: bajar la especificidad de `svg.ico` (p. ej. `:where(svg.ico)`) o mover el tamano base a `@layer base` |
| V-3 | major | docker/docs | `Dockerfile` usa `node:20-alpine` y README dice «Node 20 o superior», pero el lockfile (jsdom 31, jest-dom 7) exige Node 22.22+/24.15+; `npm ci` en 20 da EBADENGINE y `npm test` no corre alli. | fix in this change: base `node:24-alpine` (o 22) y README; opcional `engines` en package.json |
| V-4 | minor | dev | `/favicon.ico` responde 404 (error en consola del navegador en cada carga). | future change (C-25b o nuevo): agregar favicon |
| V-5 | minor | tests | `error-page.test.tsx` llama `vi.unstubAllGlobals()` en afterEach: tambien quita el stub de `Request` de setup.ts para el test siguiente del archivo (hoy pasa, es fragil). Ruido de «React Router Future Flag Warning» en stderr de los tests. | future change (C-13b al tocar el router): flags `future` y stub acotado |
| V-6 | minor | a11y | El drawer no es modal: sin `role="dialog"`/`aria-modal`, sin trampa de foco ni `inert` en el contenido detras del scrim. No exigido por la spec. | future change (C-25b, pulido a11y) |
| V-7 | note | codigo | `RUTAS.raiz` sin uso; `UsuarioShell` no exportado por la API publica de app-shell; titulos duplicados entre `route-map` y `navigation` (guardados por un test de consistencia); `types: ["node"]` global en tsconfig. | future change |
| V-8 | note | tasks | 4.5 menciona un componente `Scrim`: es un div en AppShell (sin impacto). Desviaciones declaradas (contador de carrito, «Cerrar sesion» condicional, Request sin signal, tests en entorno node) aceptables. | — |

### Cobertura de la spec (compacta)

- **frontend-foundation**: Capas FSD (ambos escenarios: `fsd-boundaries.test.ts` con fixtures y `src/` real) covered; API publica (profundo: mismo test; existencia de `index.ts` por slice no se prueba) partially; TS estricto/sin any: typecheck + lint covered; tokens (mapeo: `tailwind-tokens.test.ts`, compilacion: `styles-compile.test.ts`; cambio de token verificado en el navegador: fondo = `--color-bg`) covered; readConfig presente/ausente/vacia/invalida: `env.test.ts` covered; plantilla y raiz sin VITE: `env-example.test.ts` covered (raiz: archivo sin cambios segun git); suite sin backend covered; Compose: sin test, verificado por lectura del diff (solo agrega `frontend`) covered.
- **frontend-app-shell**: panel y aria-current, secciones por rol/union/STOCK (`navigation.test.ts`, `app-shell.test.tsx`), shell sin sesion y con roles, colapso (+ persistencia sin `is-ready` y almacenamiento que falla: `ui-store.test.ts`), drawer (abrir/foco, Escape, boton, scrim, navegar, pasar a desktop, no persistir), mapa de rutas, rutas sin guard, 404 y error (+ Reintentar): todos covered. Apariencia desktop/mobile: verificada visualmente (ver abajo).

### Verificacion visual (dev server con VITE_API_URL en el entorno, Edge headless via CDP; servidor detenido)

| Pantalla | Viewport | Estado | Resultado |
|----------|----------|--------|-----------|
| shell sin sesion expandido | 1440x900 | checked | Panel 264 px, items/separador/logo/boton iguales al mockup; diferencias V-1 y V-2 |
| shell sin sesion colapsado | 1440x900 | checked | Panel 72 px, solo iconos; persiste tras recargar y arranca sin transicion; V-1/V-2 |
| shell sin sesion cerrado | 390x844 | checked | Topbar con menu y logo, sin desborde (scrollWidth 390), panel `visibility:hidden`; V-1/V-2 |
| shell sin sesion drawer | 390x844 | checked | Drawer 264 px sobre scrim, foco en «Cerrar menu», Escape cierra y devuelve foco a «Abrir menu» |
| 404 | 1440x900 y 390x844 | checked | Estructura igual; V-1 (titulo) y V-2 (brujula 22 px) |
| error | ambos | unchecked | No alcanzable sin cambiar codigo; revisado solo por lectura (mismos V-1/V-2: `h-7 w-7`) |
| shell ADMIN (3 capturas) | — | unchecked by design | Sin auth hasta C-13b; cubierto por tests |

Consola: sin errores de la app; avisos: favicon 404 (V-4) y React Router future flag (V-5). Capturas en `mockups/verify/`.

### Correcciones posteriores al verify (2026-11-15, orquestador)

Se corrigieron en este change las tres de prioridad major, con test primero donde hay comportamiento verificable:

| id | corrección | test | RED | GREEN |
|----|-----------|------|-----|-------|
| V-1 | `font-weight: 700` para `h1..h3` en `src/app/styles/index.css` (`@layer base`) | `tests/architecture/styles-compile.test.ts` «los títulos conservan el peso…» | falló (sin `font-weight`) | pasa |
| V-2 | `svg.ico` → `:where(svg.ico)` (especificidad 0) para que `h-10 w-10` / `h-7 w-7` redimensionen | mismo archivo, «el tamaño base del ícono no le gana…» | falló | pasa |
| V-3 | `frontend/Dockerfile` a `node:24-alpine`, README con la versión real de Node y `engines.node >=22.22` en `package.json` | sin test (configuración) | — | — |

Gate después de las correcciones: `npm test` 15 archivos / 76 tests verdes; `npm run typecheck` y `npm run lint` sin errores; `git diff --stat backend/` vacío.

Re-verificación visual (servidor de desarrollo levantado solo para esto y detenido; puerto 5173 libre): `mockups/verify/post-fix-shell-anon-desktop-expanded.png` y `mockups/verify/post-fix-not-found-mobile.png`. Los títulos salen en negrita y los íconos de la página provisoria y del 404 toman el tamaño pedido. Diferencia menor que queda: el título del 404 en mobile entra en una línea y en el mockup ocupa dos (tamaño de fuente algo menor en la app). No se re-capturaron el resto de las pantallas ni la página de error (no alcanzable sin tocar código); la variante ADMIN sigue sin verificación visual hasta C-13b.

Derivado a changes futuros (anotado en `CHANGES.md`): V-5 y la limpieza de `RUTAS.raiz`/`UsuarioShell` → C-13b; contador del carrito en el panel → C-18; V-4 (favicon), V-6 (accesibilidad del drawer), test de `index.ts` por slice, tamaño del título del 404, escala por defecto de Tailwind aún disponible (`h-10` = `2.5rem` literal) y los íconos nuevos del sprite del design system → C-25b. OQ-2 (`STOCK`) y la revisión de los mockups quedan pendientes del usuario.
