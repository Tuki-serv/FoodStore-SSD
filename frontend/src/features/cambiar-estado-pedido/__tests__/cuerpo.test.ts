import { describe, expect, it } from 'vitest';
import { armarCambio, tituloAviso } from '../model';

describe('armarCambio', () => {
  it.each(['', '   ', '\n\t'])('sin texto («%s») no envía motivo', (texto) => {
    expect(armarCambio('EN_PREP', texto)).toEqual({ nuevo_estado: 'EN_PREP' });
  });

  it('con texto envía el motivo recortado', () => {
    expect(armarCambio('CANCELADO', '  Sin stock  ')).toEqual({ nuevo_estado: 'CANCELADO', motivo: 'Sin stock' });
  });
});

describe('tituloAviso', () => {
  it.each([
    ['CONFIRMADO', 'Pedido #58 confirmado'],
    ['EN_PREP', 'Pedido #58 en preparación'],
    ['EN_CAMINO', 'Pedido #58 en camino'],
    ['ENTREGADO', 'Pedido #58 entregado'],
    ['CANCELADO', 'Pedido #58 cancelado'],
  ] as const)('%s → «%s»', (destino, esperado) => {
    expect(tituloAviso(58, destino)).toBe(esperado);
  });
});
