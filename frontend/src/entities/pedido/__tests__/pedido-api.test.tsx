import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { crearEstadoPedidos, handlersPedidos, pedidoDto } from '@/test/msw/pedidos';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { cancelarMiPedido, pedidoQueries, useCrearPedido, type PedidoCrear } from '../index';

const datos: PedidoCrear = {
  direccion_id: 4,
  forma_pago_codigo: 'EFECTIVO',
  items: [
    { producto_id: 1, cantidad: 2, personalizacion: [1, 3] },
    { producto_id: 5, cantidad: 1, personalizacion: [] },
  ],
};

function montar<T>(usar: () => T, estado = crearEstadoPedidos()) {
  server.use(...handlersPedidos(estado));
  const cliente = crearQueryClientDePrueba();
  const hook = renderHook(usar, { wrapper: envolverConQuery(cliente) });
  return { estado, cliente, ...hook };
}

describe('useCrearPedido', () => {
  it('envía POST /pedidos/ con el cuerpo exacto y devuelve el pedido creado', async () => {
    const { estado, result } = montar(useCrearPedido);

    const pedido = await act(() => result.current.mutateAsync(datos));

    expect(estado.creaciones).toEqual([datos]);
    expect(pedido.id).toBe(57);
    expect(pedido.estado_codigo).toBe('PENDIENTE');
  });

  it('siembra pedidoQueries.detalle(57) con la respuesta, sin pedir GET /pedidos/57', async () => {
    const { estado, cliente, result } = montar(useCrearPedido);

    await act(() => result.current.mutateAsync(datos));

    expect(cliente.getQueryData(pedidoQueries.detalle(57).queryKey)?.total).toBe('3850.00');
    expect(estado.consultas).toEqual([]);
  });

  it('invalida el listado [\'pedidos\'] para que C-21 lo vuelva a pedir', async () => {
    const { cliente, result } = montar(useCrearPedido);
    cliente.setQueryData(['pedidos', 'lista'], { items: [] });

    await act(() => result.current.mutateAsync(datos));

    expect(cliente.getQueryState(['pedidos', 'lista'])?.isInvalidated).toBe(true);
  });

  it('el detalle sembrado queda fresco (no invalidado) aunque se invalide el resto de pedidos', async () => {
    const { cliente, result } = montar(useCrearPedido);

    await act(() => result.current.mutateAsync(datos));

    expect(cliente.getQueryState(pedidoQueries.detalle(57).queryKey)?.isInvalidated).toBe(false);
  });

  it('un rechazo 400 llega como ApiError con el detail del servidor', async () => {
    const estado = crearEstadoPedidos({ respuestaCrear: { status: 400, detail: 'No hay stock suficiente' } });
    const { result } = montar(useCrearPedido, estado);

    const error = await act(async () => {
      try {
        await result.current.mutateAsync(datos);
      } catch (e) {
        return e;
      }
      return undefined;
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, detail: 'No hay stock suficiente' });
  });

  it('una red caída llega como ApiError sin status', async () => {
    const { result } = montar(useCrearPedido, crearEstadoPedidos({ respuestaCrear: 'red' }));

    const error = await act(async () => {
      try {
        await result.current.mutateAsync(datos);
      } catch (e) {
        return e;
      }
      return undefined;
    });

    expect(error).toMatchObject({ status: null, code: 'NETWORK_ERROR' });
  });
});

describe('pedidoQueries.detalle', () => {
  it('pide GET /pedidos/57 y tipa la respuesta', async () => {
    const estado = crearEstadoPedidos();
    estado.pedidos.set(57, pedidoDto({ id: 57, total: '4050.00' }));
    const { result } = montar(() => useQuery(pedidoQueries.detalle(57)), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultas).toEqual([57]);
    expect(result.current.data).toMatchObject({ id: 57, total: '4050.00', estado_codigo: 'PENDIENTE' });
  });

  it('un id desconocido es un ApiError 404', async () => {
    const { result } = montar(() => useQuery(pedidoQueries.detalle(999)));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ status: 404, detail: 'Pedido no encontrado' });
  });

  it('cada pedido tiene su propia clave bajo [\'pedidos\']', () => {
    expect(pedidoQueries.detalle(57).queryKey).toEqual(['pedidos', 'detalle', 57]);
    expect(pedidoQueries.detalle(58).queryKey).not.toEqual(pedidoQueries.detalle(57).queryKey);
    expect(pedidoQueries.todas()).toEqual(['pedidos']);
  });
});

describe('pedidoQueries.lista con `propios`', () => {
  it('manda propios=true junto con la página y el tamaño', async () => {
    const estado = crearEstadoPedidos();
    const { result } = montar(() => useQuery(pedidoQueries.lista({ propios: true, page: 2, size: 10 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasLista).toEqual([{ propios: 'true', page: '2', size: '10' }]);
  });

  it('manda también el estado cuando se filtra', async () => {
    const estado = crearEstadoPedidos();
    const { result } = montar(() => useQuery(pedidoQueries.lista({ propios: true, estado: 'ENTREGADO', page: 1, size: 10 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasLista).toEqual([{ propios: 'true', estado: 'ENTREGADO', page: '1', size: '10' }]);
  });

  it('sin propios el parámetro no viaja (la gestión pide todos)', async () => {
    const estado = crearEstadoPedidos();
    const { result } = montar(() => useQuery(pedidoQueries.lista({ page: 1, size: 20 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasLista).toEqual([{ page: '1', size: '20' }]);
  });

  it('la clave de caché distingue el listado propio del de gestión', () => {
    expect(pedidoQueries.lista({ propios: true, page: 1, size: 10 }).queryKey).not.toEqual(pedidoQueries.lista({ page: 1, size: 10 }).queryKey);
  });
});

describe('cancelarMiPedido', () => {
  it('envía DELETE /pedidos/58 con {"motivo"} y devuelve el detalle cancelado', async () => {
    const estado = crearEstadoPedidos();
    estado.pedidos.set(58, pedidoDto({ id: 58, usuario_id: 1 }));
    server.use(...handlersPedidos(estado));

    const detalle = await cancelarMiPedido(58, 'Me equivoqué');

    expect(estado.cancelaciones).toEqual([{ id: 58, cuerpo: { motivo: 'Me equivoqué' } }]);
    expect(detalle).toMatchObject({ id: 58, estado_codigo: 'CANCELADO' });
  });

  it('un pedido que ya está en preparación es un ApiError 409 INVALID_TRANSITION', async () => {
    const estado = crearEstadoPedidos();
    estado.pedidos.set(54, pedidoDto({ id: 54, usuario_id: 1, estado_codigo: 'EN_PREP' }));
    server.use(...handlersPedidos(estado));

    const error = await cancelarMiPedido(54, 'Me arrepentí').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'INVALID_TRANSITION' });
  });
});
