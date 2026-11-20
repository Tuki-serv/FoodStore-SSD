import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearEstadoEstadisticas } from '@/test/msw/estadisticas';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { montarDashboard } from '@/test/render-dashboard';

/** Espera a que lleguen los datos y devuelve el bloque (la región con ese título). */
async function bloque(titulo: string): Promise<HTMLElement> {
  const region = await screen.findByRole('region', { name: titulo });
  await waitFor(() => expect(within(region).queryByRole('status')).not.toBeInTheDocument());
  return region;
}

const filas = (tabla: HTMLElement): string[][] =>
  within(tabla)
    .getAllByRole('row')
    .slice(1)
    .map((fila) => Array.from(fila.children).map((celda) => celda.textContent ?? ''));

describe('Dashboard: tablas equivalentes de los gráficos', () => {
  it('«Ver como tabla» en «Productos más vendidos» muestra Producto, Cantidad e Ingresos con las filas del servidor', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Productos más vendidos');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    const tabla = within(region).getByRole('table');
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Producto', 'Cantidad', 'Ingresos']);
    expect(filas(tabla)).toEqual([
      ['Empanada de carne', '8', '$ 2.400'],
      ['Pizza muzzarella', '5', '$ 5.000'],
      ['Tarta de verdura', '2', '$ 1.800'],
    ]);
    expect(within(region).getByRole('button', { name: 'Ver gráfico' })).toBeInTheDocument();
  });

  it('la tabla de ventas rotula cada período (09/11, 10/11, 11/11) con sus ingresos y pedidos', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Ventas por período');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    const tabla = within(region).getByRole('table');
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Período', 'Ingresos', 'Pedidos']);
    expect(filas(tabla)).toEqual([
      ['09/11', '$ 0', '0'],
      ['10/11', '$ 1.000', '1'],
      ['11/11', '$ 0', '0'],
    ]);
  });

  it('la tabla de estados usa el nombre visible de cada estado en el orden de la FSM', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Pedidos por estado');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    const tabla = within(region).getByRole('table');
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Estado', 'Pedidos']);
    expect(filas(tabla)).toEqual([
      ['Pendiente', '2'],
      ['Confirmado', '1'],
      ['En preparación', '3'],
      ['En camino', '0'],
      ['Entregado', '4'],
      ['Cancelado', '1'],
    ]);
  });

  it('la tabla de formas de pago muestra el nombre visible y el porcentaje del total (75 % y 25 %)', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Ingresos por forma de pago');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    const tabla = within(region).getByRole('table');
    expect(within(tabla).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Forma de pago', 'Ingresos', 'Porcentaje']);
    expect(filas(tabla)).toEqual([
      ['Efectivo', '$ 1.500', '75 %'],
      ['Tarjeta (Mercado Pago)', '$ 500', '25 %'],
      ['Transferencia bancaria', '$ 0', '0 %'],
    ]);
  });
});

