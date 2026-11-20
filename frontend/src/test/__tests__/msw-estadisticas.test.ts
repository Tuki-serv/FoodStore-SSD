import { describe, expect, it } from 'vitest';
import { crearEstadoEstadisticas, crearEstadoSinVentas, handlersEstadisticas, pedidosDe, REPORTES } from '../msw/estadisticas';
import { API, server } from '../msw/server';

async function pedir(reporte: string, busqueda = '?desde=2026-11-01&hasta=2026-11-20'): Promise<Response> {
  return fetch(`${API}/estadisticas/${reporte}${busqueda}`);
}

describe('handlers de estadísticas', () => {
  it('los reportes responden los datos del estado y registran su query string', async () => {
    const estado = crearEstadoEstadisticas();
    server.use(...handlersEstadisticas(estado));

    const resumen = (await (await pedir('resumen')).json()) as { ventas: number };
    const estados = (await (await pedir('pedidos-por-estado')).json()) as unknown[];

    expect(resumen.ventas).toBe(3);
    expect(estados).toHaveLength(6);
    expect(pedidosDe(estado, 'resumen').map((p) => p.busqueda)).toEqual(['?desde=2026-11-01&hasta=2026-11-20']);
    expect(REPORTES).toHaveLength(5);
  });

  it('una falla inyectada de un reporte no afecta a los demás (500 y red caída)', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas['productos-top'] = 500;
    estado.fallas.ingresos = 'red';
    server.use(...handlersEstadisticas(estado));

    expect((await pedir('productos-top')).status).toBe(500);
    await expect(pedir('ingresos')).rejects.toThrow();
    expect((await pedir('ventas')).status).toBe(200);
  });

  it('el estado sin ventas devuelve ceros y ranking vacío', async () => {
    server.use(...handlersEstadisticas(crearEstadoSinVentas()));

    const resumen = (await (await pedir('resumen')).json()) as { ingresos: string };
    const ranking = (await (await pedir('productos-top')).json()) as unknown[];

    expect(resumen.ingresos).toBe('0.00');
    expect(ranking).toEqual([]);
  });
});
