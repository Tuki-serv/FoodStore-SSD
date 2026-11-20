import { crearEstadoUsuarios, handlersUsuarios, type EstadoUsuarios } from './msw/usuarios';
import { server } from './msw/server';
import { renderApp } from './render-app';

/** Renderiza una ruta de administración de usuarios como un usuario con los roles dados, con la red de `/admin/usuarios` simulada. */
export function montarUsuarios(ruta: string, { roles = ['ADMIN', 'CLIENT'], estado = crearEstadoUsuarios() }: { roles?: string[]; estado?: EstadoUsuarios } = {}) {
  server.use(...handlersUsuarios(estado));
  const app = renderApp(ruta, { sesion: { roles } });
  return { estado, ...app };
}
