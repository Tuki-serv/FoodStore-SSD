import { describe, expect, it } from 'vitest';
import { armarPedido } from '../model';

const lineas = [{ productoId: 1, cantidad: 2, personalizacion: [3, 1] }];

describe('armarPedido', () => {
  it('arma el cuerpo con la dirección, la forma de pago y los items', () => {
    expect(armarPedido({ direccionId: 4, formaPago: 'EFECTIVO', notas: '' }, lineas)).toEqual({
      direccion_id: 4,
      forma_pago_codigo: 'EFECTIVO',
      items: [{ producto_id: 1, cantidad: 2, personalizacion: [1, 3] }],
    });
  });

  it('el retiro en el local viaja como direccion_id null', () => {
    expect(armarPedido({ direccionId: null, formaPago: 'MERCADOPAGO', notas: '' }, lineas)).toMatchObject({ direccion_id: null });
  });

  it('las notas se recortan y solo viajan si quedó texto', () => {
    expect(armarPedido({ direccionId: 4, formaPago: 'EFECTIVO', notas: '  Timbre 3B \n' }, lineas)).toMatchObject({ notas: 'Timbre 3B' });
    expect(armarPedido({ direccionId: 4, formaPago: 'EFECTIVO', notas: ' \n ' }, lineas)).not.toHaveProperty('notas');
  });
});
