import { describe, expect, it } from 'vitest';
import { vistaPagoDelPedido, type PedidoParaVista, type VistaPagoDelPedido } from '../model';

const pedido = (parcial: Partial<PedidoParaVista> = {}): PedidoParaVista => ({ forma_pago_codigo: 'MERCADOPAGO', estado_codigo: 'PENDIENTE', ...parcial });

describe('vistaPagoDelPedido', () => {
  it.each<[string, PedidoParaVista, { estado: string | null } | null, VistaPagoDelPedido]>([
    ['pendiente sin pago → traspaso a pagar', pedido(), null, 'traspaso'],
    ['pendiente con la consulta sin intentos → traspaso a pagar', pedido(), { estado: null }, 'traspaso'],
    ['pendiente con el último intento rechazado → reintento', pedido(), { estado: 'rechazado' }, 'reintento'],
    ['pendiente con el pago pendiente → en confirmación', pedido(), { estado: 'pendiente' }, 'en-confirmacion'],
    ['pendiente con el pago aprobado → nada', pedido(), { estado: 'aprobado' }, 'nada'],
    ['pendiente con el pago a devolver → nada', pedido(), { estado: 'a_devolver' }, 'nada'],
    ['confirmado aunque el pago esté rechazado → nada', pedido({ estado_codigo: 'CONFIRMADO' }), { estado: 'rechazado' }, 'nada'],
    ['cancelado sin pago → nada', pedido({ estado_codigo: 'CANCELADO' }), null, 'nada'],
    ['efectivo pendiente → nada', pedido({ forma_pago_codigo: 'EFECTIVO' }), null, 'nada'],
    ['transferencia pendiente con pago pendiente → nada', pedido({ forma_pago_codigo: 'TRANSFERENCIA' }), { estado: 'pendiente' }, 'nada'],
  ])('%s', (_caso, ped, pago, esperada) => {
    expect(vistaPagoDelPedido(ped, pago)).toBe(esperada);
  });

  it('mientras se consulta el pago no ofrece nada (evita mostrar «Pagar» y que luego cambie)', () => {
    expect(vistaPagoDelPedido(pedido(), null, { consultando: true })).toBe('nada');
  });
});
