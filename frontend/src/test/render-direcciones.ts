import { screen } from '@testing-library/react';
import { crearEstadoDirecciones, handlersDirecciones, type DireccionDto } from './msw/direcciones';
import { server } from './msw/server';
import { renderApp } from './render-app';

/** Renderiza `/direcciones` como un CLIENT con la red de direcciones simulada (estado en memoria que replica el backend). */
export function montarDirecciones(iniciales: DireccionDto[], ruta = '/direcciones') {
  const estado = crearEstadoDirecciones(iniciales);
  server.use(...handlersDirecciones(estado));
  const app = renderApp(ruta, { sesion: { roles: ['CLIENT'] } });
  return { estado, ...app };
}

/** Espera a que el título de la página esté (la sesión rehidratada y el shell montados). */
export const esperarPagina = () => screen.findByRole('heading', { name: 'Direcciones', level: 1 });
