import { describe, expect, it } from 'vitest';
import { accionesGestion, proximoAvance } from '../model';

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
