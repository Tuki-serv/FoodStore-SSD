import { describe, expect, it } from 'vitest';
import { direccionPorDefecto, nombreDireccion, type Direccion } from '../index';

function direccion(datos: Partial<Direccion> & Pick<Direccion, 'id'>): Direccion {
  return {
    usuario_id: 1,
    alias: null,
    linea1: 'Calle 1',
    linea2: null,
    ciudad: 'Mendoza',
    provincia: null,
    codigo_postal: null,
    es_principal: false,
    ...datos,
  };
}

describe('direccionPorDefecto', () => {
  it('elige la principal aunque no sea la primera', () => {
    const lista = [direccion({ id: 1, alias: 'Casa' }), direccion({ id: 2, alias: 'Trabajo', es_principal: true })];

    expect(direccionPorDefecto(lista)).toBe(2);
  });

  it('sin principal elige la primera de la lista', () => {
    expect(direccionPorDefecto([direccion({ id: 5 }), direccion({ id: 9 })])).toBe(5);
  });

  it('con la lista vacía devuelve null', () => {
    expect(direccionPorDefecto([])).toBeNull();
  });
});

describe('nombreDireccion', () => {
  it('usa el alias recortado cuando existe', () => {
    expect(nombreDireccion(direccion({ id: 1, alias: ' Trabajo ' }))).toBe('Trabajo');
  });

  it('sin alias o con alias en blanco usa la línea 1', () => {
    expect(nombreDireccion(direccion({ id: 1, alias: null, linea1: 'Ruta 40 km 3200' }))).toBe('Ruta 40 km 3200');
    expect(nombreDireccion(direccion({ id: 2, alias: '   ', linea1: 'Belgrano 455' }))).toBe('Belgrano 455');
  });
});
