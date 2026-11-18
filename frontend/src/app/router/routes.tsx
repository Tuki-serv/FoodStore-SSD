import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { ComponentType } from 'react';
import { ShellConSesion } from '@/app/layouts/app-shell';
import { DireccionesPage } from '@/pages/direcciones';
import { ErrorPage } from '@/pages/error';
import { NotFoundPage } from '@/pages/not-found';
import { PlaceholderPage } from '@/pages/placeholder';
import { ACCESO_RUTAS, RUTAS, type Ruta } from '@/shared/config';
import { FUTURO_ROUTER } from './future';
import { RequiereAcceso } from './requiere-acceso';
import { MAPA_RUTAS } from './route-map';

/** Pantallas reales por ruta: cada change visual agrega su línea; las rutas sin entrada usan `PlaceholderPage`. */
const PAGINAS: Partial<Record<Ruta, ComponentType>> = {
  [RUTAS.direcciones]: DireccionesPage,
};

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
          ...MAPA_RUTAS.map(({ path, title, owner }) => {
            const Pagina = PAGINAS[path];
            return {
              path,
              element: (
                <RequiereAcceso acceso={ACCESO_RUTAS[path]}>
                  {Pagina === undefined ? <PlaceholderPage title={title} owner={owner} /> : <Pagina />}
                </RequiereAcceso>
              ),
            };
          }),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes, { future: FUTURO_ROUTER });