describe('Dashboard: alternativa accesible de cada gráfico', () => {
  it('cada bloque tiene título visible, su tabla disponible para lectores de pantalla y el gráfico oculto a la tecnología asistiva', async () => {
    montarDashboard();

    for (const titulo of ['Ventas por período', 'Productos más vendidos', 'Pedidos por estado', 'Ingresos por forma de pago']) {
      const region = await bloque(titulo);

      expect(within(region).getByRole('heading', { name: titulo, level: 2 })).toBeInTheDocument();
      expect(within(region).getByRole('table')).toBeInTheDocument();
      expect(region.querySelector('.chart-box')).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('mientras el gráfico se ve, su tabla queda fuera de la vista; con «Ver como tabla» pasa a verse y el gráfico se oculta', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Productos más vendidos');
    const contenedorTabla = within(region).getByRole('table').closest('.dtabla-wrap, .sr-only');

    expect(contenedorTabla).toHaveClass('sr-only');
    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    expect(within(region).getByRole('table').closest('.dtabla-wrap')).not.toHaveClass('sr-only');
    expect(region.querySelector('.chart-box')).not.toBeVisible();

    await usuario.click(within(region).getByRole('button', { name: 'Ver gráfico' }));

    expect(region.querySelector('.chart-box')).toBeVisible();
  });
});

describe('Dashboard: gráficos con datos de otro tipo', () => {
  it('con agrupación «Mes» la tabla de ventas rotula «nov 2026»', async () => {
    const estado = crearEstadoEstadisticas();
    estado.ventas = [{ fecha: '2026-11-01', total_ventas: '4500.00', cantidad_pedidos: 3 }];
    const { usuario } = montarDashboard('/admin/dashboard?agrupacion=month', { estado });
    const region = await bloque('Ventas por período');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    expect(filas(within(region).getByRole('table'))).toEqual([['nov 2026', '$ 4.500', '3']]);
  });

  it('con agrupación «Semana» la tabla de ventas rotula «Sem. 09/11»', async () => {
    const estado = crearEstadoEstadisticas();
    estado.ventas = [{ fecha: '2026-11-09', total_ventas: '1000.00', cantidad_pedidos: 1 }];
    const { usuario } = montarDashboard('/admin/dashboard?agrupacion=week', { estado });
    const region = await bloque('Ventas por período');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    expect(filas(within(region).getByRole('table'))).toEqual([['Sem. 09/11', '$ 1.000', '1']]);
  });

  it('activar «Pendiente» en la tabla de estados navega a la gestión de pedidos filtrada', async () => {
    const { router, usuario } = montarDashboard();
    const region = await bloque('Pedidos por estado');
    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    await usuario.click(within(region).getByRole('link', { name: 'Pendiente' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/gestion-pedidos'));
    expect(router.state.location.search).toBe('?estado=PENDIENTE');
  });

  it('un estado que el frontend no conoce se muestra con su código y sin enlace', async () => {
    const estado = crearEstadoEstadisticas();
    estado.pedidosPorEstado = [...estado.pedidosPorEstado, { estado_codigo: 'COCINA', cantidad: 2 }];
    const { usuario } = montarDashboard('/admin/dashboard', { estado });
    const region = await bloque('Pedidos por estado');
    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    const tabla = within(region).getByRole('table');

    expect(filas(tabla).at(-1)).toEqual(['COCINA', '2']);
    expect(within(tabla).queryByRole('link', { name: 'COCINA' })).not.toBeInTheDocument();
  });

  it('con 100 % en una sola forma de pago el resto muestra 0 %', async () => {
    const estado = crearEstadoEstadisticas();
    estado.ingresos = [
      { forma_pago_codigo: 'MERCADOPAGO', total: '800.00', cantidad: 1 },
      { forma_pago_codigo: 'EFECTIVO', total: '0.00', cantidad: 0 },
      { forma_pago_codigo: 'TRANSFERENCIA', total: '0.00', cantidad: 0 },
    ];
    const { usuario } = montarDashboard('/admin/dashboard', { estado });
    const region = await bloque('Ingresos por forma de pago');

    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    expect(filas(within(region).getByRole('table')).map((f) => f[2])).toEqual(['100 %', '0 %', '0 %']);
  });
});

describe('Dashboard: accesibilidad', () => {
  it('con datos no tiene violaciones de axe', async () => {
    montarDashboard();
    await bloque('Ingresos por forma de pago');
    await bloque('Productos más vendidos');
    await screen.findByText('$ 4.500');

    await esperarSinViolacionesA11y(document.body);
  });

  it('con una tabla abierta no tiene violaciones de axe', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Pedidos por estado');
    await screen.findByText('$ 4.500');
    await usuario.click(within(region).getByRole('button', { name: 'Ver como tabla' }));

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('Dashboard: nombre accesible del botón de vista (en mobile el texto visible se oculta con CSS)', () => {
  it('el botón lleva su nombre en aria-label, así no depende del texto que el CSS oculta, y cambia con la vista', async () => {
    const { usuario } = montarDashboard();
    const region = await bloque('Ventas por período');

    const aTabla = within(region).getByRole('button', { name: /ver como tabla/i });
    expect(aTabla).toHaveAttribute('aria-label', 'Ver como tabla');
    await usuario.click(aTabla);

    const aGrafico = within(region).getByRole('button', { name: /ver gráfico/i });
    expect(aGrafico).toHaveAttribute('aria-label', 'Ver gráfico');
  });
});
