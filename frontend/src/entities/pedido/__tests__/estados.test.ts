import { describe, expect, it } from 'vitest';
import { claseEstado, colorEstado, ESTADOS_PEDIDO, esEstadoPedido, esEstadoTerminal, etiquetaEstado } from '../model';

describe('etiquetaEstado', () => {
  it.each([
    ['PENDIENTE', 'Pendiente'],
    ['CONFIRMADO', 'Confirmado'],
    ['EN_PREP', 'En preparación'],
    ['EN_CAMINO', 'En camino'],
    ['ENTREGADO', 'Entregado'],
    ['CANCELADO', 'Cancelado'],
  ])('%s → %s', (codigo, etiqueta) => {
    expect(etiquetaEstado(codigo)).toBe(etiqueta);
  });

  it('un código desconocido se muestra tal cual', () => {
    expect(etiquetaEstado('EXTRAVIADO')).toBe('EXTRAVIADO');
  });
});

describe('claseEstado', () => {
  it.each([
    ['PENDIENTE', 'b-pendiente'],
    ['EN_PREP', 'b-en-prep'],
    ['EN_CAMINO', 'b-en-camino'],
  ])('%s → %s', (codigo, clase) => {
    expect(claseEstado(codigo)).toBe(clase);
  });

  it('un código desconocido usa la clase neutra', () => {
    expect(claseEstado('EXTRAVIADO')).toBe('b-neutro');
  });
});

describe('ESTADOS_PEDIDO / esEstadoPedido', () => {
  it('lista los seis estados en el orden de la FSM', () => {
    expect(ESTADOS_PEDIDO).toEqual(['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO']);
  });

  it.each(['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'])('%s es un estado', (codigo) => {
    expect(esEstadoPedido(codigo)).toBe(true);
  });

  it.each([['DESPACHADO'], [''], [null], ['pendiente']])('%j no es un estado', (valor) => {
    expect(esEstadoPedido(valor)).toBe(false);
  });
});

describe('esEstadoTerminal', () => {
  it.each(['ENTREGADO', 'CANCELADO'])('%s ya no cambia', (codigo) => {
    expect(esEstadoTerminal(codigo)).toBe(true);
  });

  it.each(['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO'])('%s sigue en curso', (codigo) => {
    expect(esEstadoTerminal(codigo)).toBe(false);
  });

  it('sin estado conocido (undefined, desconocido) se trata como en curso', () => {
    expect(esEstadoTerminal(undefined)).toBe(false);
    expect(esEstadoTerminal('ARCHIVADO')).toBe(false);
  });
});

describe('colorEstado', () => {
  it.each([
    ['PENDIENTE', 'var(--state-pendiente-fg)'],
    ['CONFIRMADO', 'var(--state-confirmado-fg)'],
    ['EN_PREP', 'var(--state-en-prep-fg)'],
    ['EN_CAMINO', 'var(--state-en-camino-fg)'],
    ['ENTREGADO', 'var(--state-entregado-fg)'],
    ['CANCELADO', 'var(--state-cancelado-fg)'],
  ])('%s usa el color de texto de su distintivo (%s)', (codigo, color) => {
    expect(colorEstado(codigo)).toBe(color);
  });

  it('un estado desconocido usa el gris del distintivo neutro', () => {
    expect(colorEstado('COCINA')).toBe('var(--color-text-muted)');
  });
});
