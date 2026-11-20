import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { eventoDto } from '@/test/msw/pedidos';
import { autorEventoCliente, type EventoHistorial } from '../model';
import { LineaTiempoHistorial } from '../ui';

const local = (dia: number, hora: number, minuto: number) => new Date(2026, 10, dia, hora, minuto).toISOString();

const HISTORIAL = [
  eventoDto({ id: 1, pedido_id: 58, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_nombre: 'Ana López', created_at: local(19, 12, 40) }),
  eventoDto({ id: 2, pedido_id: 58, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', motivo: null, usuario_id: 9, usuario_nombre: 'Carla', created_at: local(19, 12, 42) }),
  eventoDto({ id: 3, pedido_id: 58, estado_desde: 'CONFIRMADO', estado_hacia: 'EN_PREP', motivo: 'Sale en 20 min', usuario_id: 9, usuario_nombre: 'Carla', created_at: local(19, 12, 44) }),
];

describe('LineaTiempoHistorial', () => {
  it('muestra los eventos en el orden del servidor con título, autor, fecha y hora', () => {
    render(<LineaTiempoHistorial eventos={HISTORIAL} />);

    const items = within(screen.getByRole('list', { name: 'Historial del pedido' })).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Pedido creado');
    expect(items[0]).toHaveTextContent('Ana López · 19/11/2026 a las 12:40');
    expect(items[1]).toHaveTextContent('Confirmado');
    expect(items[1]).toHaveTextContent('Carla · 19/11/2026 a las 12:42');
    expect(items[2]).toHaveTextContent('En preparación');
    expect(items[2]).toHaveTextContent('Sale en 20 min');
  });

  it('no repite el motivo inicial «Pedido creado» como observación', () => {
    render(<LineaTiempoHistorial eventos={HISTORIAL.slice(0, 1)} />);

    expect(screen.getAllByText('Pedido creado')).toHaveLength(1);
  });

  it('un cambio sin usuario lo atribuye al Sistema', () => {
    render(
      <LineaTiempoHistorial
        eventos={[eventoDto({ id: 5, pedido_id: 57, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', usuario_id: null, usuario_nombre: null, created_at: local(19, 12, 33) })]}
      />,
    );

    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('resalta la cancelación y muestra su motivo', () => {
    render(
      <LineaTiempoHistorial
        eventos={[eventoDto({ id: 6, pedido_id: 51, estado_desde: 'PENDIENTE', estado_hacia: 'CANCELADO', motivo: 'El cliente no responde', usuario_nombre: 'Carla', created_at: local(19, 10, 40) })]}
      />,
    );

    const item = screen.getByRole('listitem');

    expect(item).toHaveClass('is-cancel');
    expect(item).toHaveTextContent('Cancelado');
    expect(item).toHaveTextContent('El cliente no responde');
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(<LineaTiempoHistorial eventos={HISTORIAL} />);

    await esperarSinViolacionesA11y(container);
  });

  describe('con el autor del cliente (autorEventoCliente)', () => {
    const delCliente = (evento: EventoHistorial) => autorEventoCliente(evento, 1);

    it('muestra «Vos», «El local» y «Automático» y no el nombre del personal', () => {
      const eventos = [
        HISTORIAL[0] as EventoHistorial,
        eventoDto({ id: 2, pedido_id: 58, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', usuario_id: null, usuario_nombre: null, created_at: local(19, 12, 41) }),
        HISTORIAL[1] as EventoHistorial,
      ];
      render(<LineaTiempoHistorial eventos={eventos} autor={delCliente} />);

      const items = within(screen.getByRole('list', { name: 'Historial del pedido' })).getAllByRole('listitem');

      expect(items[0]).toHaveTextContent('Vos · 19/11/2026 a las 12:40');
      expect(items[1]).toHaveTextContent('Automático · 19/11/2026 a las 12:41');
      expect(items[2]).toHaveTextContent('El local · 19/11/2026 a las 12:42');
      expect(screen.queryByText(/Carla/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Ana López/)).not.toBeInTheDocument();
    });

    it('«Automático» lleva el estilo del sistema y «El local» el del autor', () => {
      render(<LineaTiempoHistorial eventos={[eventoDto({ id: 2, pedido_id: 58, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', usuario_id: null, usuario_nombre: null }), HISTORIAL[2] as EventoHistorial]} autor={delCliente} />);

      expect(screen.getByText('Automático')).toHaveClass('sys');
      expect(screen.getByText('El local').tagName).toBe('B');
    });

    it('no tiene violaciones de accesibilidad', async () => {
      const { container } = render(<LineaTiempoHistorial eventos={HISTORIAL} autor={delCliente} />);

      await esperarSinViolacionesA11y(container);
    });
  });
});
