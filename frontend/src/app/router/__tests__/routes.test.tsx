import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';

function renderRuta(ruta: string) {
  const router = createMemoryRouter(routes, { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('rutas de la aplicación', () => {
  it('la raíz redirige a /catalogo y muestra Catálogo', async () => {
    const router = renderRuta('/');

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('una sección sin pantalla muestra la página provisoria dentro del shell', async () => {
    renderRuta('/mis-pedidos');

    expect(await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeInTheDocument();
    const principal = screen.getByRole('main');
    expect(within(principal).getByText('Estamos preparando esta sección.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });

  it('una ruta de administración sin sesión es alcanzable y la navegación sigue «sin sesión»', async () => {
    renderRuta('/admin/usuarios');

    expect(await screen.findByRole('heading', { name: 'Usuarios', level: 1 })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getAllByRole('link').map((enlace) => enlace.textContent)).toEqual([
      'Catálogo',
      'Ingresar',
      'Registrarse',
    ]);
  });

  it('cada página provisoria declara su dueño en data-owner, no en el texto visible', async () => {
    renderRuta('/mis-pedidos');

    const pagina = (await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).closest('[data-owner]');
    expect(pagina).toHaveAttribute('data-owner', 'C-21');
    expect(screen.queryByText(/C-21/)).not.toBeInTheDocument();
  });
});
