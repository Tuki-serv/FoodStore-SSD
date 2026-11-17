import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '@/test/render-app';

describe('página no encontrada', () => {
  it('/no-existe muestra el aviso con la ruta pedida, dentro del shell, y el enlace lleva al catálogo', async () => {
    const { router, usuario } = renderApp('/no-existe');

    expect(await screen.findByRole('heading', { name: 'Página no encontrada', level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('/no-existe')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('link', { name: 'Ir al catálogo' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('/admin/no-existe también es 404 y muestra su ruta', async () => {
    renderApp('/admin/no-existe');

    expect(await screen.findByRole('heading', { name: 'Página no encontrada', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('/admin/no-existe')).toBeInTheDocument();
  });

  it('el 404 no se confunde con una ruta real', async () => {
    renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: 'Carrito', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página no encontrada' })).not.toBeInTheDocument();
  });
});
