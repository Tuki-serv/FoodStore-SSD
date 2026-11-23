import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;

describe('Encabezado no fijo en detalle de pedido propio (D9)', () => {
  it('el detalle de mi pedido muestra ruta, título con estado y subtítulo en una banda que no queda fija', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    const titulo = await screen.findByRole('heading', { level: 1, name: /Pedido #58/ });

    expect(banda()).not.toHaveClass('is-sticky');
    expect(banda()).toContainElement(titulo);
    expect(within(banda()).getByRole('link', { name: 'Volver a mis pedidos' })).toBeInTheDocument();
  });
});
