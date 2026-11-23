import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;

describe('Mis pedidos · encabezado fijo (D9)', () => {
  it('título, filtro por estado, conteo y «Actualizar» viven en la banda fija', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)] });
    const lista = await screen.findByRole('list', { name: 'Mis pedidos' });

    expect(banda()).toHaveClass('is-sticky');
    const dentro = within(banda());
    expect(dentro.getByRole('heading', { level: 1, name: 'Mis pedidos' })).toBeInTheDocument();
    expect(dentro.getByLabelText('Estado')).toBeInTheDocument();
    expect(dentro.getByRole('status')).toHaveTextContent('1 pedido');
    expect(dentro.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(banda()).not.toContainElement(lista);
  });

  it('con un estado elegido muestra su chip quitable y quitarlo vuelve a /mis-pedidos', async () => {
    const { router, usuario } = montarMisPedidos('/mis-pedidos?estado=ENTREGADO', { pedidos: [pedidoPropio(41, { estado_codigo: 'ENTREGADO' })] });
    const chips = await screen.findByRole('group', { name: 'Filtros aplicados' });

    await usuario.click(within(chips).getByRole('button', { name: 'Quitar filtro Entregado' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});
