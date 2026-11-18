import { screen } from '@testing-library/react';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, type EstadoAdminCatalogo } from './msw/admin-catalogo';
import { server } from './msw/server';
import { renderApp } from './render-app';

/** Renderiza una ruta de administración como un usuario con los roles dados, con la red del catálogo simulada (estado en memoria). */
export function montarAdmin(ruta: string, { roles = ['ADMIN'], estado = crearEstadoAdminCatalogo() }: { roles?: string[]; estado?: EstadoAdminCatalogo } = {}) {
  server.use(...handlersAdminCatalogo(estado));
  const app = renderApp(ruta, { sesion: { roles } });
  return { estado, ...app };
}

/** Espera el título de una página (la sesión rehidratada y el shell montados). */
export const esperarTitulo = (nombre: string) => screen.findByRole('heading', { name: nombre, level: 1 });
