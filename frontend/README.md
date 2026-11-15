# Food Store — Frontend

React 18 + TypeScript 5 (`strict`, sin `any`) + Vite 5 + Tailwind CSS 3 + Zustand 4 + react-router-dom 6. Tests con Vitest y React Testing Library. Organizado en Feature-Sliced Design (FSD).

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

`src/` usa las capas de FSD v2.1: `app`, `pages` y `shared`. `entities`, `features` y `widgets` se crean cuando un change tenga dos consumidores reales. Un módulo solo importa de capas inferiores, nunca de otro slice de su misma capa, y entre capas solo por la API pública (`index.ts`) del slice o segmento. Alias: `@/` apunta a `src/`; `@design-system/` apunta a `../design-system/`.

```text
src/
  app/        providers/, router/ (rutas y mapa de rutas con dueño), layouts/app-shell/ (panel lateral), styles/
  pages/      un slice por pantalla: placeholder/, not-found/, error/ (las de negocio llegan en C-14 y siguientes)
  shared/     config/ (env, roles, rutas, marca), model/ (uiStore), lib/ (useMediaQuery), ui/ (Icon, botones)
  test/       setup de Vitest y matchMedia controlable (no es una capa de la app)
tests/architecture/   fronteras FSD y tokens de Tailwind (corren con `npm test`)
```

| `[INT]` (spec) | FSD en este repo |
|----------------|------------------|
| `app/` (providers, router, estilos) | `src/app/` (`providers/`, `router/`, `layouts/app-shell/`, `styles/`) |
| `pages/` | `src/pages/<slice>/` (uno por ruta) |
| `features/` | `src/features/<slice>/` (desde C-14) |
| `components/` | `src/shared/ui/` |
| `hooks/` | segmentos `api/` y `model/` de cada slice |
| `store/` (4 stores) | `uiStore` en `src/shared/model/`; `authStore` en C-13b; `cartStore` en C-18; `paymentStore` en C-20 |
| `api/` | `src/shared/api/` (C-13b) |
| `types/` | segmento `model/` del slice; contratos HTTP en `shared/api` |

## Tokens y estilos

La fuente visual es `design-system/tokens.css` (Revision 2): se importa tal cual desde `src/app/styles/index.css`, sin copiarlo. El tema de Tailwind (`tailwind.config.ts`) solo referencia esas variables con `var(--…)`; un test (`tests/architecture/tailwind-tokens.test.ts`) falla si aparece un valor literal o una variable inexistente. Para cambiar un color o espaciado, se edita `design-system/tokens.css`.

El CSS del panel lateral (`src/app/layouts/app-shell/app-shell.css`) es el aprobado en `design-system/components.html`. Las páginas usan utilidades de Tailwind.

## Tests

`npm test` ejecuta tests de componentes en jsdom (por lo que el usuario ve y hace: roles accesibles, texto, interacción) y los tests de arquitectura. jsdom no evalúa CSS ni media queries: el comportamiento desktop/mobile se prueba con un `matchMedia` simulado (`setViewport(ancho)` en `src/test/viewport.ts`); la apariencia se verifica contra los mockups.

## Estado actual

- La app muestra el panel lateral en su variante «sin sesión» (Catálogo, Ingresar, Registrarse) y páginas provisorias por ruta. El shell ya recibe los roles como entrada (`roles`), y la navegación de todos los roles está implementada como datos; la sesión llega en C-13b.
- **Las rutas no tienen guards hasta C-13b**: todas son alcanzables por URL, y las páginas provisorias no piden ni muestran datos del backend.
- Cada ruta declara en `src/app/router/route-map.ts` el change que implementa su pantalla (`owner`).
