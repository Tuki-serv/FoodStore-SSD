import { describe, expect, it } from 'vitest';
import { aCuerpoCategoria, cambiosCategoria, validarCategoria, type ValoresCategoria } from '../model';

const vacios: ValoresCategoria = { nombre: '', descripcion: '', parent_id: '', imagen_url: '' };

describe('validarCategoria', () => {
  it('un nombre en blanco pide ingresarlo', () => {
    expect(validarCategoria({ nombre: '   ' })).toEqual({ nombre: 'Ingresá un nombre.' });
    expect(validarCategoria({ nombre: '' })).toEqual({ nombre: 'Ingresá un nombre.' });
  });

  it('más de 100 caracteres (tras recortar) es inválido y 100 justos es válido', () => {
    expect(validarCategoria({ nombre: 'a'.repeat(101) })).toEqual({ nombre: 'Máximo 100 caracteres.' });
    expect(validarCategoria({ nombre: ` ${'a'.repeat(100)} ` })).toEqual({});
  });

  it('un nombre válido no tiene errores', () => {
    expect(validarCategoria({ nombre: '  Aguas ' })).toEqual({});
  });
});

describe('aCuerpoCategoria', () => {
  it('recorta, deja los opcionales vacíos como null y la imagen vacía como cadena vacía', () => {
    expect(aCuerpoCategoria({ ...vacios, nombre: '  Aguas  ' })).toEqual({ nombre: 'Aguas', parent_id: null, descripcion: null, imagen_url: '' });
  });

  it('convierte el padre elegido a número y conserva descripción e imagen recortadas', () => {
    expect(aCuerpoCategoria({ nombre: 'Aguas', descripcion: ' Con y sin gas ', parent_id: '2', imagen_url: ' https://x.test/a.png ' })).toEqual({
      nombre: 'Aguas',
      parent_id: 2,
      descripcion: 'Con y sin gas',
      imagen_url: 'https://x.test/a.png',
    });
  });
});

describe('cambiosCategoria', () => {
  const inicial: ValoresCategoria = { nombre: 'Hamburguesas', descripcion: 'Nuestras burgers', parent_id: '', imagen_url: '' };

  it('sin cambios devuelve un objeto vacío (también si solo cambian espacios)', () => {
    expect(cambiosCategoria(inicial, { ...inicial })).toEqual({});
    expect(cambiosCategoria(inicial, { ...inicial, nombre: ' Hamburguesas ' })).toEqual({});
  });

  it('devuelve solo los campos cambiados', () => {
    expect(cambiosCategoria(inicial, { ...inicial, nombre: 'Burgers' })).toEqual({ nombre: 'Burgers' });
    expect(cambiosCategoria(inicial, { ...inicial, parent_id: '2', imagen_url: 'https://x.test/b.png' })).toEqual({
      parent_id: 2,
      imagen_url: 'https://x.test/b.png',
    });
  });

  it('mover a raíz (padre vacío) envía parent_id null y vaciar la descripción envía null', () => {
    const conPadre = { ...inicial, parent_id: '2' };

    expect(cambiosCategoria(conPadre, { ...conPadre, parent_id: '', descripcion: '' })).toEqual({ parent_id: null, descripcion: null });
  });
});
