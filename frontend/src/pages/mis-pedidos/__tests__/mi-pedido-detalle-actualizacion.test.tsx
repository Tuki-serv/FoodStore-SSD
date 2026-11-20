import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { eventoDto } from '@/test/msw/pedidos';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(2026, 10, 19, 12, 41, 0) });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function ocultarPestana() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('Mi pedido · actualización periódica', () => {
  it('un pedido confirmado: a los 30 s se vuelve a pedir y se ve «En preparación» con el evento nuevo', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58, { estado_codigo: 'CONFIRMADO' })] });
    expect(await screen.findByText('El local va a empezar a prepararlo.')).toBeInTheDocument();
    expect(estado.consultas).toEqual([58]);

    estado.pedidos.set(58, { ...pedidoPropio(58), estado_codigo: 'EN_PREP' });
    estado.historiales.set(58, [
      eventoDto({ id: 1, pedido_id: 58, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_id: 1 }),
      eventoDto({ id: 2, pedido_id: 58, estado_desde: 'CONFIRMADO', estado_hacia: 'EN_PREP', motivo: 'Sale en 20 min', usuario_id: 9, usuario_nombre: 'Carla' }),
    ]);
    await avanzar(31_000);

    await waitFor(() => expect(estado.consultas.length).toBeGreaterThan(1));
    expect(await screen.findByText('Tu pedido se está preparando.')).toBeInTheDocument();
    expect(await screen.findByText('Sale en 20 min')).toBeInTheDocument();
  });

  it('un pedido entregado no se vuelve a pedir y no muestra «Actualizar»', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos/41', { pedidos: [pedidoPropio(41, { estado_codigo: 'ENTREGADO' })] });
    await screen.findByRole('heading', { name: /Pedido #41/, level: 1 });
    await screen.findByRole('list', { name: 'Historial del pedido' });

    await avanzar(95_000);

    expect(estado.consultas).toEqual([41]);
    expect(estado.consultasHistorial).toEqual([41]);
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument();
  });

  it('con la pestaña oculta no hace pedidos periódicos', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await screen.findByRole('heading', { name: /Pedido #58/, level: 1 });
    const hechos = estado.consultas.length;

    ocultarPestana();
    await avanzar(95_000);

    expect(estado.consultas).toHaveLength(hechos);
  });

  it('«Actualizar» pide en el momento y cambia «Actualizado a las HH:MM»', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await screen.findByRole('heading', { name: /Pedido #58/, level: 1 });
    expect(await screen.findByText('Actualizado a las 12:41')).toBeInTheDocument();
    const hechos = estado.consultas.length;

    vi.setSystemTime(new Date(2026, 10, 19, 12, 44, 0));
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(estado.consultas).toHaveLength(hechos + 1));
    expect(await screen.findByText('Actualizado a las 12:44')).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad con el historial', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await screen.findByRole('list', { name: 'Historial del pedido' });

    await esperarSinViolacionesA11y(document.body);
  });
});
