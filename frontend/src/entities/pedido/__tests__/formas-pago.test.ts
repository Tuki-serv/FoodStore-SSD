import { describe, expect, it } from 'vitest';
import { esConfirmacionManual, FORMAS_PAGO } from '../model';

describe('FORMAS_PAGO', () => {
  it('ofrece los tres códigos del seed, en orden, con su etiqueta', () => {
    expect(FORMAS_PAGO.map(({ codigo, etiqueta }) => [codigo, etiqueta])).toEqual([
      ['MERCADOPAGO', 'Tarjeta (Mercado Pago)'],
      ['EFECTIVO', 'Efectivo'],
      ['TRANSFERENCIA', 'Transferencia bancaria'],
    ]);
  });

  it('solo efectivo y transferencia requieren confirmación manual', () => {
    expect(FORMAS_PAGO.filter((forma) => forma.confirmacionManual).map((forma) => forma.codigo)).toEqual(['EFECTIVO', 'TRANSFERENCIA']);
  });
});

describe('esConfirmacionManual', () => {
  it.each([
    ['MERCADOPAGO', false],
    ['EFECTIVO', true],
    ['TRANSFERENCIA', true],
    ['CHEQUE', false],
  ])('%s → %s', (codigo, esperado) => {
    expect(esConfirmacionManual(codigo)).toBe(esperado);
  });
});
