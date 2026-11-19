import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearEstadoAdminProductos, handlersAdminProductos, pedidosProductos } from '@/test/msw/admin-productos';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import {
  productoGestionQueries,
  useCrearProducto,
  useEditarProducto,
  useEliminarProducto,
  useFijarDisponibilidad,
  useFijarStock,
} from '../index';

const FILTROS = { page: 1, size: 20 };

/** Monta la lista de gestión y la mutación bajo el mismo cliente, con una consulta pública de productos cacheada para ver su invalidación. */
function montar<T>(usarMutacion: () => T) {
  const estado = crearEstadoAdminProductos();
  server.use(...handlersAdminProductos(estado));
  const cliente = crearQueryClientDePrueba();
  cliente.setQueryData(['productos', 'lista', { page: 1 }], { items: [] });
  const hook = renderHook(() => ({ lista: useQuery(productoGestionQueries.lista(FILTROS)), mutacion: usarMutacion() }), {
    wrapper: envolverConQuery(cliente),
  });
  return { estado, cliente, ...hook };
}

const publicaInvalidada = (cliente: ReturnType<typeof montar>['cliente']): boolean | undefined =>
  cliente.getQueryState(['productos', 'lista', { page: 1 }])?.isInvalidated;

const DATOS = {
  nombre: 'Burger Doble',
  descripcion: null,
  precio_base: '2500.00',
  stock_cantidad: 10,
  disponible: true,
  categoria_ids: [1],
  ingredientes: [{ ingrediente_id: 8, cantidad: '2', unidad_medida_id: 5, es_removible: true }],
};

describe('mutaciones de gestión de productos', () => {
  it('useFijarStock envía {"stock_cantidad":12} y escribe la respuesta en la lista cacheada sin esperar al refetch', async () => {
    const { estado, cliente, result } = montar(useFijarStock);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 3, stock: 12 }));

    expect(pedidosProductos(estado, 'PATCH', '/productos/3/stock')[0]?.cuerpo).toEqual({ stock_cantidad: 12 });
    await waitFor(() => expect(result.current.lista.data?.items.find((p) => p.id === 3)?.stock_cantidad).toBe(12));
    expect(publicaInvalidada(cliente)).toBe(true);
  });

  it('useFijarStock deja la disponibilidad como estaba (independientes)', async () => {
    const { result } = montar(useFijarStock);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 6, stock: 8 }));

    await waitFor(() => expect(result.current.lista.data?.items.find((p) => p.id === 6)).toMatchObject({ stock_cantidad: 8, disponible: false }));
  });

  it('useFijarDisponibilidad envía {"disponible":false} y refleja el valor devuelto', async () => {
    const { estado, cliente, result } = montar(useFijarDisponibilidad);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 5, disponible: false }));

    expect(pedidosProductos(estado, 'PATCH', '/productos/5/disponibilidad')[0]?.cuerpo).toEqual({ disponible: false });
    await waitFor(() => expect(result.current.lista.data?.items.find((p) => p.id === 5)).toMatchObject({ disponible: false, stock_cantidad: 100 }));
    expect(publicaInvalidada(cliente)).toBe(true);
  });

  it('useCrearProducto envía POST /productos/ con el cuerpo exacto e invalida gestión y catálogo', async () => {
    const { estado, cliente, result } = montar(useCrearProducto);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    const creado = await act(() => result.current.mutacion.mutateAsync(DATOS));

    expect(creado).toMatchObject({ id: 7, nombre: 'Burger Doble' });
    expect(pedidosProductos(estado, 'POST', '/productos/')[0]?.cuerpo).toEqual(DATOS);
    await waitFor(() => expect(result.current.lista.data?.items.map((p) => p.nombre)).toContain('Burger Doble'));
    expect(publicaInvalidada(cliente)).toBe(true);
  });

  it('useEditarProducto envía PUT /productos/1 solo con lo pasado', async () => {
    const { estado, cliente, result } = montar(useEditarProducto);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 1, cambios: { precio_base: '1900.00' } }));

    expect(pedidosProductos(estado, 'PUT', '/productos/1')[0]?.cuerpo).toEqual({ precio_base: '1900.00' });
    await waitFor(() => expect(result.current.lista.data?.items.find((p) => p.id === 1)?.precio_base).toBe('1900.00'));
    expect(publicaInvalidada(cliente)).toBe(true);
  });

  it('useEliminarProducto envía DELETE y el producto sale de la lista', async () => {
    const { estado, cliente, result } = montar(useEliminarProducto);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(6));

    expect(pedidosProductos(estado, 'DELETE', '/productos/6')).toHaveLength(1);
    await waitFor(() => expect(result.current.lista.data?.items.map((p) => p.nombre)).not.toContain('Limonada Natural'));
    expect(publicaInvalidada(cliente)).toBe(true);
  });

  it('un fallo no escribe en la caché ni invalida: la lista conserva el valor del servidor', async () => {
    const { cliente, result } = montar(useFijarStock);
    server.use(http.patch(`${API}/productos/:id/stock`, () => HttpResponse.json({ detail: 'Producto no encontrado', code: 'HTTP_404', field: null }, { status: 404 })));
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(async () => {
      await expect(result.current.mutacion.mutateAsync({ id: 3, stock: 12 })).rejects.toMatchObject({ status: 404 });
    });

    expect(result.current.lista.data?.items.find((p) => p.id === 3)?.stock_cantidad).toBe(20);
    expect(publicaInvalidada(cliente)).toBe(false);
  });
});
