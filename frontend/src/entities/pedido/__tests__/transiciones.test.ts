import { describe, expect, it } from 'vitest';
import { accionesGestion, pasosProgreso, proximoAvance, puedeCancelarCliente } from '../model';

const etiquetas = (estado: string, forma: string) => accionesGestion(estado, forma).map((accion) => accion.etiqueta);

describe('accionesGestion (espejo de backend/app/modules/pedidos/fsm.py)', () => {
  it.each(['EFECTIVO', 'TRANSFERENCIA'])('PENDIENTE + %s ofrece confirmar el pago y cancelar', (forma) => {
    expect(accionesGestion('PENDIENTE', forma)).toEqual([
      { destino: 'CONFIRMADO', etiqueta: 'Confirmar pago', tipo: 'confirmar-pago' },
      { destino: 'CANCELADO', etiqueta: 'Cancelar pedido', tipo: 'cancelar' },
    ]);
  });

  it('PENDIENTE + MERCADOPAGO solo ofrece cancelar (se confirma con el pago aprobado)', () => {
    expect(accionesGestion('PENDIENTE', 'MERCADOPAGO')).toEqual([
      { destino: 'CANCELADO', etiqueta: 'Cancelar pedido', tipo: 'cancelar' },
    ]);
  });

  it.each(['EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO'])('CONFIRMADO + %s pasa a preparación o cancela', (forma) => {
    expect(etiquetas('CONFIRMADO', forma)).toEqual(['Pasar a preparación', 'Cancelar pedido']);
  });

  it.each(['EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO'])('EN_PREP + %s despacha o cancela', (forma) => {
    expect(etiquetas('EN_PREP', forma)).toEqual(['Despachar', 'Cancelar pedido']);
  });

  it.each(['EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO'])('EN_CAMINO + %s solo marca entregado', (forma) => {
    expect(accionesGestion('EN_CAMINO', forma)).toEqual([
      { destino: 'ENTREGADO', etiqueta: 'Marcar entregado', tipo: 'avance' },
    ]);
  });

  it.each(['ENTREGADO', 'CANCELADO'])('%s es terminal: sin acciones en ninguna forma de pago', (estado) => {
    for (const forma of ['EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO']) expect(accionesGestion(estado, forma)).toEqual([]);
  });

  it('un estado desconocido no ofrece acciones', () => {
    expect(accionesGestion('ARCHIVADO', 'EFECTIVO')).toEqual([]);
  });
});

describe('proximoAvance', () => {
  it.each([
    ['PENDIENTE', 'EFECTIVO', 'Confirmar pago'],
    ['PENDIENTE', 'TRANSFERENCIA', 'Confirmar pago'],
    ['CONFIRMADO', 'MERCADOPAGO', 'Pasar a preparación'],
    ['EN_PREP', 'EFECTIVO', 'Despachar'],
    ['EN_CAMINO', 'TRANSFERENCIA', 'Marcar entregado'],
  ])('%s + %s → «%s»', (estado, forma, etiqueta) => {
    expect(proximoAvance(estado, forma)?.etiqueta).toBe(etiqueta);
  });

  it.each([
    ['PENDIENTE', 'MERCADOPAGO'],
    ['ENTREGADO', 'EFECTIVO'],
    ['CANCELADO', 'MERCADOPAGO'],
    ['ARCHIVADO', 'EFECTIVO'],
  ])('%s + %s no tiene avance', (estado, forma) => {
    expect(proximoAvance(estado, forma)).toBeNull();
  });
});

describe('puedeCancelarCliente (espejo de TRANSICIONES[CLIENT] en fsm.py)', () => {
  it.each(['PENDIENTE', 'CONFIRMADO'])('%s se puede cancelar', (estado) => {
    expect(puedeCancelarCliente(estado)).toBe(true);
  });

  it.each(['EN_PREP', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO', 'ARCHIVADO', ''])('«%s» no se puede cancelar', (estado) => {
    expect(puedeCancelarCliente(estado)).toBe(false);
  });
});

describe('pasosProgreso', () => {
  const resumen = (estado: string, conEnvio = true) => pasosProgreso(estado, conEnvio)?.map((paso) => `${paso.etiqueta}:${paso.estado}`);

  it('PENDIENTE tiene el paso 1 como actual y el resto pendiente', () => {
    expect(resumen('PENDIENTE')).toEqual(['Pendiente:actual', 'Confirmado:pendiente', 'En preparación:pendiente', 'En camino:pendiente', 'Entregado:pendiente']);
  });

  it('EN_PREP cumple los pasos 1 y 2 y tiene el 3 como actual', () => {
    expect(resumen('EN_PREP')).toEqual(['Pendiente:cumplido', 'Confirmado:cumplido', 'En preparación:actual', 'En camino:pendiente', 'Entregado:pendiente']);
  });

  it('CONFIRMADO y EN_CAMINO avanzan el paso actual', () => {
    expect(resumen('CONFIRMADO')?.map((paso) => paso.split(':')[1])).toEqual(['cumplido', 'actual', 'pendiente', 'pendiente', 'pendiente']);
    expect(resumen('EN_CAMINO')?.map((paso) => paso.split(':')[1])).toEqual(['cumplido', 'cumplido', 'cumplido', 'actual', 'pendiente']);
  });

  it('ENTREGADO los cumple todos y no deja paso actual', () => {
    expect(resumen('ENTREGADO')?.map((paso) => paso.split(':')[1])).toEqual(['cumplido', 'cumplido', 'cumplido', 'cumplido', 'cumplido']);
  });

  it('sin envío el paso 4 se llama «Listo para retirar»', () => {
    expect(resumen('EN_CAMINO', false)).toEqual(['Pendiente:cumplido', 'Confirmado:cumplido', 'En preparación:cumplido', 'Listo para retirar:actual', 'Entregado:pendiente']);
  });

  it.each(['CANCELADO', 'ARCHIVADO'])('%s no tiene pasos (null)', (estado) => {
    expect(pasosProgreso(estado, true)).toBeNull();
  });

  it('cada paso conserva el código de su estado', () => {
    expect(pasosProgreso('PENDIENTE', true)?.map((paso) => paso.codigo)).toEqual(['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO']);
  });
});
