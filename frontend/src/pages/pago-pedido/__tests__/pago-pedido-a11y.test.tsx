import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaymentStore } from '@/entities/payment';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { reiniciarEspia } from '@/test/mp-sdk-doble';
import { montarPago, pedidoAPagar } from '@/test/render-pago';

vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'));

beforeEach(() => {
  reiniciarEspia();
  usePaymentStore.getState().reset();
});

describe('Página de pago · accesibilidad (revision-visual 6.1)', () => {
  it('el formulario de tarjeta no tiene violaciones de accesibilidad', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: null } } });
    await screen.findByRole('button', { name: 'Simular pago' });

    await esperarSinViolacionesA11y(document.body);
  });

  it('el pago aprobado (con su badge de estado de pago) no tiene violaciones', async () => {
    montarPago({
      pedidos: [pedidoAPagar({ estado_codigo: 'CONFIRMADO' })],
      pagos: { estadoConsultado: { estado: 'aprobado', pago_id: 31, mp_status_detail: 'accredited' } },
    });
    await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 });

    expect(screen.getByText('Aprobado')).toHaveClass('badge', 'b-aprobado');
    await esperarSinViolacionesA11y(document.body);
  });

  it('el pago rechazado no tiene violaciones', async () => {
    montarPago({ pagos: { estadoConsultado: { estado: 'rechazado', pago_id: 30, mp_status_detail: 'cc_rejected_insufficient_amount' } } });
    await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 });

    await esperarSinViolacionesA11y(document.body);
  });
});
