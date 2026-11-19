import { describe, expect, it } from 'vitest';
import { claseEstado, etiquetaEstado } from '../model';

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
