import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const lista = () => screen.getByRole('list', { name: 'Mis pedidos' });
const indice = (li: HTMLElement) => li.style.getPropertyValue('--i');

const pedidos = Array.from({ length: 10 }, (_, i) => pedidoPropio(i + 1, { estado_codigo: i % 2 === 0 ? 'ENTREGADO' : 'PENDIENTE', created_at: new Date(2026, 9, 1 + i, 12, 0).toISOString() }));

describe('Mis pedidos · entrada escalonada (spec frontend-visual-language)', () => {
  it('al montar con pedidos, la lista lleva la clase de entrada y cada fila su índice (topado en 8); el encabezado de columnas no se anima', async () => {
    montarMisPedidos('/mis-pedidos', { pedidos });
    await screen.findByRole('link', { name: '#10' });

    expect(lista()).toHaveClass('stagger');
    const filas = within(lista()).getAllByRole('listitem').filter((li) => !li.classList.contains('ohead'));
    expect(filas.map(indice)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '8']);
  });

  it('al cambiar el filtro de estado la lista ya no lleva la clase de entrada', async () => {
    const { usuario } = montarMisPedidos('/mis-pedidos', { pedidos });
    await screen.findByRole('link', { name: '#10' });

    await usuario.click(screen.getByRole('button', { name: 'Entregado' }));

    await screen.findByRole('link', { name: '#9' });
    expect(screen.queryByRole('link', { name: '#10' })).not.toBeInTheDocument();
    expect(lista()).not.toHaveClass('stagger');
  });
});
