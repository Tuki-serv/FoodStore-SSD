import { screen } from '@testing-library/react';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, type EstadoAdminCatalogo } from './msw/admin-catalogo';
import { crearEstadoAdminProductos, handlersAdminProductos, type EstadoAdminProductos } from './msw/admin-productos';
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

/** Como `montarAdmin`, para `/admin/productos`: red de productos y del catálogo de C-17a simuladas con un único estado en memoria. */
export function montarAdminProductos(
  ruta: string,
  { roles = ['ADMIN'], estado = crearEstadoAdminProductos() }: { roles?: string[]; estado?: EstadoAdminProductos } = {},
) {
  server.use(...handlersAdminProductos(estado));
  const app = renderApp(ruta, { sesion: { roles } });
  return { estado, ...app };
}
