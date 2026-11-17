import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { RouterProvider } from 'react-router-dom';
import { SesionGate } from '@/app/providers';
import { routes } from '@/app/router/routes';
import { handlerMe, handlerRefreshOk } from './msw/auth';
import { API, server } from './msw/server';
import { crearQueryClientDePrueba } from './query';
import { crearRouterDePrueba } from './router';

export interface OpcionesApp {
  /** Sesión que recupera la rehidratación (cookie vigente): roles y datos del usuario de `GET /auth/me`. Sin esto: anónimo. */
  sesion?: { roles: readonly string[]; nombre?: string; apellido?: string };
  /** Demora (ms) de `POST /auth/refresh`, para ver la pantalla de carga. */
  demoraRehidratacion?: number;
}

/** Renderiza el árbol real de la app (sesión + router + rutas) en `ruta`, con la red simulada por MSW. */
export function renderApp(ruta: string, { sesion, demoraRehidratacion }: OpcionesApp = {}) {
  if (sesion !== undefined) {
    server.use(
      demoraRehidratacion === undefined
        ? handlerRefreshOk('A1')
        : http.post(`${API}/auth/refresh`, async () => {
            await delay(demoraRehidratacion);
            return HttpResponse.json({ access_token: 'A1', token_type: 'bearer', expires_in: 1800 });
          }),
      handlerMe(sesion.roles, { nombre: sesion.nombre ?? 'Ana', apellido: sesion.apellido ?? 'Gómez' }),
    );
  } else if (demoraRehidratacion !== undefined) {
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        await delay(demoraRehidratacion);
        return HttpResponse.json({ detail: 'Sin sesión', code: 'HTTP_401', field: null }, { status: 401 });
      }),
    );
  }
  const queryClient = crearQueryClientDePrueba();
  const router = crearRouterDePrueba(routes, [ruta]);
  const usuario = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <SesionGate>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </SesionGate>
    </QueryClientProvider>,
  );
  return { router, queryClient, usuario };
}
