import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render-app';

describe('rutas de la aplicación', () => {
  it('la raíz redirige a /catalogo y muestra Catálogo', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('una sección sin pantalla muestra la página provisoria dentro del shell', async () => {
    renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeInTheDocument();
    const principal = screen.getByRole('main');
    expect(within(principal).getByText('Estamos preparando esta sección.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  it('cada página provisoria declara su dueño en data-owner, no en el texto visible', async () => {
    renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } });

    const pagina = (await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).closest('[data-owner]');
    expect(pagina).toHaveAttribute('data-owner', 'C-21');
    expect(screen.queryByText(/C-21/)).not.toBeInTheDocument();
  });
});
