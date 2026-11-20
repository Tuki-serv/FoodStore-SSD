import { describe, expect, it } from 'vitest';
import { RUTA_MI_PEDIDO, rutaMiPedido } from '..';

describe('rutaMiPedido', () => {
  it.each([
    [58, '/mis-pedidos/58'],
    [7, '/mis-pedidos/7'],
  ])('arma el path del detalle del pedido %i', (id, path) => {
    expect(rutaMiPedido(id)).toBe(path);
  });

  it('RUTA_MI_PEDIDO es el patrón del router', () => {
    expect(RUTA_MI_PEDIDO).toBe('/mis-pedidos/:pedidoId');
  });
});
