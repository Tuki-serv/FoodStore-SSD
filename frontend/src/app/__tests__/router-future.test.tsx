import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('future flags de React Router', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('arrancar la app y navegar no emite avisos de future flags', async () => {
    vi.resetModules();
    const avisos = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    window.history.pushState({}, '', '/');
    const { AppProviders } = await import('../providers');
    const usuario = userEvent.setup();

    render(<AppProviders />);
    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Ingresar' }));
    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();

    const deFuturo = avisos.mock.calls.filter(([mensaje]) => String(mensaje).includes('React Router Future Flag Warning'));
    expect(deFuturo).toEqual([]);
  });
});
