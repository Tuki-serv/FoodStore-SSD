import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, pedidosAdmin } from '@/test/msw/admin-catalogo';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { ingredienteQueries, useCrearIngrediente, useEditarIngrediente, useEliminarIngrediente } from '../index';

function montar<T>(usarMutacion: () => T) {
  const estado = crearEstadoAdminCatalogo();
  server.use(...handlersAdminCatalogo(estado));
  const cliente = crearQueryClientDePrueba();
  cliente.setQueryData(['productos', 'lista', { page: 1 }], { items: [] });
  const hook = renderHook(
    () => ({ lista: useQuery(ingredienteQueries.lista({ page: 1, size: 20, alergeno: null })), mutacion: usarMutacion() }),
    { wrapper: envolverConQuery(cliente) },
  );
  return { estado, cliente, ...hook };
}

describe('ingredienteQueries.lista', () => {
  it('con alergeno true pide page=1&size=20&is_alergeno=true', async () => {
    const estado = crearEstadoAdminCatalogo();
    server.use(...handlersAdminCatalogo(estado));
    const { result } = renderHook(() => useQuery(ingredienteQueries.lista({ page: 1, size: 20, alergeno: true })), {
      wrapper: envolverConQuery(crearQueryClientDePrueba()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pedidosAdmin(estado, 'GET', '/ingredientes/')[0]?.busqueda).toBe('?page=1&size=20&is_alergeno=true');
    expect(result.current.data?.items.map((i) => i.nombre)).toEqual(['Pan Brioche', 'Queso Cheddar', 'Mayonesa']);
  });

  it('con alergeno false pide is_alergeno=false y con null omite el parámetro', async () => {
    const estado = crearEstadoAdminCatalogo();
    server.use(...handlersAdminCatalogo(estado));
    const cliente = crearQueryClientDePrueba();
    const { result } = renderHook(() => useQuery(ingredienteQueries.lista({ page: 2, size: 20, alergeno: false })), { wrapper: envolverConQuery(cliente) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const otro = renderHook(() => useQuery(ingredienteQueries.lista({ page: 1, size: 20, alergeno: null })), { wrapper: envolverConQuery(cliente) });
    await waitFor(() => expect(otro.result.current.isSuccess).toBe(true));

    expect(pedidosAdmin(estado, 'GET', '/ingredientes/').map((p) => p.busqueda)).toEqual(['?page=2&size=20&is_alergeno=false', '?page=1&size=20']);
  });

  it('su clave arranca por el dominio, que es público (sobrevive al cierre de sesión)', () => {
    const { queryKey } = ingredienteQueries.lista({ page: 1, size: 20, alergeno: null });

    expect(queryKey).toEqual(['ingredientes', 'lista', { page: 1, size: 20, alergeno: null }]);
    expect(esConsultaPrivada(queryKey)).toBe(false);
  });
});

describe('mutaciones de ingredientes', () => {
  it('useCrearIngrediente envía POST /ingredientes/ con el cuerpo exacto e invalida ingredientes y productos', async () => {
    const { estado, cliente, result } = montar(useCrearIngrediente);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ nombre: 'Maní', descripcion: null, es_alergeno: true, unidad_medida_id: 2 }));

    expect(pedidosAdmin(estado, 'POST', '/ingredientes/')[0]?.cuerpo).toEqual({ nombre: 'Maní', descripcion: null, es_alergeno: true, unidad_medida_id: 2 });
    await waitFor(() => expect(result.current.lista.data?.total).toBe(13));
    expect(cliente.getQueryState(['productos', 'lista', { page: 1 }])?.isInvalidated).toBe(true);
  });

  it('useEditarIngrediente envía PATCH /ingredientes/12 solo con lo pasado y refresca el listado', async () => {
    const { estado, result } = montar(useEditarIngrediente);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync({ id: 12, cambios: { es_alergeno: false } }));

    expect(pedidosAdmin(estado, 'PATCH', '/ingredientes/12')[0]?.cuerpo).toEqual({ es_alergeno: false });
    await waitFor(() => expect(result.current.lista.data?.items.find((i) => i.id === 12)?.es_alergeno).toBe(false));
  });

  it('useEliminarIngrediente envía DELETE /ingredientes/12 y el listado ya no lo incluye', async () => {
    const { estado, cliente, result } = montar(useEliminarIngrediente);
    await waitFor(() => expect(result.current.lista.isSuccess).toBe(true));

    await act(() => result.current.mutacion.mutateAsync(12));

    expect(pedidosAdmin(estado, 'DELETE', '/ingredientes/12')).toHaveLength(1);
    await waitFor(() => expect(result.current.lista.data?.items.some((i) => i.nombre === 'Mayonesa')).toBe(false));
    expect(cliente.getQueryState(['productos', 'lista', { page: 1 }])?.isInvalidated).toBe(true);
  });
});
