import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esApiError, esConsultaPrivada } from '@/shared/api';
import { crearEstadoEstadisticas, handlersEstadisticas, pedidosDe } from '@/test/msw/estadisticas';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { estadisticaQueries } from '../index';

const RANGO = { desde: '2026-11-01', hasta: '2026-11-20' };

function montar() {
  const estado = crearEstadoEstadisticas();
  server.use(...handlersEstadisticas(estado));
  return estado;
}

describe('estadisticaQueries: pedidos al backend', () => {
  it('resumen, estados e ingresos piden solo ?desde=…&hasta=…', async () => {
    const estado = montar();
    const cliente = crearQueryClientDePrueba();
    const { result } = renderHook(
      () => ({
        resumen: useQuery(estadisticaQueries.resumen(RANGO)),
        estados: useQuery(estadisticaQueries.pedidosPorEstado(RANGO)),
        ingresos: useQuery(estadisticaQueries.ingresos(RANGO)),
      }),
      { wrapper: envolverConQuery(cliente) },
    );
    await waitFor(() => expect(result.current.ingresos.isSuccess && result.current.estados.isSuccess && result.current.resumen.isSuccess).toBe(true));

    expect(pedidosDe(estado, 'resumen')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-20');
    expect(pedidosDe(estado, 'pedidos-por-estado')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-20');
    expect(pedidosDe(estado, 'ingresos')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-20');
    expect(result.current.resumen.data?.ticket_promedio).toBe('1500.00');
  });

  it('la serie agrega la agrupación y el ranking pide limit=5', async () => {
    const estado = montar();
    const cliente = crearQueryClientDePrueba();
    const { result } = renderHook(
      () => ({
        ventas: useQuery(estadisticaQueries.ventas(RANGO, 'week')),
        top: useQuery(estadisticaQueries.productosTop(RANGO)),
      }),
      { wrapper: envolverConQuery(cliente) },
    );
    await waitFor(() => expect(result.current.ventas.isSuccess && result.current.top.isSuccess).toBe(true));

    expect(pedidosDe(estado, 'ventas')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-20&agrupacion=week');
    expect(pedidosDe(estado, 'productos-top')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-20&limit=5');
    expect(result.current.top.data?.[0]?.nombre).toBe('Empanada de carne');
  });

  it('un 500 se propaga como ApiError con su status', async () => {
    const estado = montar();
    estado.fallas['productos-top'] = 500;
    const { result } = renderHook(() => useQuery(estadisticaQueries.productosTop(RANGO)), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(esApiError(result.current.error)).toBe(true);
    expect(esApiError(result.current.error) && result.current.error.status).toBe(500);
  });
});

describe('estadisticaQueries: claves', () => {
  it('llevan el reporte y los parámetros bajo `estadisticas`, y son privadas de la sesión', () => {
    expect(estadisticaQueries.resumen(RANGO).queryKey).toEqual(['estadisticas', 'resumen', RANGO]);
    const claveVentas = estadisticaQueries.ventas(RANGO, 'month').queryKey;
    expect(claveVentas).toEqual(['estadisticas', 'ventas', { ...RANGO, agrupacion: 'month' }]);
    expect(esConsultaPrivada(claveVentas)).toBe(true);
  });

  it('rangos o agrupaciones distintas tienen claves distintas (cada período se cachea aparte)', () => {
    const otro = { desde: '2026-10-01', hasta: '2026-10-31' };

    expect(estadisticaQueries.ingresos(RANGO).queryKey).not.toEqual(estadisticaQueries.ingresos(otro).queryKey);
    expect(estadisticaQueries.ventas(RANGO, 'day').queryKey).not.toEqual(estadisticaQueries.ventas(RANGO, 'week').queryKey);
  });
});
