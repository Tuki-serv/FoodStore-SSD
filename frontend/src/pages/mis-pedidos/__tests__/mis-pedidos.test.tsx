import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { detalleDto } from '@/test/msw/pedidos';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const filas = () => within(screen.getByRole('list', { name: 'Mis pedidos' })).getAllByRole('listitem');

/** `n` pedidos propios del más viejo (id 1) al más nuevo (id n), en `estado`. */
const pedidos = (n: number, estado = 'ENTREGADO') =>
  Array.from({ length: n }, (_, indice) => pedidoPropio(indice + 1, { estado_codigo: estado, created_at: new Date(2026, 9, 1 + indice, 12, 0).toISOString() }));

describe('Mis pedidos · listado', () => {
  it('muestra los pedidos del cliente, el más nuevo primero, con forma de pago, total y estado', async () => {
    const entregado = pedidoPropio(41, { estado_codigo: 'ENTREGADO', forma_pago_codigo: 'MERCADOPAGO', total: '4100.00', created_at: new Date(2026, 10, 17, 13, 15).toISOString() });
    const pendiente = pedidoPropio(58, { items: [detalleDto({ pedido_id: 58, producto_id: 1 })] });
    montarMisPedidos('/mis-pedidos', { pedidos: [entregado, pendiente] });

    expect(await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeInTheDocument();
    await screen.findByRole('link', { name: '#58' });
    const items = filas();

    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('#58');
    expect(items[0]).toHaveTextContent('19/11 · 12:40');
    expect(items[0]).toHaveTextContent('Efectivo');
    expect(items[0]).toHaveTextContent('$ 3.850');
    expect(items[0]).toHaveTextContent('Pendiente');
    expect(items[1]).toHaveTextContent('#41');
    expect(items[1]).toHaveTextContent('Tarjeta (Mercado Pago)');
    expect(items[1]).toHaveTextContent('Entregado');
  });

  it('pide solo los pedidos propios: propios=true, página 1 y de a 10', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)] });

    await screen.findByRole('link', { name: '#58' });

    expect(estado.consultasLista).toEqual([{ propios: 'true', page: '1', size: '10' }]);
  });

  it('pulsar el número del pedido abre su detalle', async () => {
    const { router, usuario } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)] });

    await usuario.click(await screen.findByRole('link', { name: '#58' }));

    expect(router.state.location.pathname).toBe('/mis-pedidos/58');
  });

  it('marca «En curso» solo en los pedidos que no terminaron', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58), pedidoPropio(41, { estado_codigo: 'ENTREGADO' }), pedidoPropio(44, { estado_codigo: 'CANCELADO' })] });

    await screen.findByRole('link', { name: '#58' });

    expect(screen.getAllByText('En curso')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '#58' }).closest('li')).toHaveTextContent('En curso');
  });
});

