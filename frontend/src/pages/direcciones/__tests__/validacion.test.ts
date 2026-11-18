import { describe, expect, it } from 'vitest';
import { aDireccionDatos, validarDireccion, valoresIniciales, type ValoresFormulario } from '../model';

const validos: ValoresFormulario = {
  alias: 'Casa',
  linea1: 'Av. Siempre Viva 742',
  linea2: '',
  ciudad: 'Mendoza',
  provincia: '',
  codigo_postal: '',
};

describe('validarDireccion', () => {
  it('linea1 en blanco y ciudad vacía devuelven los dos errores de obligatorios', () => {
    expect(validarDireccion({ ...validos, linea1: '   ', ciudad: '' })).toEqual({
      linea1: 'Ingresá la calle y el número',
      ciudad: 'Ingresá la ciudad',
    });
  });

  it('valores válidos no devuelven errores', () => {
    expect(validarDireccion(validos)).toEqual({});
  });

  it('alias de 51 caracteres falla y de 50 es válido', () => {
    expect(validarDireccion({ ...validos, alias: 'a'.repeat(51) })).toEqual({ alias: 'Máximo 50 caracteres' });
    expect(validarDireccion({ ...validos, alias: 'a'.repeat(50) })).toEqual({});
  });

  it('ciudad de 101 caracteres falla y de 100 es válida', () => {
    expect(validarDireccion({ ...validos, ciudad: 'c'.repeat(101) })).toEqual({ ciudad: 'Máximo 100 caracteres' });
    expect(validarDireccion({ ...validos, ciudad: 'c'.repeat(100) })).toEqual({});
  });

  it('provincia de 101 caracteres falla y de 100 es válida', () => {
    expect(validarDireccion({ ...validos, provincia: 'p'.repeat(101) })).toEqual({ provincia: 'Máximo 100 caracteres' });
    expect(validarDireccion({ ...validos, provincia: 'p'.repeat(100) })).toEqual({});
  });

  it('código postal de 11 caracteres falla y de 10 es válido', () => {
    expect(validarDireccion({ ...validos, codigo_postal: 'M5500ABCDEF' })).toEqual({ codigo_postal: 'Máximo 10 caracteres' });
    expect(validarDireccion({ ...validos, codigo_postal: 'M5500ABCDE' })).toEqual({});
  });

  it('mide el largo después de recortar los espacios', () => {
    expect(validarDireccion({ ...validos, alias: `  ${'a'.repeat(50)}  ` })).toEqual({});
  });

  it('no valida el formato del código postal (OQ-3)', () => {
    expect(validarDireccion({ ...validos, codigo_postal: 'abc' })).toEqual({});
  });
});

describe('aDireccionDatos', () => {
  it('recorta los textos y manda null en los opcionales vacíos', () => {
    expect(aDireccionDatos({ ...validos, alias: ' Casa ', linea1: ' Av. Siempre Viva 742 ' })).toEqual({
      alias: 'Casa',
      linea1: 'Av. Siempre Viva 742',
      linea2: null,
      ciudad: 'Mendoza',
      provincia: null,
      codigo_postal: null,
    });
  });

  it('conserva los opcionales con contenido', () => {
    expect(aDireccionDatos({ ...validos, linea2: ' piso 3 ', provincia: 'Mendoza', codigo_postal: '5500' })).toMatchObject({
      linea2: 'piso 3',
      provincia: 'Mendoza',
      codigo_postal: '5500',
    });
  });

  it('linea1 y ciudad son siempre string: asignarles null no compila', () => {
    const datos = aDireccionDatos(validos);

    // @ts-expect-error linea1 es NOT NULL en el backend: su tipo no admite null
    datos.linea1 = null;
    // @ts-expect-error ciudad es NOT NULL en el backend: su tipo no admite null
    datos.ciudad = null;

    expect(typeof aDireccionDatos({ ...validos, linea1: '   ', ciudad: '' }).linea1).toBe('string');
    expect(typeof aDireccionDatos({ ...validos, linea1: '   ', ciudad: '' }).ciudad).toBe('string');
  });
});

describe('valoresIniciales', () => {
  it('sin dirección devuelve todos los campos vacíos', () => {
    expect(valoresIniciales()).toEqual({ alias: '', linea1: '', linea2: '', ciudad: '', provincia: '', codigo_postal: '' });
  });

  it('con una dirección copia sus datos y convierte los null en cadena vacía', () => {
    const trabajo = {
      id: 2,
      usuario_id: 1,
      alias: 'Trabajo',
      linea1: 'Belgrano 455',
      linea2: null,
      ciudad: 'Godoy Cruz',
      provincia: null,
      codigo_postal: '5501',
      es_principal: false,
    };

    expect(valoresIniciales(trabajo)).toEqual({
      alias: 'Trabajo',
      linea1: 'Belgrano 455',
      linea2: '',
      ciudad: 'Godoy Cruz',
      provincia: '',
      codigo_postal: '5501',
    });
  });
});
