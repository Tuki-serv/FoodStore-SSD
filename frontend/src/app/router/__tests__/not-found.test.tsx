import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';

function renderRuta(ruta: string) {
  const router = createMemoryRouter(routes, { initialEntries: [ruta] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('página no encontrada', () => {
  it('/no-existe muestra el aviso con la ruta pedida, dentro del shell, y el enlace lleva al catálogo', async () => {
    const usuario = userEvent.setup();
    const router = renderRuta('/no-existe');

    expect(await screen.findByRole('heading', { name: 'Página no encontrada', level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('/no-existe')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('link', { name: 'Ir al catálogo' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('/admin/no-existe también es 404 y muestra su ruta', async () => {
    renderRuta('/admin/no-existe');

    expect(await screen.findByRole('heading', { name: 'Página no encontrada', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('/admin/no-existe')).toBeInTheDocument();
  });

  it('el 404 no se confunde con una ruta real', async () => {
    renderRuta('/carrito');

    expect(await screen.findByRole('heading', { name: 'Carrito', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página no encontrada' })).not.toBeInTheDocument();
  });
});
