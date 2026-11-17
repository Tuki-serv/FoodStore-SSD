import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from '@/app/layouts/app-shell';
import { ErrorPage } from '@/pages/error';
import { NotFoundPage } from '@/pages/not-found';
import { PlaceholderPage } from '@/pages/placeholder';
import { RUTAS } from '@/shared/config';
import { MAPA_RUTAS } from './route-map';

/**
 * Árbol de rutas único: lo usa la app (`router`) y los tests (con `createMemoryRouter`).
 * Todo cuelga de un layout con el shell; las rutas sin pantalla usan la página provisoria de su dueño.
 * Sin guards hasta C-13b: todas son alcanzables por URL.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to={RUTAS.catalogo} replace /> },
          ...MAPA_RUTAS.map(({ path, title, owner }) => ({
            path,
            element: <PlaceholderPage title={title} owner={owner} />,
          })),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
