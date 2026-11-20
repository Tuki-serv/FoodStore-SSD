import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pedidoDto } from '@/test/msw/pedidos';
import { montarGestion, pedido58 } from '@/test/render-gestion';

const filaDe = async (numero: number) => {
  const lista = await screen.findByRole('list', { name: 'Pedidos' });
  const fila = within(lista).getAllByRole('listitem').find((candidata) => within(candidata).queryByRole('link', { name: `#${numero}` }) !== null);
  if (fila === undefined) throw new Error(`No hay fila para #${numero}`);
  return fila;
};

const pedidos = () => [
  pedido58({ id: 60, forma_pago_codigo: 'TRANSFERENCIA', cliente_nombre: 'Laura Gil', created_at: '2026-11-19T16:00:00Z' }),
  pedido58({ id: 59, forma_pago_codigo: 'MERCADOPAGO', cliente_nombre: 'Marcos Ruiz', created_at: '2026-11-19T15:50:00Z' }),
  pedido58({ id: 58, estado_codigo: 'CONFIRMADO', cliente_nombre: 'Ana López', created_at: '2026-11-19T15:40:00Z' }),
  pedido58({ id: 57, estado_codigo: 'EN_PREP', cliente_nombre: 'Bruno Díaz', created_at: '2026-11-19T15:30:00Z' }),
  pedido58({ id: 56, estado_codigo: 'EN_CAMINO', cliente_nombre: 'Carmen Vega', created_at: '2026-11-19T15:20:00Z' }),
  pedidoDto({ id: 55, estado_codigo: 'ENTREGADO', cliente_nombre: 'Diego Ramos', created_at: '2026-11-19T15:10:00Z' }),
  pedidoDto({ id: 54, estado_codigo: 'CANCELADO', cliente_nombre: 'Elena Torres', created_at: '2026-11-19T15:00:00Z' }),
];

describe('Próxima acción desde el listado', () => {
  it.each([
    [60, 'Confirmar pago el pedido #60'],
    [58, 'Pasar a preparación el pedido #58'],
    [57, 'Despachar el pedido #57'],
    [56, 'Marcar entregado el pedido #56'],
  ])('la fila #%i ofrece «%s»', async (numero, nombre) => {
    montarGestion('/gestion-pedidos', { pedidos: pedidos() });

    expect(within(await filaDe(numero)).getByRole('button', { name: nombre })).toBeInTheDocument();
  });

  it('una fila PENDIENTE de Mercado Pago, una ENTREGADO y una CANCELADO no ofrecen avance', async () => {
    montarGestion('/gestion-pedidos', { pedidos: pedidos() });

    for (const numero of [59, 55, 54]) expect(within(await filaDe(numero)).queryByRole('button')).toBeNull();
    expect(await filaDe(59)).toHaveTextContent('Espera el pago en Mercado Pago');
  });

  it('ninguna fila ofrece cancelar', async () => {
    montarGestion('/gestion-pedidos', { pedidos: pedidos() });
    await filaDe(60);

    expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull();
  });

  it('«Confirmar pago» abre el mismo diálogo y, al terminar, la fila pasa a «Confirmado» con «Pasar a preparación»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos', { pedidos: pedidos() });

    await usuario.click(within(await filaDe(60)).getByRole('button', { name: 'Confirmar pago el pedido #60' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar pago del pedido #60' });
    expect(dialogo).toHaveTextContent('recibió el pago por transferencia');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pago' }));

    await waitFor(async () => expect(await filaDe(60)).toHaveTextContent('Confirmado'));
    expect(estado.cambiosEstado).toEqual([{ id: 60, cuerpo: { nuevo_estado: 'CONFIRMADO' } }]);
    expect(within(await filaDe(60)).getByRole('button', { name: 'Pasar a preparación el pedido #60' })).toBeInTheDocument();
    expect(await screen.findByText('Pedido #60 confirmado')).toBeInTheDocument();
  });

  it('el foco vuelve a la fila: queda en su botón nuevo', async () => {
    const { usuario } = montarGestion('/gestion-pedidos', { pedidos: pedidos() });
    await usuario.click(within(await filaDe(58)).getByRole('button', { name: 'Pasar a preparación el pedido #58' }));
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pasar a preparación' }));

    await waitFor(async () => expect(within(await filaDe(58)).getByRole('button', { name: 'Despachar el pedido #58' })).toHaveFocus());
  });

  it('«Despachar» desde la fila muestra la dirección de entrega del pedido', async () => {
    const { usuario } = montarGestion('/gestion-pedidos', { pedidos: pedidos() });

    await usuario.click(within(await filaDe(57)).getByRole('button', { name: 'Despachar el pedido #57' }));

    expect(await within(await screen.findByRole('dialog', { name: 'Despachar el pedido #57' })).findByText(/Av\. Siempre Viva 742/)).toBeInTheDocument();
  });

  it('un 409 por stock desde la fila ofrece cancelar por falta de stock', async () => {
    const { usuario } = montarGestion('/gestion-pedidos', {
      pedidos: pedidos(),
      estado: { fallos: { estado: { status: 409, code: 'INSUFFICIENT_STOCK', detail: 'No hay stock suficiente para Hamburguesa Clásica' } } },
    });
    await usuario.click(within(await filaDe(60)).getByRole('button', { name: 'Confirmar pago el pedido #60' }));
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar pago' }));

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar por falta de stock' }));

    expect(within(await screen.findByRole('dialog', { name: 'Cancelar el pedido #60' })).getByRole('textbox', { name: 'Motivo' })).toHaveValue('Sin stock');
  });
});
