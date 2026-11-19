import { describe, expect, it } from 'vitest';
import { cuerpoDesdeBrick } from '../model/cuerpo-desde-brick';

describe('cuerpoDesdeBrick', () => {
  it('arma el cuerpo completo: cuotas y emisor numéricos, identificación y tipo de pago adicional', () => {
    const cuerpo = cuerpoDesdeBrick(
      58,
      {
        token: 'tok_1',
        payment_method_id: 'visa',
        installments: '3',
        issuer_id: '310',
        payer: { email: 'comprador@test.com', identification: { type: 'DNI', number: '12345678' } },
      },
      { paymentTypeId: 'credit_card' },
    );

    expect(cuerpo).toEqual({
      pedido_id: 58,
      token: 'tok_1',
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      installments: 3,
      issuer_id: 310,
      payer: { email: 'comprador@test.com', identification: { type: 'DNI', number: '12345678' } },
    });
  });

  it('con emisor vacío manda null y sin número de identificación el payer lleva solo el email', () => {
    const cuerpo = cuerpoDesdeBrick(
      7,
      { token: 'tok_2', payment_method_id: 'master', installments: 1, issuer_id: '', payer: { email: 'a@b.com', identification: { type: 'DNI', number: '' } } },
      { paymentTypeId: 'debit_card' },
    );

    expect(cuerpo.issuer_id).toBeNull();
    expect(cuerpo.installments).toBe(1);
    expect(cuerpo.payment_type_id).toBe('debit_card');
    expect(cuerpo.payer).toEqual({ email: 'a@b.com' });
  });

  it('no pasa campos extra del brick', () => {
    const datosDelBrick = { token: 't', payment_method_id: 'visa', installments: 1, issuer_id: 25, payer: { email: 'x@y.com' }, transaction_amount: 2850, processing_mode: 'aggregator' };
    const adicionalDelBrick = { paymentTypeId: 'credit_card', bin: '450995', lastFourDigits: '3704', cardholderName: 'APRO' };
    const cuerpo = cuerpoDesdeBrick(9, datosDelBrick, adicionalDelBrick);

    expect(Object.keys(cuerpo).sort()).toEqual(['installments', 'issuer_id', 'payer', 'payment_method_id', 'payment_type_id', 'pedido_id', 'token']);
    expect(cuerpo.issuer_id).toBe(25);
  });

  it.each([undefined, { paymentTypeId: undefined }, { paymentTypeId: 'prepaid_card' }])('sin un tipo de pago admitido (%o) falla sin armar el cuerpo', (adicional) => {
    expect(() => cuerpoDesdeBrick(9, { token: 't', payment_method_id: 'visa', installments: 1, issuer_id: 1, payer: { email: 'x@y.com' } }, adicional)).toThrow(
      'El formulario de tarjeta no informó un tipo de pago admitido',
    );
  });
});
