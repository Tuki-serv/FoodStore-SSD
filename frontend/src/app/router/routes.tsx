import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ShellConSesion } from '@/app/layouts/app-shell';
import { ErrorPage } from '@/pages/error';
import { NotFoundPage } from '@/pages/not-found';
import { PlaceholderPage } from '@/pages/placeholder';
import { ACCESO_RUTAS, RUTAS } from '@/shared/config';
import { FUTURO_ROUTER } from './future';
import { RequiereAcceso } from './requiere-acceso';
import { MAPA_RUTAS } from './route-map';

/**
 * Árbol de rutas único: lo usa la app (`router`) y los tests (con `createMemoryRouter`).
 * Todo cuelga de un layout con el shell; las rutas sin pantalla usan la página provisoria de su dueño.
 * Cada ruta del mapa se envuelve en `RequiereAcceso` según la tabla `ACCESO_RUTAS`.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <ShellConSesion />,
        children: [
          { index: true, element: <Navigate to={RUTAS.catalogo} replace /> },
          ...MAPA_RUTAS.map(({ path, title, owner }) => ({
            path,
            element: (
              <RequiereAcceso acceso={ACCESO_RUTAS[path]}>
                <PlaceholderPage title={title} owner={owner} />
              </RequiereAcceso>
            ),
          })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { future: FUTURO_ROUTER });
