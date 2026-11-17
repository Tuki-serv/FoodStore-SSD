# Proposal — C-13a `fe-foundation-scaffold`

## Why

El alcance de la entrega incluye el frontend React completo (PA-01 resuelta, DD-19), pero el repo no tiene `frontend/` (DT-24): los 16 changes de Fase 1 que siguen necesitan un proyecto base sobre el cual construir. La rúbrica asigna 10 puntos a «Frontend — Estructura y TypeScript» (feature-sliced sin cross-imports, `strict: true`, sin `any`) y el usuario aprobó el 2026-11-14 que la navegación de **toda** la app sea un panel lateral izquierdo (DD-25, design system Revision 2). C-13a deja ese esqueleto y el shell de navegación aprobado listos, sin depender del backend más allá de C-01, para que C-13b (sesión y datos) y los changes de pantallas solo agreguen piezas.

Observado en el repo (`dev`, 2026-11-15):

- No existe `frontend/`. `docker-compose.yml` (raíz) tiene el comentario `# frontend:  (se agrega en C-13a)`; el `.env.example` de la raíz contiene **exactamente** `POSTGRES_*` y `PGADMIN_*` (lo verifica `backend/tests/unit/test_env_example.py`), así que las variables `VITE_*` no pueden vivir ahí.
- `design-system/` (Revision 2, aprobada) trae `tokens.css` (incluye los tokens del shell: `--sidebar-width`, `--sidebar-width-collapsed`, `--topbar-height`, `--color-overlay`, `--z-*`), `components.html` con el marcado y CSS de referencia del panel (`.shell`, `.sidebar`, `.nav-item`, `.topbar`, `.scrim`, estados `.is-collapsed`, `.drawer-open`, `.is-ready`), un sprite SVG de íconos y `assets/logo.svg` provisional. Su README deja abierto «mapear los tokens al tema de Tailwind (propuesto: sí, en el change de setup del frontend)».
- `.gitignore` de la raíz ignora `dist/` pero **no** `node_modules/`.
- KB/08 lista la estructura `[INT]` (`pages/features/components/hooks/store/api/types`) y el `uiStore` con `sidebarOpen` (no persistido) y `sidebarCollapsed` (persistido); KB/02 da las capas FSD `[DESC]` (`app → pages → widgets → features → entities → shared`).
- DD-25 define las secciones por rol para sin sesión, CLIENT, PEDIDOS y ADMIN, pero no menciona `STOCK` (rol normativo de `[INT]`).

## What Changes

- **Proyecto `frontend/`**: Vite 5 + React 18 + TypeScript 5 (`strict`, sin `any`, verificado por `tsc --noEmit` y ESLint) + Tailwind CSS 3, organizado en capas Feature-Sliced Design (`app`, `pages`, `shared`; el resto de capas aparece cuando un change lo necesite) con un test de fronteras de import.
- **Tokens del design system como única fuente visual**: `design-system/tokens.css` se importa tal cual (alias `@design-system`), el tema de Tailwind se arma con `var(--…)` de esos tokens (sin valores copiados) y un test lo verifica.
- **Configuración**: `VITE_API_URL` obligatoria y explícita (DD-18), leída en un solo módulo que falla nombrando la variable si falta; `frontend/.env.example` versionado.
- **Router** (sin guards): rutas en español para todas las secciones de DD-25; las que pertenecen a changes posteriores renderizan una página provisoria que declara a su change dueño en la configuración; `/` lleva a `/catalogo`; catch-all 404 dentro del shell; página de error genérica para errores de render/ruta.
- **Shell y navegación (DD-25, Revision 2)**: panel lateral izquierdo para toda la app. Desktop (≥ 1024 px): colapsable a solo íconos, preferencia persistida (`uiStore.sidebarCollapsed`), sin animar el estado inicial. Mobile: barra superior con botón de menú, drawer que se cierra con el botón, el scrim, Esc o al navegar, devolviendo el foco. Secciones por rol como **configuración tipada + función pura** probada para cada rol y para combinaciones; en C-13a el shell muestra la variante «sin sesión» porque todavía no hay sesión (la provee C-13b).
- **`uiStore`** (Zustand 4): se crea solo con el estado del panel (`sidebarCollapsed`, `sidebarOpen`); los otros tres stores y el resto de campos de `uiStore` los agregan sus changes dueños.
- **Docker Compose**: servicio `frontend` (servidor de desarrollo de Vite en el puerto 5173) en el `docker-compose.yml` de la raíz, con sus variables en `frontend/.env`; `node_modules/` se agrega al `.gitignore`.
- **Tests** (Vitest + React Testing Library + user-event, jsdom): arranque del shell, rutas básicas, 404, error, secciones por rol, colapso/persistencia, drawer mobile, configuración y tokens.

**Fuera de alcance (con dueño):** cliente Axios e interceptores, `authStore`/`cartStore`/`paymentStore`, provider de TanStack Query, guards por rol, rehidratación con `GET /auth/me` y manejo de errores `{detail, code, field}` (C-13b); contador del carrito y `cartOpen` (C-18); toasts y modal de confirmación (cada change que los use); contenido de cada pantalla (C-14..C-24); rol `COCINA`/KDS (C-26, PA-07); build de producción y deploy (C-25b / bonus).

## Capabilities

### New Capabilities
- `frontend-foundation`: base técnica del frontend — estructura FSD con fronteras de import verificadas, TypeScript estricto sin `any`, tokens del design system como única fuente del tema, configuración por variables `VITE_*` explícitas, herramientas de test y servicio de desarrollo en Docker Compose.
- `frontend-app-shell`: shell de la aplicación — panel lateral (colapsable en desktop, drawer en mobile), secciones de navegación por rol, mapa de rutas con dueños, página 404 y página de error genérica.

### Modified Capabilities
- (ninguna: las capacidades existentes son de backend y su comportamiento no cambia).

## Impact

- **Código nuevo**: `frontend/` completo (configuración de Vite, TypeScript, Tailwind, PostCSS, ESLint, Vitest; `src/app`, `src/pages`, `src/shared`; tests); `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/.env.example`, `frontend/README.md`.
- **Raíz**: `docker-compose.yml` (servicio `frontend` en lugar del comentario); `.gitignore` (`node_modules/`). El `.env.example` de la raíz **no** cambia.
- **Backend**: sin cambios (`CORS_ORIGINS` ya admite `http://localhost:5173`).
- **Dependencias**: react, react-dom, react-router-dom 6, zustand 4; dev: vite 5, @vitejs/plugin-react, typescript 5, tailwindcss 3, postcss, autoprefixer, eslint + typescript-eslint, vitest, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom.
- **Docs (al cerrar)**: KB/08 §Estructura de directorios (estructura real del frontend y mapeo a `[INT]`), KB/09 DT-24 (parcial), KB/09 DD-25 si se acepta OQ-2 (sección de `STOCK`), `design-system/README.md` (TBD de Tailwind resuelto y nuevo punto de reemplazo del nombre), ver OQ en `design.md`.
- **UI**: `[UI-MOCKUP]`: mockups en `mockups/` con aprobación pendiente; apply no empieza sin aprobarlos.
