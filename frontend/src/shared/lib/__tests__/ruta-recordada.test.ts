import { describe, expect, it } from 'vitest';
import { rutaRecordada } from '../ruta-recordada';

describe('rutaRecordada', () => {
  it('toma path, query y hash de la ubicación como objeto literal', () => {
    expect(rutaRecordada({ pathname: '/catalogo', search: '?categoria=2&page=2', hash: '' })).toEqual({
      pathname: '/catalogo',
      search: '?categoria=2&page=2',
      hash: '',
    });
  });

  it('descarta el resto de los campos de la ubicación (state, key)', () => {
    const ubicacion = { pathname: '/catalogo/7', search: '', hash: '#a', state: { volverA: '?x=1' }, key: 'k1' };

    expect(rutaRecordada(ubicacion)).toEqual({ pathname: '/catalogo/7', search: '', hash: '#a' });
  });
});
