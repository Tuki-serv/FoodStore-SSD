import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pedidoDto } from '@/test/msw/pedidos';
import { montarGestion } from '@/test/render-gestion';

const lista = () => screen.getByRole('list', { name: 'Pedidos' });
const indice = (li: HTMLElement) => li.style.getPropertyValue('--i');
const filasDeDatos = () => within(lista()).getAllByRole('listitem').filter((li) => !li.classList.contains('ohead'));

const pedido = (id: number, estado_codigo = 'PENDIENTE') =>
  pedidoDto({ id, estado_codigo, cliente_nombre: `Cliente ${id}`, created_at: new Date(Date.UTC(2026, 10, 19, 12, 0, id)).toISOString() });

describe('Gestión de pedidos · entrada escalonada (spec frontend-visual-language)', () => {
  it('al montar con pedidos, la lista lleva la clase de entrada y cada fila su índice; el encabezado de columnas no se anima', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido(1), pedido(2), pedido(3)] });
    await screen.findByRole('link', { name: '#3' });

    expect(lista()).toHaveClass('stagger');
    expect(filasDeDatos().map(indice)).toEqual(['0', '1', '2']);
  });

  it('al cambiar el filtro de estado la lista ya no lleva la clase de entrada', async () => {
    const { usuario } = montarGestion('/gestion-pedidos', { pedidos: [pedido(1), pedido(2), pedido(3, 'CONFIRMADO'), pedido(4, 'CONFIRMADO')] });
    await screen.findByRole('link', { name: '#4' });

    await usuario.click(screen.getByRole('button', { name: 'Pendiente' }));

    await screen.findByRole('link', { name: '#1' });
    expect(screen.queryByRole('link', { name: '#4' })).not.toBeInTheDocument();
    expect(lista()).not.toHaveClass('stagger');
  });
});