describe('Mis pedidos · paginación, alcance y estados', () => {
  it('con 23 pedidos la página 3 muestra los 3 más viejos y pide page=3', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos?page=3', { pedidos: pedidos(23) });

    await screen.findByRole('link', { name: '#3' });

    expect(filas()).toHaveLength(3);
    expect(screen.getByText('Mostrando 21–23 de 23')).toBeInTheDocument();
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(estado.consultasLista[0]).toMatchObject({ propios: 'true', page: '3', size: '10' });
  });

  it('un usuario con CLIENT y PEDIDOS ve solo sus pedidos', async () => {
    montarMisPedidos('/mis-pedidos', {
      roles: ['CLIENT', 'PEDIDOS'],
      pedidos: [pedidoPropio(58), pedidoPropio(60, { usuario_id: 2, cliente_nombre: 'Bruno Díaz' })],
    });

    await screen.findByRole('link', { name: '#58' });

    expect(screen.queryByRole('link', { name: '#60' })).not.toBeInTheDocument();
    expect(screen.getByText('1 pedido')).toBeInTheDocument();
  });

  it('en la primera carga muestra el esqueleto con el filtro ya visible', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)], estado: { demoraLista: 300 } });

    expect(await screen.findByRole('status', { name: 'Cargando tus pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '#58' })).toBeInTheDocument();
  });

  it('sin pedidos dice «Todavía no hiciste pedidos» y ofrece «Ver catálogo»', async () => {
    montarMisPedidos('/mis-pedidos');

    expect(await screen.findByRole('heading', { name: 'Todavía no hiciste pedidos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver catálogo' })).toHaveAttribute('href', '/catalogo');
  });

  it('un error 500 muestra «Reintentar», que vuelve a pedir y se recupera', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)], estado: { fallos: { lista: { status: 500, detail: 'Ocurrió un error inesperado.' } } } });
    await screen.findByRole('heading', { name: 'No pudimos cargar tus pedidos' });
    const hechos = estado.consultasLista.length;

    delete estado.fallos.lista;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('link', { name: '#58' })).toBeInTheDocument();
    expect(estado.consultasLista.length).toBeGreaterThan(hechos);
  });

  it('no tiene violaciones de accesibilidad con datos', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58), pedidoPropio(41, { estado_codigo: 'ENTREGADO' })] });
    await screen.findByRole('link', { name: '#58' });

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('Mis pedidos · filtro por estado', () => {
  const mezcla = () => [pedidoPropio(1, { estado_codigo: 'ENTREGADO' }), pedidoPropio(2, { estado_codigo: 'CANCELADO' }), pedidoPropio(3, { estado_codigo: 'PENDIENTE' }), pedidoPropio(4, { estado_codigo: 'ENTREGADO' })];

  it('elegir «Entregado» escribe estado=ENTREGADO en la URL, pide con propios y muestra solo esos pedidos', async () => {
    const { estado, router, usuario } = montarMisPedidos('/mis-pedidos', { pedidos: mezcla() });
    await screen.findByRole('link', { name: '#3' });
    expect(screen.queryByRole('button', { name: 'Limpiar filtro' })).not.toBeInTheDocument();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Entregado');

    await waitFor(() => expect(estado.consultasLista.at(-1)).toEqual({ propios: 'true', estado: 'ENTREGADO', page: '1', size: '10' }));
    expect(router.state.location.search).toBe('?estado=ENTREGADO');
    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(screen.getByText(/en Entregado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtro' })).toBeInTheDocument();
  });

  it('abrir /mis-pedidos?estado=CANCELADO deja el filtro en «Cancelado» y lo pide al servidor', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos?estado=CANCELADO', { pedidos: mezcla() });

    await screen.findByRole('link', { name: '#2' });

    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('CANCELADO');
    expect(estado.consultasLista[0]).toEqual({ propios: 'true', estado: 'CANCELADO', page: '1', size: '10' });
  });

  it('un estado desconocido en la URL vuelve a «Todos» y no viaja', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos?estado=DESPACHADO', { pedidos: mezcla() });

    await screen.findByRole('link', { name: '#3' });

    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('');
    expect(estado.consultasLista[0]).toEqual({ propios: 'true', page: '1', size: '10' });
  });

  it('cambiar el estado desde la página 3 vuelve a la página 1 (la URL no conserva page)', async () => {
    const { router, usuario } = montarMisPedidos('/mis-pedidos?page=3', { pedidos: pedidos(23) });
    await screen.findByText('Página 3 de 3');

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Estado' }), 'Pendiente');

    await waitFor(() => expect(router.state.location.search).toBe('?estado=PENDIENTE'));
  });

  it('con 12 «Entregado» la página 2 tiene 2 filas y la URL guarda estado y page', async () => {
    const { router, usuario } = montarMisPedidos('/mis-pedidos?estado=ENTREGADO', { pedidos: pedidos(12) });
    await screen.findByText('Página 1 de 2');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(filas()).toHaveLength(2));
    expect(router.state.location.search).toBe('?estado=ENTREGADO&page=2');
  });

  it('«Limpiar filtro» vuelve a /mis-pedidos con «Todos» y sin estado', async () => {
    const { estado, router, usuario } = montarMisPedidos('/mis-pedidos?estado=ENTREGADO', { pedidos: mezcla() });
    await screen.findByRole('link', { name: '#1' });

    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtro' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByRole('combobox', { name: 'Estado' })).toHaveValue('');
    await screen.findByRole('link', { name: '#3' });
    expect(estado.consultasLista.at(-1)).toEqual({ propios: 'true', page: '1', size: '10' });
    expect(screen.queryByRole('button', { name: 'Limpiar filtro' })).not.toBeInTheDocument();
  });

  it('un filtro sin resultados dice «No tenés pedidos en ese estado» y no ofrece «Ver catálogo»', async () => {
    montarMisPedidos('/mis-pedidos?estado=EN_CAMINO', { pedidos: mezcla() });

    expect(await screen.findByRole('heading', { name: 'No tenés pedidos en ese estado' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpiar filtro' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Todavía no hiciste pedidos')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver catálogo' })).not.toBeInTheDocument();
  });

  it('el filtro se ve también cuando la carga falla', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos: mezcla(), estado: { fallos: { lista: { status: 500, detail: 'Fallo' } } } });

    await screen.findByRole('heading', { name: 'No pudimos cargar tus pedidos' });

    expect(screen.getByRole('combobox', { name: 'Estado' })).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad con un filtro activo', async () => {
    montarMisPedidos('/mis-pedidos?estado=ENTREGADO', { pedidos: mezcla() });
    await screen.findByRole('link', { name: '#1' });

    await esperarSinViolacionesA11y(document.body);
  });
});
