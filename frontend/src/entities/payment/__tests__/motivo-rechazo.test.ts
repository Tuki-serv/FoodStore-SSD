import { describe, expect, it } from 'vitest';
import { MOTIVO_RECHAZO_GENERICO, motivoRechazo } from '../model/motivo-rechazo';

describe('motivoRechazo', () => {
  it.each(['insufficient_amount', 'cc_rejected_insufficient_amount'])('%s -> fondos insuficientes', (detalle) => {
    expect(motivoRechazo(detalle)).toBe('La tarjeta no tiene fondos suficientes.');
  });

  it.each([
    ['cc_rejected_bad_filled_card_number', 'Revisá los datos de la tarjeta e intentá de nuevo.'],
    ['cc_rejected_bad_filled_security_code', 'El código de seguridad no es correcto.'],
    ['cc_rejected_bad_filled_date', 'La fecha de vencimiento no es correcta.'],
    ['cc_rejected_call_for_authorize', 'El banco emisor rechazó el pago. Probá con otra tarjeta o consultalo con el banco.'],
    ['cc_amount_rate_limit_exceeded', 'La tarjeta no admite pagos por este monto.'],
    ['cc_rejected_duplicated_payment', 'Ya hiciste un pago igual hace un momento.'],
  ])('%s -> texto aprobado en el mockup', (detalle, texto) => {
    expect(motivoRechazo(detalle)).toBe(texto);
  });

  it('rejected_by_issuer (lo que devuelve Orders en sandbox con OTHE) -> rechazo del emisor', () => {
    expect(motivoRechazo('rejected_by_issuer')).toBe('El banco emisor rechazó el pago. Probá con otra tarjeta o consultalo con el banco.');
  });

  it('un detalle desconocido devuelve el texto genérico', () => {
    expect(motivoRechazo('algo_nuevo')).toBe('Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.');
  });

  it('null y undefined devuelven el texto genérico', () => {
    expect(motivoRechazo(null)).toBe(MOTIVO_RECHAZO_GENERICO);
    expect(motivoRechazo(undefined)).toBe(MOTIVO_RECHAZO_GENERICO);
  });
});
