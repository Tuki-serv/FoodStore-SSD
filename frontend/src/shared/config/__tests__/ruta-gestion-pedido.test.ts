import { describe, expect, it } from 'vitest';
import { RUTA_GESTION_PEDIDO, rutaGestionPedido } from '..';

describe('rutaGestionPedido', () => {
  it.each([
    [58, '/gestion-pedidos/58'],
    [7, '/gestion-pedidos/7'],
  ])('arma el path del detalle del pedido %i', (id, path) => {
    expect(rutaGestionPedido(id)).toBe(path);
  });

  it('RUTA_GESTION_PEDIDO es el patrón del router', () => {
    expect(RUTA_GESTION_PEDIDO).toBe('/gestion-pedidos/:pedidoId');
  });
});
