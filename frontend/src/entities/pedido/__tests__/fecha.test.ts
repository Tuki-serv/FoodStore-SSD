import { describe, expect, it } from 'vitest';
import { fechaHoraCorta, fechaLocal, horaLocal } from '../model';

const local = (anio: number, mes: number, dia: number, hora: number, minuto: number) => new Date(anio, mes - 1, dia, hora, minuto).toISOString();

describe('formato de fecha y hora local', () => {
  it('arma día/mes/año y hora con ceros a la izquierda', () => {
    const iso = local(2026, 11, 9, 8, 5);

    expect(fechaLocal(iso)).toBe('09/11/2026');
    expect(horaLocal(iso)).toBe('08:05');
  });

  it('la forma corta del listado omite el año', () => {
    expect(fechaHoraCorta(local(2026, 11, 19, 12, 40))).toBe('19/11 · 12:40');
    expect(fechaHoraCorta(local(2026, 1, 2, 23, 59))).toBe('02/01 · 23:59');
  });

  it('una fecha inválida no rompe: devuelve vacío', () => {
    expect(fechaLocal('no-es-fecha')).toBe('');
    expect(horaLocal('no-es-fecha')).toBe('');
  });
});
