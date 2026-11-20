import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const mercadoPago = (parcial = {}) => pedidoPropio(58, { forma_pago_codigo: 'MERCADOPAGO', ...parcial });

describe('Mi pedido · pago con Mercado Pago', () => {
  it('con el último intento rechazado muestra el motivo y «Reintentar el pago» hacia la página de pago', async () => {
    montarMisPedidos('/mis-pedidos/58', {
      pedidos: [mercadoPago()],
      pagos: { estadoConsultado: { pago_id: 7, estado: 'rechazado', mp_status: 'failed', mp_status_detail: 'cc_rejected_insufficient_amount' } },
    });

    const entrega = await screen.findByRole('region', { name: 'Entrega y pago' });

    expect(await within(entrega).findByText('Último intento de pago: rechazado')).toBeInTheDocument();
    expect(within(entrega).getByText(/fondos suficientes/)).toBeInTheDocument();
    const reintentar = await screen.findByRole('link', { name: 'Reintentar el pago de $ 3.850' });
    expect(reintentar).toHaveAttribute('href', '/finalizar-compra/pedido/58/pago');
  });

  it('sin ningún intento ofrece «Pagar $ 3.850 con tarjeta»', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [mercadoPago()] });

    const pagar = await screen.findByRole('link', { name: 'Pagar $ 3.850 con tarjeta' });

    expect(pagar).toHaveAttribute('href', '/finalizar-compra/pedido/58/pago');
    expect(screen.getByRole('region', { name: 'Entrega y pago' })).toHaveTextContent('Todavía no pagaste este pedido.');
  });

  it('con el pago pendiente pide esperar y no ofrece pagar de nuevo', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [mercadoPago()], pagos: { estadoConsultado: { pago_id: 7, estado: 'pendiente' } } });

    expect(await screen.findByText('Ver el estado del pago')).toBeInTheDocument();
    expect(screen.getByText('No lo pagues de nuevo: si Mercado Pago aprueba el pago, el pedido se confirma solo.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar|Reintentar el pago/ })).not.toBeInTheDocument();
  });

  it('con el pago aprobado muestra «Pago aprobado» y no ofrece nada', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [mercadoPago({ estado_codigo: 'CONFIRMADO' })], pagos: { estadoConsultado: { pago_id: 7, estado: 'aprobado' } } });

    const entrega = await screen.findByRole('region', { name: 'Entrega y pago' });

    expect(await within(entrega).findByText('Pago aprobado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar|Reintentar el pago|estado del pago/ })).not.toBeInTheDocument();
  });

  it('un pedido en efectivo no consulta /pagos ni muestra la fila «Pago»', async () => {
    const { pagos } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });

    await screen.findByRole('heading', { name: /Pedido #58/, level: 1 });

    expect(pagos.consultas).toEqual([]);
    expect(screen.queryByText('Pago')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pagar/ })).not.toBeInTheDocument();
  });

  it('un pedido de otro usuario no consulta /pagos', async () => {
    const { pagos } = montarMisPedidos('/mis-pedidos/70', { pedidos: [mercadoPago({ id: 70, usuario_id: 2 })] });

    await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 });

    expect(pagos.consultas).toEqual([]);
  });
});
