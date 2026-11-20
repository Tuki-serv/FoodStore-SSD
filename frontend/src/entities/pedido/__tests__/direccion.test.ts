import { describe, expect, it } from 'vitest';
import { direccionDto } from '@/test/msw/pedidos';
import { lineasDireccion } from '../model';

describe('lineasDireccion', () => {
  it('arma alias, calle con referencia y zona con provincia y código postal', () => {
    const direccion = direccionDto({ id: 4, linea2: 'Timbre 2', provincia: 'Buenos Aires', codigo_postal: '1636' });

    expect(lineasDireccion(direccion)).toEqual({ alias: 'Casa', calle: 'Av. Siempre Viva 742, Timbre 2', zona: 'Springfield, Buenos Aires · CP 1636' });
  });

  it('omite lo que no hay: sin alias, referencia, provincia ni código postal', () => {
    const direccion = direccionDto({ id: 5, alias: null, linea1: 'Belgrano 455', ciudad: 'Mendoza' });

    expect(lineasDireccion(direccion)).toEqual({ alias: '', calle: 'Belgrano 455', zona: 'Mendoza' });
  });

  it('trata los textos vacíos como ausentes', () => {
    const direccion = direccionDto({ id: 6, linea2: '', provincia: '', codigo_postal: '' });

    expect(lineasDireccion(direccion)).toMatchObject({ calle: 'Av. Siempre Viva 742', zona: 'Springfield' });
  });
});
