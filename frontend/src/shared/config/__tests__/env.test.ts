import { describe, expect, it } from 'vitest';
import { readConfig } from '../env';

describe('readConfig', () => {
  it('expone VITE_API_URL tal cual', () => {
    expect(readConfig({ VITE_API_URL: 'http://localhost:8000' })).toEqual({ apiUrl: 'http://localhost:8000' });
  });

  it('falla nombrando VITE_API_URL cuando falta', () => {
    expect(() => readConfig({})).toThrow(/VITE_API_URL/);
  });

  it('falla nombrando VITE_API_URL cuando está vacía', () => {
    expect(() => readConfig({ VITE_API_URL: '' })).toThrow(/VITE_API_URL/);
  });
});

describe('readConfig con una URL inválida', () => {
  it.each(['no-es-url', 'ftp://servidor/archivo'])('rechaza %s nombrando VITE_API_URL', (valor) => {
    expect(() => readConfig({ VITE_API_URL: valor })).toThrow(/VITE_API_URL.*URL http\(s\)/);
  });

  it('acepta https con puerto y ruta', () => {
    expect(readConfig({ VITE_API_URL: 'https://api.ejemplo.com:8443/v1' }).apiUrl).toBe('https://api.ejemplo.com:8443/v1');
  });
});
