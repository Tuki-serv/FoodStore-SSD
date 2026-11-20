import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { esApiError, esConsultaPrivada } from '@/shared/api';
import { respuestaError } from '@/test/msw/admin-catalogo';
import { crearEstadoUsuarios, handlersUsuarios, pedidosUsuarios } from '@/test/msw/usuarios';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { useActualizarUsuario, useCrearUsuario, useDesactivarUsuario, usuarioQueries } from '../index';

function montarEstado() {
  const estado = crearEstadoUsuarios();
  server.use(...handlersUsuarios(estado));
  return estado;
}

function montarMutacion<T>(usarMutacion: () => T) {
  const estado = montarEstado();
  const cliente = crearQueryClientDePrueba();
  const hook = renderHook(() => ({ lista: useQuery(usuarioQueries.lista({ rol: null, page: 1 })), mutacion: usarMutacion() }), {
    wrapper: envolverConQuery(cliente),
  });
  return { estado, cliente, ...hook };
}

describe('usuarioQueries.lista', () => {
  it('con rol y página pide rol_codigo=STOCK&page=2&size=20, sin claves vacías', async () => {
    const estado = montarEstado();
    const { result } = renderHook(() => useQuery(usuarioQueries.lista({ rol: 'STOCK', page: 2 })), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/')[0]?.busqueda).toBe('?rol_codigo=STOCK&page=2&size=20');
  });

  it('sin rol (todos) omite rol_codigo y devuelve el listado con los roles de cada usuario', async () => {
    const estado = montarEstado();
    const { result } = renderHook(() => useQuery(usuarioQueries.lista({ rol: null, page: 1 })), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/')[0]?.busqueda).toBe('?page=1&size=20');
    const carla = result.current.data?.items.find((u) => u.id === 2);
    expect(carla?.roles.map((r) => r.codigo)).toEqual(['PEDIDOS', 'STOCK']);
    expect(result.current.data?.total).toBe(5);
  });

  it('su clave es privada: los datos de usuarios se descartan al cerrar sesión', () => {
    const { queryKey } = usuarioQueries.lista({ rol: 'ADMIN', page: 1 });

    expect(queryKey).toEqual(['usuarios', 'lista', { rol: 'ADMIN', page: 1 }]);
    expect(esConsultaPrivada(queryKey)).toBe(true);
  });
});

describe('mutaciones de usuarios', () => {
  it('useCrearUsuario envía POST /admin/usuarios/createUser con el cuerpo exacto e invalida el listado', async () => {
    const { estado, result } = montarMutacion(useCrearUsuario);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() =>
      result.current.mutacion.mutateAsync({ nombre: 'Carla', apellido: 'Núñez', email: 'carla.n@example.com', celular: null, password: 'claveinicial1', roles_codigos: ['PEDIDOS', 'STOCK'] }),
    );

    expect(pedidosUsuarios(estado, 'POST', '/admin/usuarios/createUser')[0]?.cuerpo).toEqual({
      nombre: 'Carla',
      apellido: 'Núñez',
      email: 'carla.n@example.com',
      celular: null,
      password: 'claveinicial1',
      roles_codigos: ['PEDIDOS', 'STOCK'],
    });
    await waitFor(() => expect(result.current.lista.data?.total).toBe(6));
  });

  it('useActualizarUsuario envía PATCH /admin/usuarios/2 solo con los cambios e invalida el listado', async () => {
    const { estado, result } = montarMutacion(useActualizarUsuario);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 2, cambios: { roles_codigos: ['PEDIDOS'] } }));

    expect(pedidosUsuarios(estado, 'PATCH', '/admin/usuarios/2')[0]?.cuerpo).toEqual({ roles_codigos: ['PEDIDOS'] });
    await waitFor(() => expect(result.current.lista.data?.items.find((u) => u.id === 2)?.roles.map((r) => r.codigo)).toEqual(['PEDIDOS']));
  });

  it('useDesactivarUsuario envía DELETE /admin/usuarios/3 y el usuario sale del listado', async () => {
    const { estado, result } = montarMutacion(useDesactivarUsuario);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(3));

    expect(pedidosUsuarios(estado, 'DELETE', '/admin/usuarios/3')).toHaveLength(1);
    await waitFor(() => expect(result.current.lista.data?.items.some((u) => u.id === 3)).toBe(false));
  });

  it('un 409 de la baja llega como ApiError con su código y no invalida el listado', async () => {
    const { result } = montarMutacion(useDesactivarUsuario);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));
    server.use(http.delete(`${API}/admin/usuarios/:id`, () => respuestaError(409, 'LAST_ADMIN', 'Tiene que quedar al menos un administrador activo.')));

    const fallo = await act(async () => result.current.mutacion.mutateAsync(5).catch((error: unknown) => error));

    expect(esApiError(fallo) && fallo.code).toBe('LAST_ADMIN');
    expect(result.current.lista.data?.items.some((u) => u.id === 5)).toBe(true);
  });
});
