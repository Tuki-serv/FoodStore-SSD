import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentStore } from '@/entities/payment';
import { reiniciarEspia } from '@/test/mp-sdk-doble';
import { montarPago, pedidoAPagar } from '@/test/render-pago';

vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'));

const TITULO_PENDIENTE = 'Estamos esperando la confirmación de Mercado Pago';
const TITULO_DEMORA = 'La confirmación está demorando';

beforeEach(() => {
  reiniciarEspia();
  usePaymentStore.getState().reset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('Página de pago · seguimiento del pendiente', () => {
  it('con el pago pendiente consulta GET /pagos/58 cada 5 s', async () => {
    const { estadoPagos } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });
    expect(estadoPagos.consultas).toEqual([58]);

    await avanzar(5000);
    await waitFor(() => expect(estadoPagos.consultas).toHaveLength(2));
    await avanzar(5000);
    await waitFor(() => expect(estadoPagos.consultas).toHaveLength(3));
  });

  it('no consulta antes de que pasen los 5 s', async () => {
    const { estadoPagos } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    await avanzar(4000);

    expect(estadoPagos.consultas).toEqual([58]);
  });

  it('el seguimiento anuncia que se actualiza solo en una región de estado', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    expect(screen.getByRole('status', { name: 'Seguimiento del pago' })).toHaveTextContent('Esta pantalla se actualiza sola cada 5 segundos');
  });

  it('pasa a aprobado: muestra «¡Pago aprobado!» con el aviso, invalida los pedidos y deja de consultar', async () => {
    const { estadoPagos, estadoPedidos, queryClient } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    queryClient.setQueryData(['pedidos', 'lista'], { items: [] });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    estadoPagos.estadoConsultado = { estado: 'aprobado', pago_id: 31 };
    estadoPedidos.pedidos.set(58, pedidoAPagar({ estado_codigo: 'CONFIRMADO' }));
    await avanzar(5000);

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago confirmó tu pago.')).toBeInTheDocument();
    expect(queryClient.getQueryState(['pedidos', 'lista'])?.isInvalidated).toBe(true);
    expect(await screen.findByText('Confirmado')).toBeInTheDocument();

    const consultas = estadoPagos.consultas.length;
    await avanzar(30000);
    expect(estadoPagos.consultas).toHaveLength(consultas);
  });

  it('pasa a rechazado: muestra «El pago fue rechazado» con el aviso, el motivo y el reintento, y deja de consultar', async () => {
    const { estadoPagos } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    estadoPagos.estadoConsultado = { estado: 'rechazado', mp_status_detail: 'cc_rejected_insufficient_amount' };
    await avanzar(5000);

    expect(await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago no aprobó el pago.')).toBeInTheDocument();
    expect(screen.getByText('La tarjeta no tiene fondos suficientes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();

    const consultas = estadoPagos.consultas.length;
    await avanzar(30000);
    expect(estadoPagos.consultas).toHaveLength(consultas);
  });

  it('pasa a a_devolver: muestra la vista sin stock, sin aviso de aprobación, y deja de consultar', async () => {
    const { estadoPagos, estadoPedidos } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    estadoPagos.estadoConsultado = { estado: 'a_devolver' };
    estadoPedidos.pedidos.set(58, pedidoAPagar({ estado_codigo: 'CANCELADO' }));
    await avanzar(5000);

    expect(await screen.findByRole('heading', { name: 'Tu pago se aprobó, pero no pudimos confirmar el pedido', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Mercado Pago confirmó tu pago.')).not.toBeInTheDocument();

    const consultas = estadoPagos.consultas.length;
    await avanzar(30000);
    expect(estadoPagos.consultas).toHaveLength(consultas);
  });

  it('un pago pendiente que llega desde POST /pagos/crear también se sigue', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { resultados: [{ estado: 'pendiente' }] } });
    await screen.findByRole('heading', { name: 'Pagar pedido #58', level: 1 });
    await usuario.click(await screen.findByRole('button', { name: 'Simular pago' }));
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    estadoPagos.estadoConsultado = { estado: 'aprobado', pago_id: 31 };
    await avanzar(5000);

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago confirmó tu pago.')).toBeInTheDocument();
  });

  it('al salir de la página deja de consultar', async () => {
    const { estadoPagos, router } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    await act(async () => {
      await router.navigate('/catalogo');
    });
    const consultas = estadoPagos.consultas.length;
    await avanzar(60000);

    expect(estadoPagos.consultas).toHaveLength(consultas);
  });
});

describe('Página de pago · tope de espera', () => {
  it('a los 2 min sigue pendiente: muestra «La confirmación está demorando» y no consulta más', async () => {
    const { estadoPagos } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });

    await avanzar(120000);

    expect(await screen.findByRole('heading', { name: TITULO_DEMORA, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/finalizar-compra/pedido/58');
    const consultas = estadoPagos.consultas.length;
    expect(consultas).toBeLessThanOrEqual(25);
    await avanzar(60000);
    expect(estadoPagos.consultas).toHaveLength(consultas);
  });

  it('«Actualizar» hace una consulta y, si el pago se aprobó, muestra «¡Pago aprobado!»', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });
    await avanzar(120000);
    await screen.findByRole('heading', { name: TITULO_DEMORA, level: 1 });
    const antes = estadoPagos.consultas.length;

    estadoPagos.estadoConsultado = { estado: 'aprobado', pago_id: 31 };
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(estadoPagos.consultas).toHaveLength(antes + 1);
  });

  it('«Actualizar» con el pago todavía pendiente hace una sola consulta y sigue demorando', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { estadoConsultado: { estado: 'pendiente' } } });
    await screen.findByRole('heading', { name: TITULO_PENDIENTE, level: 1 });
    await avanzar(120000);
    await screen.findByRole('heading', { name: TITULO_DEMORA, level: 1 });
    const antes = estadoPagos.consultas.length;

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(estadoPagos.consultas).toHaveLength(antes + 1));
    await avanzar(30000);

    expect(screen.getByRole('heading', { name: TITULO_DEMORA, level: 1 })).toBeInTheDocument();
    expect(estadoPagos.consultas).toHaveLength(antes + 1);
  });
});
