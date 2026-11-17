import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../routes';

function PaginaQueFalla(): never {
  throw new Error('detalle interno');
}

/** El árbol real, más una ruta que lanza al renderizar (solo existe en este test). */
function renderConRutaQueFalla() {
  const [raiz] = routes;
  if (raiz === undefined) throw new Error('El árbol de rutas está vacío');
  const conFalla: RouteObject[] = [
    { errorElement: raiz.errorElement, children: [...(raiz.children ?? []), { path: '/falla', element: <PaginaQueFalla /> }] },
  ];
  const router = createMemoryRouter(conFalla, { initialEntries: ['/falla'] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('página de error genérica', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('un error de render muestra el aviso a pantalla completa, sin shell ni detalles internos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderConRutaQueFalla();

    expect(await screen.findByRole('heading', { name: 'Algo salió mal', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('detalle interno')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
  });

  it('«Reintentar» recarga la página', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recargar = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: recargar });
    const usuario = userEvent.setup();
    renderConRutaQueFalla();

    await usuario.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
