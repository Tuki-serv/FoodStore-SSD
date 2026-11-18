import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, pedidosAdmin } from '@/test/msw/admin-catalogo';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { categoriaQueries, useCrearCategoria, useEditarCategoria, useEliminarCategoria } from '../index';

/** Monta el árbol y la mutación bajo el mismo QueryClient, con una consulta de productos cacheada para ver su invalidación. */
function montar<T>(usarMutacion: () => T) {
  const estado = crearEstadoAdminCatalogo();
  server.use(...handlersAdminCatalogo(estado));
  const cliente = crearQueryClientDePrueba();
  cliente.setQueryData(['productos', 'lista', { page: 1 }], { items: [] });
  const hook = renderHook(() => ({ arbol: useQuery(categoriaQueries.arbol()), mutacion: usarMutacion() }), { wrapper: envolverConQuery(cliente) });
  return { estado, cliente, ...hook };
}

const productosInvalidados = (cliente: ReturnType<typeof montar>['cliente']): boolean | undefined =>
  cliente.getQueryState(['productos', 'lista', { page: 1 }])?.isInvalidated;

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

describe('mutaciones de categorías', () => {
  it('useCrearCategoria envía POST /categorias/ con el cuerpo exacto e invalida categorías y productos', async () => {
    const { estado, cliente, result } = montar(useCrearCategoria);
    await waitFor(() => expect(result.current.arbol.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ nombre: 'Aguas', parent_id: 2, descripcion: null, imagen_url: '' }));

    expect(pedidosAdmin(estado, 'POST', '/categorias/')[0]?.cuerpo).toEqual({ nombre: 'Aguas', parent_id: 2, descripcion: null, imagen_url: '' });
    await waitFor(() => expect(pedidosAdmin(estado, 'GET', '/categorias/arbol')).toHaveLength(2));
    await waitFor(() => expect(result.current.arbol.data?.[0]?.subcategorias.map((c) => c.nombre)).toEqual(['Aguas', 'Gaseosas']));
    expect(productosInvalidados(cliente)).toBe(true);
  });

  it('useEditarCategoria envía PATCH /categorias/4 solo con lo pasado y refresca el árbol', async () => {
    const { estado, cliente, result } = montar(useEditarCategoria);
    await waitFor(() => expect(result.current.arbol.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 4, cambios: { nombre: 'Plant based' } }));

    expect(pedidosAdmin(estado, 'PATCH', '/categorias/4')[0]?.cuerpo).toEqual({ nombre: 'Plant based' });
    await waitFor(() => expect(result.current.arbol.data?.[1]?.subcategorias.map((c) => c.nombre)).toEqual(['Plant based', 'Sin TACC']));
    expect(productosInvalidados(cliente)).toBe(true);
  });

  it('useEliminarCategoria envía DELETE /categorias/3 y el árbol ya no la incluye', async () => {
    const { estado, cliente, result } = montar(useEliminarCategoria);
    await waitFor(() => expect(result.current.arbol.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(3));

    expect(pedidosAdmin(estado, 'DELETE', '/categorias/3')).toHaveLength(1);
    await waitFor(() => expect(result.current.arbol.data?.map((c) => c.nombre)).toEqual(['Bebidas', 'Hamburguesas']));
    expect(productosInvalidados(cliente)).toBe(true);
  });

  it('un 409 CATEGORY_HAS_PRODUCTS llega como ApiError con ese code y no invalida productos', async () => {
    const { estado, cliente, result } = montar(useEliminarCategoria);
    estado.categoriasConProductos.add(6);
    await waitFor(() => expect(result.current.arbol.isSuccess).toBe(true));

    const error = await rechazo(() => result.current.mutacion.mutateAsync(6));

    expect(error).toMatchObject({ name: 'ApiError', status: 409, code: 'CATEGORY_HAS_PRODUCTS' });
    expect(productosInvalidados(cliente)).toBe(false);
    expect(result.current.arbol.data?.[0]?.subcategorias.map((c) => c.nombre)).toEqual(['Gaseosas']);
  });

  it('un 409 DUPLICATE_VALUE al crear llega con field nombre', async () => {
    const { result } = montar(useCrearCategoria);

    const error = await rechazo(() => result.current.mutacion.mutateAsync({ nombre: 'Postres', parent_id: null, descripcion: null, imagen_url: '' }));

    expect(error).toMatchObject({ status: 409, code: 'DUPLICATE_VALUE', field: 'nombre' });
  });
});
