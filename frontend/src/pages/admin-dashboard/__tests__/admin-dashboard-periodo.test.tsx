import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearEstadoEstadisticas, pedidosDe, REPORTES } from '@/test/msw/estadisticas';
import { montarDashboard } from '@/test/render-dashboard';

const RANGO_DEFECTO = '?desde=2026-10-22&hasta=2026-11-20';

async function esperarTarjetas() {
  const grupo = await screen.findByRole('group', { name: 'Indicadores del período' });
  await within(grupo).findByText('$ 4.500');
  return grupo;
}

describe('Dashboard: tarjetas KPI', () => {
  it('muestra ventas, ingresos y ticket con el formato de precios, y los pedidos activos con su aclaración', async () => {
    montarDashboard();

    const grupo = await esperarTarjetas();

    expect(within(grupo).getByText('Ventas').nextElementSibling).toHaveTextContent('3');
    expect(within(grupo).getByText('Ingresos').nextElementSibling).toHaveTextContent('$ 4.500');
    expect(within(grupo).getByText('Ticket promedio').nextElementSibling).toHaveTextContent('$ 1.500');
    expect(within(grupo).getByText('Pedidos activos').nextElementSibling).toHaveTextContent('2');
    expect(within(grupo).getByText('ahora, sin importar el período')).toBeInTheDocument();
  });

  it('los importes con centavos los conservan', async () => {
    const estado = crearEstadoEstadisticas();
    estado.resumen = { ventas: 2, ingresos: '1250.50', ticket_promedio: '625.25', pedidos_activos: 0 };
    montarDashboard('/admin/dashboard', { estado });

    const grupo = await screen.findByRole('group', { name: 'Indicadores del período' });

    expect(await within(grupo).findByText('$ 1.250,50')).toBeInTheDocument();
    expect(within(grupo).getByText('$ 625,25')).toBeInTheDocument();
  });

  it('«Pedidos activos» es un enlace a la gestión de pedidos', async () => {
    const { router, usuario } = montarDashboard();
    await esperarTarjetas();

    await usuario.click(screen.getByRole('link', { name: /Pedidos activos/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/gestion-pedidos'));
  });
});

describe('Dashboard: período', () => {
  it('sin parámetros pide los cinco reportes de los últimos 30 días, la serie por día y el ranking de 5', async () => {
    const { estado } = montarDashboard();
    await esperarTarjetas();
    await waitFor(() => expect(new Set(estado.pedidos.map((p) => p.reporte)).size).toBe(5));

    expect(pedidosDe(estado, 'resumen')[0]?.busqueda).toBe(RANGO_DEFECTO);
    expect(pedidosDe(estado, 'ventas')[0]?.busqueda).toBe(`${RANGO_DEFECTO}&agrupacion=day`);
    expect(pedidosDe(estado, 'productos-top')[0]?.busqueda).toBe(`${RANGO_DEFECTO}&limit=5`);
    expect(pedidosDe(estado, 'pedidos-por-estado')[0]?.busqueda).toBe(RANGO_DEFECTO);
    expect(pedidosDe(estado, 'ingresos')[0]?.busqueda).toBe(RANGO_DEFECTO);
    expect(screen.getByRole('button', { name: 'Últimos 30 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Día' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('elegir «Este mes» deja desde y hasta en la URL y vuelve a pedir los cinco reportes con ese rango', async () => {
    const { estado, router, usuario } = montarDashboard();
    await esperarTarjetas();

    await usuario.click(screen.getByRole('button', { name: 'Este mes' }));

    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-01&hasta=2026-11-20'));
    await waitFor(() => {
      for (const reporte of REPORTES) {
        expect(pedidosDe(estado, reporte).some((p) => p.busqueda.startsWith('?desde=2026-11-01&hasta=2026-11-20')), reporte).toBe(true);
      }
    });
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('elegir «Semana» agrega agrupacion=week a la URL y la serie se pide por semana', async () => {
    const { estado, router, usuario } = montarDashboard();
    await esperarTarjetas();

    await usuario.click(screen.getByRole('button', { name: 'Semana' }));

    await waitFor(() => expect(router.state.location.search).toBe('?agrupacion=week'));
    await waitFor(() => expect(pedidosDe(estado, 'ventas').map((p) => p.busqueda)).toContain(`${RANGO_DEFECTO}&agrupacion=week`));
  });

  it('un período en la URL se refleja en las fechas y en la agrupación elegida', async () => {
    const { estado } = montarDashboard('/admin/dashboard?desde=2026-11-01&hasta=2026-11-15&agrupacion=week');
    await esperarTarjetas();

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-15');
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true');
    expect(pedidosDe(estado, 'ventas')[0]?.busqueda).toBe('?desde=2026-11-01&hasta=2026-11-15&agrupacion=week');
  });

  it('parámetros inválidos en la URL se reemplazan por los valores por defecto sin mensaje de error', async () => {
    const { estado } = montarDashboard('/admin/dashboard?desde=2026-02-30&hasta=2026-11-15&agrupacion=year');
    await esperarTarjetas();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Desde')).toHaveValue('2026-10-22');
    expect(pedidosDe(estado, 'ventas')[0]?.busqueda).toBe(`${RANGO_DEFECTO}&agrupacion=day`);
  });

  it('aclara que las fechas son UTC', async () => {
    montarDashboard();
    await esperarTarjetas();

    expect(screen.getByText('Fechas en UTC')).toBeInTheDocument();
  });
});

describe('Dashboard: validación del rango personalizado', () => {
  it('«Desde» posterior a «Hasta» muestra el error junto a las fechas y no pide nada nuevo', async () => {
    const { estado } = montarDashboard('/admin/dashboard?desde=2026-11-18&hasta=2026-11-18');
    await esperarTarjetas();
    const antes = estado.pedidos.length;

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-19' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha "Desde" no puede ser posterior a "Hasta"');
    expect(screen.getByLabelText('Desde')).toHaveAttribute('aria-invalid', 'true');
    expect(estado.pedidos).toHaveLength(antes);
  });

  it('más de un año muestra «El período no puede superar un año» y sigue mostrando el último período válido', async () => {
    const { estado, router } = montarDashboard();
    await esperarTarjetas();
    const antes = estado.pedidos.length;

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-01-01' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('El período no puede superar un año');
    expect(estado.pedidos).toHaveLength(antes);
    expect(router.state.location.search).toBe('');
    expect(screen.getByText('$ 4.500')).toBeInTheDocument();
  });

  it('corregir el rango quita el error y pide el período nuevo', async () => {
    const { estado, router } = montarDashboard();
    await esperarTarjetas();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-01-01' } });
    await screen.findByRole('alert');

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-01&hasta=2026-11-20'));
    await waitFor(() => expect(pedidosDe(estado, 'resumen').map((p) => p.busqueda)).toContain('?desde=2026-11-01&hasta=2026-11-20'));
  });
});
