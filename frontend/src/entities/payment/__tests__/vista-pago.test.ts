import { describe, expect, it } from 'vitest';
import { vistaPago, type PedidoParaVista, type VistaPago } from '../model/vista-pago';

const pedido = (parcial: Partial<PedidoParaVista> = {}): PedidoParaVista => ({ forma_pago_codigo: 'MERCADOPAGO', estado_codigo: 'PENDIENTE', ...parcial });

describe('vistaPago', () => {
  it.each<[string, PedidoParaVista, { estado: string | null } | null, VistaPago]>([
    ['pago aprobado con pedido CONFIRMADO', pedido({ estado_codigo: 'CONFIRMADO' }), { estado: 'aprobado' }, 'aprobado'],
    ['pago aprobado aunque el pedido siga PENDIENTE (respuesta del POST)', pedido(), { estado: 'aprobado' }, 'aprobado'],
    ['pago a_devolver con pedido CANCELADO', pedido({ estado_codigo: 'CANCELADO' }), { estado: 'a_devolver' }, 'a-devolver'],
    ['pago pendiente', pedido(), { estado: 'pendiente' }, 'pendiente'],
    ['pedido EFECTIVO sin pago', pedido({ forma_pago_codigo: 'EFECTIVO' }), null, 'no-tarjeta'],
    ['pedido TRANSFERENCIA con pago null', pedido({ forma_pago_codigo: 'TRANSFERENCIA' }), { estado: null }, 'no-tarjeta'],
    ['pedido CANCELADO sin pago', pedido({ estado_codigo: 'CANCELADO' }), null, 'no-pagable'],
    ['pedido CONFIRMADO sin pago aprobado', pedido({ estado_codigo: 'CONFIRMADO' }), { estado: null }, 'no-pagable'],
    ['pago rechazado con pedido PENDIENTE', pedido(), { estado: 'rechazado' }, 'rechazado'],
    ['sin intentos con pedido PENDIENTE', pedido(), { estado: null }, 'formulario'],
    ['sin pago consultado con pedido PENDIENTE', pedido(), null, 'formulario'],
  ])('%s -> %s', (_caso, ped, pago, esperada) => {
    expect(vistaPago(ped, pago)).toBe(esperada);
  });

  it('la precedencia pone aprobado por encima de la forma de pago y del estado del pedido', () => {
    expect(vistaPago(pedido({ forma_pago_codigo: 'EFECTIVO', estado_codigo: 'CANCELADO' }), { estado: 'aprobado' })).toBe('aprobado');
  });

  it('un pago rechazado de un pedido ya CANCELADO no vuelve a mostrar el formulario', () => {
    expect(vistaPago(pedido({ estado_codigo: 'CANCELADO' }), { estado: 'rechazado' })).toBe('no-pagable');
  });
});
