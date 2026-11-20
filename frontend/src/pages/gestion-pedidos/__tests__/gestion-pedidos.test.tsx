import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pedido57, pedido58, montarGestion } from '@/test/render-gestion';

const TITULO = 'Gestión de pedidos';

describe('Listado de gestión de pedidos', () => {
  it('muestra los pedidos de todos los clientes, el más nuevo primero, con cliente, forma de pago, total y estado', async () => {
    montarGestion('/gestion-pedidos');
    await screen.findByRole('heading', { name: TITULO, level: 1 });

    const filas = within(await screen.findByRole('list', { name: 'Pedidos' })).getAllByRole('listitem');

    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('#58');
    expect(filas[0]).toHaveTextContent('Ana López');
    expect(filas[0]).toHaveTextContent('Efectivo');
    expect(filas[0]).toHaveTextContent('$ 3.850');
    expect(filas[0]).toHaveTextContent('Pendiente');
    expect(filas[1]).toHaveTextContent('#57');
    expect(filas[1]).toHaveTextContent('Bruno Díaz');
    expect(filas[1]).toHaveTextContent('Tarjeta (Mercado Pago)');
  });

  it('pulsar el número de un pedido abre su detalle', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos');

    await usuario.click(await screen.findByRole('link', { name: '#58' }));

    expect(router.state.location.pathname).toBe('/gestion-pedidos/58');
  });

  it('cuenta los pedidos y los pide al servidor con la paginación por defecto', async () => {
    const { estado } = montarGestion('/gestion-pedidos', { pedidos: [pedido58(), pedido57()] });

    expect(await screen.findByText('2 pedidos')).toBeInTheDocument();
    expect(estado.consultasLista[0]).toEqual({ page: '1', size: '20' });
  });
});
