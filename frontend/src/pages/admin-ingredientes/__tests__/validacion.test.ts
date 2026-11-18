import { describe, expect, it } from 'vitest';
import { aCuerpoIngrediente, cambiosIngrediente, validarIngrediente, type ValoresIngrediente } from '../model';

const base: ValoresIngrediente = { nombre: 'Maní', descripcion: '', unidad_medida_id: '2', es_alergeno: true };

describe('validarIngrediente', () => {
  it('un nombre en blanco pide ingresarlo', () => {
    expect(validarIngrediente({ nombre: '   ' })).toEqual({ nombre: 'Ingresá un nombre.' });
  });

  it('más de 100 caracteres es inválido y un nombre válido no tiene errores', () => {
    expect(validarIngrediente({ nombre: 'a'.repeat(101) })).toEqual({ nombre: 'Máximo 100 caracteres.' });
    expect(validarIngrediente({ nombre: ' Maní ' })).toEqual({});
  });
});

describe('aCuerpoIngrediente', () => {
  it('recorta el nombre, deja la descripción vacía como null y convierte la unidad a número', () => {
    expect(aCuerpoIngrediente({ ...base, nombre: '  Maní ' })).toEqual({ nombre: 'Maní', descripcion: null, es_alergeno: true, unidad_medida_id: 2 });
  });

  it('conserva la descripción recortada y es_alergeno falso', () => {
    expect(aCuerpoIngrediente({ ...base, descripcion: ' Tostado ', es_alergeno: false, unidad_medida_id: '5' })).toEqual({
      nombre: 'Maní',
      descripcion: 'Tostado',
      es_alergeno: false,
      unidad_medida_id: 5,
    });
  });
});

describe('cambiosIngrediente', () => {
  it('sin cambios devuelve un objeto vacío', () => {
    expect(cambiosIngrediente(base, { ...base, nombre: ' Maní ' })).toEqual({});
  });

  it('devuelve solo los campos cambiados', () => {
    expect(cambiosIngrediente(base, { ...base, es_alergeno: false })).toEqual({ es_alergeno: false });
    expect(cambiosIngrediente(base, { ...base, nombre: 'Maní tostado', descripcion: 'Sin sal' })).toEqual({ nombre: 'Maní tostado', descripcion: 'Sin sal' });
  });

  it('cambiar la unidad la incluye y vaciar la descripción envía null', () => {
    const conDescripcion = { ...base, descripcion: 'Sin sal' };

    expect(cambiosIngrediente(conDescripcion, { ...conDescripcion, descripcion: '', unidad_medida_id: '3' })).toEqual({ descripcion: null, unidad_medida_id: 3 });
  });
});
