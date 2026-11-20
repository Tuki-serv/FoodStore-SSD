import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoEstadisticas, crearEstadoSinVentas, pedidosDe, REPORTES } from '@/test/msw/estadisticas';
import { montarDashboard } from '@/test/render-dashboard';

const TITULOS = ['Ventas por período', 'Productos más vendidos', 'Pedidos por estado', 'Ingresos por forma de pago'] as const;

describe('Dashboard: error por bloque', () => {
  it('si productos-top responde 500 solo ese bloque muestra el error con «Reintentar» y los demás sus datos', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas['productos-top'] = 500;
    montarDashboard('/admin/dashboard', { estado });

    const productos = await screen.findByRole('region', { name: 'Productos más vendidos' });
    expect(await within(productos).findByRole('alert')).toHaveTextContent('No pudimos cargar este gráfico');
    expect(within(productos).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(within(productos).queryByRole('button', { name: 'Ver como tabla' })).not.toBeInTheDocument();

    for (const titulo of ['Ventas por período', 'Pedidos por estado', 'Ingresos por forma de pago']) {
      const region = await screen.findByRole('region', { name: titulo });
      await waitFor(() => expect(within(region).getByRole('button', { name: 'Ver como tabla' })).toBeInTheDocument());
      expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
    }
    expect(await screen.findByText('$ 4.500')).toBeInTheDocument();
  });

  it('«Reintentar» vuelve a pedir solo el ranking y, con 200, muestra sus datos', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas['productos-top'] = 500;
    const { usuario } = montarDashboard('/admin/dashboard', { estado });
    const productos = await screen.findByRole('region', { name: 'Productos más vendidos' });
    await within(productos).findByRole('alert');
    await screen.findByText('$ 4.500');
    const antes = estado.pedidos.length;
    delete estado.fallas['productos-top'];

    await usuario.click(within(productos).getByRole('button', { name: 'Reintentar' }));

    expect(await within(productos).findByRole('button', { name: 'Ver como tabla' })).toBeInTheDocument();
    expect(within(productos).queryByRole('alert')).not.toBeInTheDocument();
    expect(estado.pedidos.slice(antes).map((pedido) => pedido.reporte)).toEqual(['productos-top']);
  });

  it('un reporte con la red caída también queda en error solo en su bloque', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas.ingresos = 'red';
    montarDashboard('/admin/dashboard', { estado });

    const pagos = await screen.findByRole('region', { name: 'Ingresos por forma de pago' });

    expect(await within(pagos).findByRole('alert')).toHaveTextContent('Los demás gráficos siguen funcionando');
    expect(await screen.findByText('$ 4.500')).toBeInTheDocument();
  });

  it('si falla el resumen las tarjetas muestran su error con «Reintentar» y los gráficos siguen', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas.resumen = 500;
    const { usuario } = montarDashboard('/admin/dashboard', { estado });

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los indicadores' })).toBeInTheDocument();
    const ventas = await screen.findByRole('region', { name: 'Ventas por período' });
    expect(await within(ventas).findByRole('button', { name: 'Ver como tabla' })).toBeInTheDocument();
    delete estado.fallas.resumen;

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('$ 4.500')).toBeInTheDocument();
  });
});

