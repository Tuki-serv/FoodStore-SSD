import { describe, expect, it } from 'vitest';
import { queSigue, type PedidoParaSeguimiento } from '../model';

const pedido = (parcial: Partial<PedidoParaSeguimiento> = {}): PedidoParaSeguimiento => ({ estado_codigo: 'PENDIENTE', forma_pago_codigo: 'EFECTIVO', conEnvio: true, ...parcial });
const entregadoEl = new Date(2026, 10, 19, 15, 10).toISOString();

describe('queSigue', () => {
  it.each(['EFECTIVO', 'TRANSFERENCIA'])('PENDIENTE + %s espera que el local reciba el pago', (forma) => {
    expect(queSigue(pedido({ forma_pago_codigo: forma }), null)).toBe('El local confirma tu pedido cuando recibe el pago.');
  });

  it('PENDIENTE + MERCADOPAGO espera la aprobación del pago', () => {
    expect(queSigue(pedido({ forma_pago_codigo: 'MERCADOPAGO' }), null)).toBe('Se confirma cuando Mercado Pago aprueba el pago.');
  });

  it.each([
    ['CONFIRMADO', 'El local va a empezar a prepararlo.'],
    ['EN_PREP', 'Tu pedido se está preparando.'],
  ])('%s → «%s»', (estado, texto) => {
    expect(queSigue(pedido({ estado_codigo: estado }), null)).toBe(texto);
  });

  it('EN_CAMINO con envío va en camino y sin envío está listo para retirar', () => {
    expect(queSigue(pedido({ estado_codigo: 'EN_CAMINO' }), null)).toBe('Tu pedido va en camino.');
    expect(queSigue(pedido({ estado_codigo: 'EN_CAMINO', conEnvio: false }), null)).toBe('Tu pedido está listo para retirar.');
  });

  it('ENTREGADO dice cuándo, con la fecha del evento', () => {
    expect(queSigue(pedido({ estado_codigo: 'ENTREGADO' }), entregadoEl)).toBe('Entregado el 19/11 a las 15:10.');
  });

  it('ENTREGADO sin el evento (historial no cargado) no inventa una fecha', () => {
    expect(queSigue(pedido({ estado_codigo: 'ENTREGADO' }), null)).toBe('Tu pedido fue entregado.');
  });

  it('un estado desconocido no dice nada', () => {
    expect(queSigue(pedido({ estado_codigo: 'ARCHIVADO' }), null)).toBeNull();
  });
});
