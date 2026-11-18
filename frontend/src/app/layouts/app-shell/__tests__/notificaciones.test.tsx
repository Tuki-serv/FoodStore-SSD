import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/shared/model';
import { renderApp } from '@/test/render-app';

const ui = () => useUiStore.getState();

async function abrirShell() {
  const app = renderApp('/catalogo');
  await screen.findByRole('heading', { name: 'Catálogo', level: 1 });
  return app;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('notificaciones del shell', () => {
  it('una notificación de éxito se ve dentro de un elemento con rol status', async () => {
    await abrirShell();

    act(() => {
      ui().notificar({ tipo: 'success', titulo: 'Dirección guardada' });
    });

    // El catálogo también tiene regiones de estado (el total de resultados): se busca la del aviso por su texto.
    expect(screen.getByText('Dirección guardada').closest('[role="status"]')).toHaveTextContent('Dirección guardada');
  });

  it('una de error se anuncia con rol alert y muestra su mensaje', async () => {
    await abrirShell();

    act(() => {
      ui().notificar({ tipo: 'error', titulo: 'Esa dirección ya no está disponible', mensaje: 'Actualizamos tu lista.' });
    });

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Esa dirección ya no está disponible');
    expect(alerta).toHaveTextContent('Actualizamos tu lista.');
  });

  it('cerrar la primera de dos deja solo la segunda', async () => {
    const { usuario } = await abrirShell();
    act(() => {
      ui().notificar({ tipo: 'success', titulo: 'Primera' });
      ui().notificar({ tipo: 'info', titulo: 'Segunda' });
    });

    const [cerrarPrimera] = screen.getAllByRole('button', { name: 'Cerrar notificación' });
    await usuario.click(cerrarPrimera as HTMLElement);

    expect(screen.queryByText('Primera')).not.toBeInTheDocument();
    expect(screen.getByText('Segunda')).toBeInTheDocument();
  });

  it('se descarta sola a los 5000 ms: a los 4999 sigue y a los 5000 desaparece', async () => {
    await abrirShell();
    vi.useFakeTimers({ shouldAdvanceTime: false });

    act(() => {
      ui().notificar({ tipo: 'success', titulo: 'Dirección eliminada' });
    });
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Dirección eliminada')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Dirección eliminada')).not.toBeInTheDocument();
  });
});