describe('Dashboard: carga y período sin ventas', () => {
  it('mientras llegan los reportes muestra un esqueleto en las tarjetas y en cada gráfico', async () => {
    const estado = crearEstadoEstadisticas();
    for (const reporte of REPORTES) estado.demoras[reporte] = 60;
    montarDashboard('/admin/dashboard', { estado });

    expect(await screen.findByRole('status', { name: 'Cargando indicadores' })).toBeInTheDocument();
    for (const titulo of TITULOS) expect(screen.getByRole('status', { name: `Cargando ${titulo}` })).toBeInTheDocument();

    expect(await screen.findByText('$ 4.500')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument());
  });

  it('un período sin ventas muestra «Sin ventas en este período» en serie, productos y formas de pago, y las tarjetas en 0', async () => {
    montarDashboard('/admin/dashboard', { estado: crearEstadoSinVentas() });

    const grupo = await screen.findByRole('group', { name: 'Indicadores del período' });
    expect(within(grupo).getByText('Ventas').nextElementSibling).toHaveTextContent('0');
    expect(within(grupo).getByText('Ingresos').nextElementSibling).toHaveTextContent('$ 0');
    expect(within(grupo).getByText('Ticket promedio').nextElementSibling).toHaveTextContent('$ 0');
    expect(within(grupo).getByText('Pedidos activos').nextElementSibling).toHaveTextContent('2');
    for (const titulo of ['Ventas por período', 'Productos más vendidos', 'Ingresos por forma de pago']) {
      const region = await screen.findByRole('region', { name: titulo });
      expect(await within(region).findByText('Sin ventas en este período')).toBeInTheDocument();
      expect(within(region).queryByRole('button', { name: 'Ver como tabla' })).not.toBeInTheDocument();
    }
    const estados = await screen.findByRole('region', { name: 'Pedidos por estado' });
    expect(await within(estados).findByText('Sin pedidos en este período')).toBeInTheDocument();
  });

  it('con ventas pero sin pedidos de un reporte, ese bloque se vacía y los demás conservan sus datos', async () => {
    const estado = crearEstadoEstadisticas();
    estado.productosTop = [];
    montarDashboard('/admin/dashboard', { estado });

    const productos = await screen.findByRole('region', { name: 'Productos más vendidos' });

    expect(await within(productos).findByText('Sin ventas en este período')).toBeInTheDocument();
    const ventas = await screen.findByRole('region', { name: 'Ventas por período' });
    expect(await within(ventas).findByRole('button', { name: 'Ver como tabla' })).toBeInTheDocument();
  });

  it('sin violaciones de axe en el estado vacío', async () => {
    montarDashboard('/admin/dashboard', { estado: crearEstadoSinVentas() });
    await screen.findByText('Sin pedidos en este período');
    await screen.findAllByText('Sin ventas en este período');

    await esperarSinViolacionesA11y(document.body);
  });

  it('sin violaciones de axe con un bloque en error', async () => {
    const estado = crearEstadoEstadisticas();
    estado.fallas['productos-top'] = 500;
    montarDashboard('/admin/dashboard', { estado });
    await screen.findByText('No pudimos cargar este gráfico');
    await screen.findByText('$ 4.500');

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('Dashboard: actualización manual', () => {
  it('«Actualizar» vuelve a pedir los cinco reportes, indica que está en curso y la marca cambia al terminar', async () => {
    const { estado, usuario } = montarDashboard();
    await screen.findByText('$ 4.500');
    const marca = await screen.findByText(/^Actualizado a las /);
    const antes = marca.textContent;
    const pedidosAntes = estado.pedidos.length;
    for (const reporte of REPORTES) estado.demoras[reporte] = 80;
    vi.setSystemTime(new Date('2026-11-20T15:07:00Z'));

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByRole('button', { name: 'Actualizando…' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled());
    expect(estado.pedidos.slice(pedidosAntes).map((pedido) => pedido.reporte).sort()).toEqual([...REPORTES].sort());
    expect(screen.getByText(/^Actualizado a las /).textContent).not.toBe(antes);
  });

  it('volver a un período ya visto muestra sus datos de inmediato, sin esqueletos ni nuevos pedidos', async () => {
    const { estado, usuario } = montarDashboard();
    await screen.findByText('$ 4.500');
    await usuario.click(screen.getByRole('button', { name: 'Este mes' }));
    await waitFor(() => expect(pedidosDe(estado, 'resumen')).toHaveLength(2));
    await screen.findByText('$ 4.500');
    const pedidosAntes = estado.pedidos.length;

    await usuario.click(screen.getByRole('button', { name: 'Últimos 30 días' }));

    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument();
    expect(screen.getByText('$ 4.500')).toBeInTheDocument();
    expect(estado.pedidos).toHaveLength(pedidosAntes);
  });

  it('al cambiar a un período nuevo se siguen viendo los datos anteriores mientras llegan los nuevos', async () => {
    const { estado, usuario } = montarDashboard();
    await screen.findByText('$ 4.500');
    for (const reporte of REPORTES) estado.demoras[reporte] = 80;

    await usuario.click(screen.getByRole('button', { name: 'Hoy' }));

    expect(screen.queryByRole('status', { name: /^Cargando/ })).not.toBeInTheDocument();
    expect(screen.getByText('$ 4.500')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled());
  });
});
