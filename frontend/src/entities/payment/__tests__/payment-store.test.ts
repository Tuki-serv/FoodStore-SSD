import { beforeEach, describe, expect, it } from 'vitest';
import { selectEstadoPago, selectPagoEnCurso, usePaymentStore } from '..';

const pago = () => usePaymentStore.getState();

describe('paymentStore', () => {
  beforeEach(() => {
    pago().reset();
  });

  it('arranca inactivo, sin pedido ni intento en curso', () => {
    expect(pago()).toMatchObject({ estado: 'inactivo', pedidoId: null, mpPaymentId: null, statusDetail: null, error: null });
    expect(selectPagoEnCurso(pago())).toBe(false);
  });

  it('iniciar(12) pasa a procesando con el pedido 12', () => {
    pago().iniciar(12);

    expect(selectEstadoPago(pago())).toBe('procesando');
    expect(pago().pedidoId).toBe(12);
    expect(selectPagoEnCurso(pago())).toBe(true);
  });

  it('iniciar otro intento limpia el resultado y el error del anterior', () => {
    pago().iniciar(12);
    pago().registrarError('Tarjeta rechazada');

    pago().iniciar(13);

    expect(pago()).toMatchObject({ estado: 'procesando', pedidoId: 13, mpPaymentId: null, statusDetail: null, error: null });
  });

  it('registrarResultado aprobado guarda el id de pago de MercadoPago', () => {
    pago().iniciar(12);

    pago().registrarResultado({ estado: 'aprobado', mpPaymentId: 98765, statusDetail: 'accredited' });

    expect(pago()).toMatchObject({ estado: 'aprobado', pedidoId: 12, mpPaymentId: 98765, statusDetail: 'accredited', error: null });
    expect(selectPagoEnCurso(pago())).toBe(false);
  });

  it.each(['rechazado', 'pendiente'] as const)('registrarResultado %s conserva el pedido y el detalle', (estado) => {
    pago().iniciar(5);

    pago().registrarResultado({ estado, mpPaymentId: 1, statusDetail: 'cc_rejected_other_reason' });

    expect(pago()).toMatchObject({ estado, pedidoId: 5, statusDetail: 'cc_rejected_other_reason' });
  });

  it('registrarError pasa a error con el mensaje y deja de estar en curso', () => {
    pago().iniciar(12);

    pago().registrarError('No pudimos procesar el pago');

    expect(pago()).toMatchObject({ estado: 'error', pedidoId: 12, error: 'No pudimos procesar el pago' });
    expect(selectPagoEnCurso(pago())).toBe(false);
  });

  it('no escribe nada en localStorage ni sessionStorage', () => {
    pago().iniciar(12);
    pago().registrarResultado({ estado: 'aprobado', mpPaymentId: 98765, statusDetail: 'accredited' });

    const guardado = [window.localStorage, window.sessionStorage].flatMap((almacen) =>
      Array.from({ length: almacen.length }, (_, i) => `${almacen.key(i) ?? ''}=${almacen.getItem(almacen.key(i) ?? '') ?? ''}`),
    );
    expect(guardado.filter((entrada) => /payment|pago|98765|accredited/i.test(entrada))).toEqual([]);
  });

  it('reset vuelve a inactivo y sin pedido', () => {
    pago().iniciar(12);
    pago().registrarResultado({ estado: 'aprobado', mpPaymentId: 98765, statusDetail: 'accredited' });

    pago().reset();

    expect(pago()).toMatchObject({ estado: 'inactivo', pedidoId: null, mpPaymentId: null, statusDetail: null, error: null });
  });
});
