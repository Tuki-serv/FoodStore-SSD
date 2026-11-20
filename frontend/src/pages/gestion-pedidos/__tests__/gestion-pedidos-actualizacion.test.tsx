import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pedidoDto } from '@/test/msw/pedidos';
import { montarGestion } from '@/test/render-gestion';

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

const filas = async () => within(await screen.findByRole('list', { name: 'Pedidos' })).getAllByRole('listitem');

describe('Listado de gestión de pedidos · actualización periódica', () => {
  it('a los 30 s vuelve a pedir el listado y aparece el pedido que se agregó', async () => {
    const { estado } = montarGestion('/gestion-pedidos');
    expect(await filas()).toHaveLength(2);
    expect(estado.consultasLista).toHaveLength(1);

    estado.pedidos.set(59, pedidoDto({ id: 59, cliente_nombre: 'Nuevo Cliente', created_at: '2026-11-19T16:00:00Z' }));
    await avanzar(29_000);
    expect(estado.consultasLista).toHaveLength(1);
    await avanzar(1_500);

    await waitFor(() => expect(estado.consultasLista).toHaveLength(2));
    expect(await screen.findByText('Nuevo Cliente')).toBeInTheDocument();
    expect(await filas()).toHaveLength(3);
  });

  it('con la pestaña oculta no hace pedidos periódicos', async () => {
    const { estado } = montarGestion('/gestion-pedidos');
    await filas();
    const hechos = estado.consultasLista.length;

    ocultarPestana();
    await avanzar(95_000);

    expect(estado.consultasLista).toHaveLength(hechos);
  });

  it('«Actualizar» pide en el momento y cambia la hora de la última actualización', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos');
    await filas();
    expect(await screen.findByText('Actualizado a las 12:41')).toBeInTheDocument();
    const hechos = estado.consultasLista.length;

    vi.setSystemTime(new Date(2026, 10, 19, 12, 44, 0));
    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(estado.consultasLista).toHaveLength(hechos + 1));
    expect(await screen.findByText('Actualizado a las 12:44')).toBeInTheDocument();
  });

  it('mientras se actualiza el botón dice «Actualizando…» y la lista no se vacía', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos');
    await filas();
    estado.demoraLista = 400;

    await usuario.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByRole('button', { name: 'Actualizando…' })).toBeDisabled();
    expect(screen.getByRole('list', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Cargando pedidos' })).toBeNull();
  });

  it('un error en una actualización con datos previos avisa sin perder la tabla y se recupera', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos');
    await filas();
    estado.fallos.lista = { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' };

    await avanzar(31_000);

    expect(await screen.findByText('No pudimos actualizar')).toBeInTheDocument();
    expect(screen.getByText(/Mostramos los pedidos de las 12:41/)).toBeInTheDocument();
    expect(await filas()).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'No pudimos cargar los pedidos' })).toBeNull();

    delete estado.fallos.lista;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar ahora' }));
    await waitFor(() => expect(screen.queryByText('No pudimos actualizar')).toBeNull());
    expect(await filas()).toHaveLength(2);
  });
});
