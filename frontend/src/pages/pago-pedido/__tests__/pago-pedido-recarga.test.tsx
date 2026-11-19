import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentStore } from '@/entities/payment';
import { reiniciarEspia } from '@/test/mp-sdk-doble';
import { montarPago, pedidoAPagar } from '@/test/render-pago';

vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'));

beforeEach(() => {
  reiniciarEspia();
  usePaymentStore.getState().reset();
});

describe('Página de pago · recarga desde el servidor', () => {
  it('con el último intento aprobado y el pedido CONFIRMADO muestra «¡Pago aprobado!» sin formulario', async () => {
    const { estadoPagos } = montarPago({
      pedidos: [pedidoAPagar({ estado_codigo: 'CONFIRMADO' })],
      pagos: { estadoConsultado: { estado: 'aprobado', pago_id: 31, mp_status_detail: 'accredited' } },
    });

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(screen.queryByText('Mercado Pago confirmó tu pago.')).not.toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58]);
  });

  it('con el último intento rechazado por fondos muestra el motivo y la opción de reintentar, sin aviso de transición', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: 'rechazado', pago_id: 30, mp_status_detail: 'cc_rejected_insufficient_amount' } } });

    expect(await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('La tarjeta no tiene fondos suficientes.')).toBeInTheDocument();
    expect(screen.queryByText('Mercado Pago no aprobó el pago.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();
  });

  it('con el último intento rechazado, «Intentar de nuevo» muestra el formulario de tarjeta', async () => {
    const { usuario } = montarPago({ pagos: { estadoConsultado: { estado: 'rechazado', mp_status_detail: 'rejected_by_issuer' } } });

    await usuario.click(await screen.findByRole('button', { name: 'Intentar de nuevo' }));

    expect(await screen.findByRole('button', { name: 'Simular pago' })).toBeInTheDocument();
  });

  it('con el último intento pendiente muestra «Estamos esperando la confirmación de Mercado Pago» sin formulario', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: 'pendiente', pago_id: 31 } } });

    expect(await screen.findByRole('heading', { name: 'Estamos esperando la confirmación de Mercado Pago', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
  });

  it('con el último intento a_devolver y el pedido CANCELADO explica la devolución', async () => {
    montarPago({
      pedidos: [pedidoAPagar({ estado_codigo: 'CANCELADO' })],
      pagos: { estadoConsultado: { estado: 'a_devolver', pago_id: 31 } },
    });

    expect(await screen.findByRole('heading', { name: 'Tu pago se aprobó, pero no pudimos confirmar el pedido', level: 1 })).toBeInTheDocument();
  });

  it('sin intentos previos muestra el formulario de tarjeta', async () => {
    const { estadoPagos } = montarPago({ pagos: { estadoConsultado: { estado: null } } });

    expect(await screen.findByRole('button', { name: 'Simular pago' })).toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58]);
  });

  it('mientras consulta el pago muestra «Verificando el estado de tu pago…» y no monta el formulario', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: null } } });

    expect(await screen.findByRole('status', { name: 'Verificando el estado de tu pago' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    await screen.findByRole('button', { name: 'Simular pago' });
  });

  it('un pedido EFECTIVO muestra «Este pedido no se paga con tarjeta» sin pedir GET /pagos/60', async () => {
    const { estadoPagos } = montarPago({
      pedidos: [pedidoAPagar({ id: 60, forma_pago_codigo: 'EFECTIVO' })],
      ruta: '/finalizar-compra/pedido/60/pago',
    });

    expect(await screen.findByRole('heading', { name: 'Este pedido no se paga con tarjeta', level: 1 })).toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([]);
  });

  it('un error de red al consultar el pago avisa «No pudimos conectarnos» sin formulario y «Reintentar» vuelve a consultar', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { estadoConsultado: 'red' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58]);

    estadoPagos.estadoConsultado = { estado: null };
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: 'Simular pago' })).toBeInTheDocument();
    await waitFor(() => expect(estadoPagos.consultas).toEqual([58, 58]));
  });
});
