import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { agregarPedidos, crearEstadoPedidos, eventoDto, handlersPedidos, pedidoDto } from '@/test/msw/pedidos';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { pedidoQueries } from '../index';

function montar<T>(usar: () => T, estado = crearEstadoPedidos()) {
  server.use(...handlersPedidos(estado));
  const cliente = crearQueryClientDePrueba();
  const hook = renderHook(usar, { wrapper: envolverConQuery(cliente) });
  return { estado, cliente, ...hook };
}

describe('pedidoQueries.lista', () => {
  it('pide la página y el estado sin claves vacías', async () => {
    const estado = crearEstadoPedidos();
    const { result } = montar(() => useQuery(pedidoQueries.lista({ estado: 'EN_PREP', page: 2, size: 20 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasLista).toEqual([{ estado: 'EN_PREP', page: '2', size: '20' }]);
  });

  it('envía las fechas cuando se eligieron y nada más', async () => {
    const estado = crearEstadoPedidos();
    const { result } = montar(() => useQuery(pedidoQueries.lista({ desde: '2026-11-18', hasta: '2026-11-19', page: 1, size: 20 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasLista).toEqual([{ desde: '2026-11-18', hasta: '2026-11-19', page: '1', size: '20' }]);
  });

  it('devuelve los pedidos del servidor, el más nuevo primero', async () => {
    const estado = crearEstadoPedidos();
    agregarPedidos(estado, [
      pedidoDto({ id: 57, created_at: '2026-11-19T10:00:00Z' }),
      pedidoDto({ id: 58, created_at: '2026-11-19T11:00:00Z' }),
    ]);
    const { result } = montar(() => useQuery(pedidoQueries.lista({ page: 1, size: 20 })), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items.map((pedido) => pedido.id)).toEqual([58, 57]);
    expect(result.current.data?.total).toBe(2);
  });

  it('cuelga de la clave pedidos para que invalidar el dominio la alcance', () => {
    expect(pedidoQueries.lista({ page: 1, size: 20 }).queryKey.slice(0, 2)).toEqual(['pedidos', 'lista']);
  });
});

describe('pedidoQueries.historial', () => {
  it('trae las filas del historial del pedido con el nombre del autor', async () => {
    const estado = crearEstadoPedidos();
    agregarPedidos(estado, [pedidoDto({ id: 58 })], {
      58: [
        eventoDto({ id: 1, pedido_id: 58, estado_hacia: 'PENDIENTE' }),
        eventoDto({ id: 2, pedido_id: 58, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', usuario_nombre: 'Carla' }),
      ],
    });
    const { result } = montar(() => useQuery(pedidoQueries.historial(58)), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultasHistorial).toEqual([58]);
    expect(result.current.data?.map((evento) => [evento.estado_hacia, evento.usuario_nombre])).toEqual([
      ['PENDIENTE', 'Ana Gómez'],
      ['CONFIRMADO', 'Carla'],
    ]);
  });

  it('un pedido inexistente falla con 404', async () => {
    const { result } = montar(() => useQuery(pedidoQueries.historial(999)));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.status).toBe(404);
  });
});
