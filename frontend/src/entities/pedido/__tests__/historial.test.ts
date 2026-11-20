import { describe, expect, it } from 'vitest';
import { autorEvento, tituloEvento, type EventoHistorial } from '../model';

const evento = (cambios: Partial<EventoHistorial>): EventoHistorial => ({
  id: 1,
  pedido_id: 58,
  estado_desde: 'PENDIENTE',
  estado_hacia: 'CONFIRMADO',
  motivo: null,
  usuario_id: 7,
  usuario_nombre: 'Carla',
  created_at: '2026-11-19T15:00:00Z',
  ...cambios,
});

describe('tituloEvento', () => {
  it('el evento sin estado de origen es la creación del pedido', () => {
    expect(tituloEvento(evento({ estado_desde: null, estado_hacia: 'PENDIENTE' }))).toBe('Pedido creado');
  });

  it.each([
    ['CONFIRMADO', 'Confirmado'],
    ['EN_PREP', 'En preparación'],
    ['CANCELADO', 'Cancelado'],
  ])('un cambio a %s se titula «%s»', (destino, titulo) => {
    expect(tituloEvento(evento({ estado_hacia: destino }))).toBe(titulo);
  });
});

describe('autorEvento', () => {
  it('usa el nombre cuando lo hay', () => {
    expect(autorEvento(evento({}))).toBe('Carla');
  });

  it('sin usuario es el Sistema', () => {
    expect(autorEvento(evento({ usuario_id: null, usuario_nombre: null }))).toBe('Sistema');
  });

  it('con usuario pero sin nombre muestra su número', () => {
    expect(autorEvento(evento({ usuario_id: 7, usuario_nombre: null }))).toBe('Usuario #7');
  });
});
