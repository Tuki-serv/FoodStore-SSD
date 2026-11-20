import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Mis pedidos · actualización periódica', () => {
  it('con un pedido en curso, a los 30 s se vuelve a pedir y cambia el estado mostrado', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58, { estado_codigo: 'CONFIRMADO' })] });
    const fila = await screen.findByRole('link', { name: '#58' });
    expect(fila.closest('li')).toHaveTextContent('Confirmado');
    expect(estado.consultasLista).toHaveLength(1);

    estado.pedidos.set(58, { ...pedidoPropio(58), estado_codigo: 'EN_PREP' });
    await avanzar(29_000);
    expect(estado.consultasLista).toHaveLength(1);
    await avanzar(1_500);

    await waitFor(() => expect(estado.consultasLista).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('link', { name: '#58' }).closest('li')).toHaveTextContent('En preparación'));
  });

  it('con todos los pedidos terminados no se vuelve a pedir', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(41, { estado_codigo: 'ENTREGADO' }), pedidoPropio(44, { estado_codigo: 'CANCELADO' })] });
    await screen.findByRole('link', { name: '#41' });

    await avanzar(95_000);

    expect(estado.consultasLista).toHaveLength(1);
  });

  it('con la pestaña oculta no hace pedidos periódicos', async () => {
    const { estado } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)] });
    await screen.findByRole('link', { name: '#58' });
    const hechos = estado.consultasLista.length;

    ocultarPestana();
    await avanzar(95_000);

    expect(estado.consultasLista).toHaveLength(hechos);
  });

  it('«Actualizar» pide en el momento y cambia la hora, aunque todos hayan terminado', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(41, { estado_codigo: 'ENTREGADO' })] });
    await screen.findByRole('link', { name: '#41' });
    expect(await screen.findByText('Actualizado a las 12:41')).toBeInTheDocument();
    const hechos = estado.consultasLista.length;

    vi.setSystemTime(new Date(2026, 10, 19, 12, 44, 0));
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(estado.consultasLista).toHaveLength(hechos + 1));
    expect(await screen.findByText('Actualizado a las 12:44')).toBeInTheDocument();
  });

  it('un error en una actualización con datos previos avisa sin perder la lista y se recupera', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos', { pedidos: [pedidoPropio(58)] });
    await screen.findByRole('link', { name: '#58' });
    estado.fallos.lista = { status: 500, detail: 'Ocurrió un error inesperado.' };

    await avanzar(31_000);

    expect(await screen.findByText('No pudimos actualizar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '#58' })).toBeInTheDocument();

    delete estado.fallos.lista;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar ahora' }));
    await waitFor(() => expect(screen.queryByText('No pudimos actualizar')).toBeNull());
  });
});
