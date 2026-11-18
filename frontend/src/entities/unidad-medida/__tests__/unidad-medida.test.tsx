import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { crearEstadoAdminCatalogo, handlersAdminCatalogo, pedidosAdmin } from '@/test/msw/admin-catalogo';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { etiquetaUnidad, unidadMedidaQueries } from '../index';

describe('unidadMedidaQueries.todas', () => {
  it('pide size=100 y devuelve las unidades del servidor', async () => {
    const estado = crearEstadoAdminCatalogo();
    server.use(...handlersAdminCatalogo(estado));
    const { result } = renderHook(() => useQuery(unidadMedidaQueries.todas()), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pedidosAdmin(estado, 'GET', '/unidades-medida/')[0]?.busqueda).toBe('?size=100');
    expect(result.current.data).toHaveLength(7);
    expect(result.current.data?.[4]).toEqual({ id: 5, nombre: 'Unidad', simbolo: 'u', tipo: 'unidad' });
  });

  it('su clave es pública y se cachea 30 minutos', () => {
    const opciones = unidadMedidaQueries.todas();

    expect(opciones.queryKey).toEqual(['unidades-medida', 'todas']);
    expect(opciones.staleTime).toBe(1_800_000);
    expect(esConsultaPrivada(opciones.queryKey)).toBe(false);
  });
});

describe('etiquetaUnidad', () => {
  it('une nombre y símbolo', () => {
    expect(etiquetaUnidad({ nombre: 'Gramo', simbolo: 'g' })).toBe('Gramo (g)');
    expect(etiquetaUnidad({ nombre: 'Metro cuadrado', simbolo: 'm²' })).toBe('Metro cuadrado (m²)');
  });
});
