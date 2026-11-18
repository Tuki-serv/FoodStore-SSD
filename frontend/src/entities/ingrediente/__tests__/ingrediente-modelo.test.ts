import { describe, expect, it } from 'vitest';
import { resumenUso } from '../model';

const p = (id: number, nombre: string) => ({ id, nombre });

describe('resumenUso', () => {
  it('sin productos no hay aviso', () => {
    expect(resumenUso([])).toBeNull();
  });

  it('con uno usa el singular', () => {
    expect(resumenUso([p(1, 'Hamburguesa Clásica')])).toBe('Lo usa 1 producto: Hamburguesa Clásica');
  });

  it('con dos o tres lista todos los nombres', () => {
    expect(resumenUso([p(1, 'A'), p(2, 'B')])).toBe('Lo usan 2 productos: A, B');
    expect(resumenUso([p(1, 'Hamburguesa Clásica'), p(2, 'Burger BBQ Bacon'), p(3, 'Burger Sin TACC')])).toBe(
      'Lo usan 3 productos: Hamburguesa Clásica, Burger BBQ Bacon, Burger Sin TACC',
    );
  });

  it('con más de tres muestra tres y «y N más»', () => {
    expect(resumenUso([p(1, 'A'), p(2, 'B'), p(3, 'C'), p(4, 'D'), p(5, 'E')])).toBe('Lo usan 5 productos: A, B, C y 2 más');
    expect(resumenUso([p(1, 'A'), p(2, 'B'), p(3, 'C'), p(4, 'D')])).toBe('Lo usan 4 productos: A, B, C y 1 más');
  });
});
