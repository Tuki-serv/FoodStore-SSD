import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearEstadoDirecciones, direccionDto, handlersDirecciones, pedidosDe } from '@/test/msw/direcciones';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import {
  direccionQueries,
  useActualizarDireccion,
  useCrearDireccion,
  useEliminarDireccion,
  useMarcarPrincipal,
  type DireccionDatos,
} from '../index';

const casa = direccionDto({ id: 1, alias: 'Casa', es_principal: true });
const trabajo = direccionDto({ id: 2, alias: 'Trabajo', linea1: 'Belgrano 455' });
const datos: DireccionDatos = { alias: 'Oficina', linea1: 'Calle 9', linea2: null, ciudad: 'Godoy Cruz', provincia: null, codigo_postal: null };

/** Monta la lista y la mutación bajo el mismo QueryClient. */
function montar<T>(usarMutacion: () => T, estado = crearEstadoDirecciones([casa, trabajo])) {
  server.use(...handlersDirecciones(estado));
  const hook = renderHook(
    () => ({ lista: useQuery(direccionQueries.lista({ page: 1, size: 20 })), mutacion: usarMutacion() }),
    { wrapper: envolverConQuery(crearQueryClientDePrueba()) },
  );
  return { estado, ...hook };
}

/** Error con el que rechaza una operación asíncrona (dentro de `act`). */
async function rechazo(operacion: () => Promise<unknown>): Promise<unknown> {
  return act(async () => {
    try {
      await operacion();
    } catch (error) {
      return error;
    }
    return undefined;
  });
}

describe('mutaciones de direcciones', () => {
  it('useCrearDireccion envía POST /direcciones/ con el cuerpo exacto y vuelve a pedir el listado', async () => {
    const { estado, result } = montar(useCrearDireccion);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(datos));

    expect(pedidosDe(estado, 'POST', '/')[0]?.cuerpo).toEqual(datos);
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(result.current.lista.data?.items.map((d) => d.alias)).toEqual(['Casa', 'Trabajo', 'Oficina']));
  });

  it('useActualizarDireccion envía PATCH /direcciones/2 con el objeto completo y refresca el listado', async () => {
    const { estado, result } = montar(useActualizarDireccion);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 2, datos }));

    expect(pedidosDe(estado, 'PATCH', '/2')[0]?.cuerpo).toEqual(datos);
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(result.current.lista.data?.items[1]?.ciudad).toBe('Godoy Cruz'));
  });

  it('useMarcarPrincipal envía PATCH /direcciones/2/principal sin cuerpo y el listado queda con Trabajo primero', async () => {
    const { estado, result } = montar(useMarcarPrincipal);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(2));

    expect(pedidosDe(estado, 'PATCH', '/2/principal')).toHaveLength(1);
    expect(pedidosDe(estado, 'PATCH', '/2/principal')[0]?.cuerpo).toBeNull();
    await waitFor(() => expect(result.current.lista.data?.items.map((d) => d.id)).toEqual([2, 1]));
    expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2);
  });

  it('useEliminarDireccion envía DELETE /direcciones/2 y el listado ya no la incluye', async () => {
    const { estado, result } = montar(useEliminarDireccion);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(2));

    expect(pedidosDe(estado, 'DELETE', '/2')).toHaveLength(1);
    await waitFor(() => expect(result.current.lista.data?.items.map((d) => d.id)).toEqual([1]));
  });

  it('useActualizarDireccion sobre un id inexistente rechaza con ApiError HTTP_404 y vuelve a pedir el listado', async () => {
    const { estado, result } = montar(useActualizarDireccion);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    const error = await rechazo(() => result.current.mutacion.mutateAsync({ id: 99, datos }));

    expect(error).toMatchObject({ name: 'ApiError', status: 404, code: 'HTTP_404' });
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
  });

  it('useMarcarPrincipal sobre un id inexistente rechaza con ApiError HTTP_404 y vuelve a pedir el listado', async () => {
    const { estado, result } = montar(useMarcarPrincipal);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    const error = await rechazo(() => result.current.mutacion.mutateAsync(99));

    expect(error).toMatchObject({ name: 'ApiError', status: 404, code: 'HTTP_404' });
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
  });

  it('useEliminarDireccion sobre un id inexistente rechaza con ApiError HTTP_404 y vuelve a pedir el listado', async () => {
    const { estado, result } = montar(useEliminarDireccion);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    const error = await rechazo(() => result.current.mutacion.mutateAsync(99));

    expect(error).toMatchObject({ name: 'ApiError', status: 404, code: 'HTTP_404' });
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
    await waitFor(() => expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2));
  });
});
