import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceholderPage } from '@/pages/placeholder';
import { renderApp } from '@/test/render-app';

describe('rutas de la aplicación', () => {
  it('la raíz redirige a /catalogo y muestra Catálogo', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('una ruta futura sin pantalla muestra la página provisoria con su título y el aviso de «en preparación»', () => {
    render(<PlaceholderPage title="Cocina" owner="C-26" />);

    expect(screen.getByRole('heading', { name: 'Cocina', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Estamos preparando esta sección.')).toBeInTheDocument();
  });

  it('la página provisoria declara su dueño en data-owner, no en el texto visible', () => {
    render(<PlaceholderPage title="Cocina" owner="C-26" />);

    const pagina = screen.getByRole('heading', { name: 'Cocina', level: 1 }).closest('[data-owner]');
    expect(pagina).toHaveAttribute('data-owner', 'C-26');
    expect(screen.queryByText(/C-26/)).not.toBeInTheDocument();
  });

  it('el shell envuelve las pantallas reales con el panel de navegación', async () => {
    renderApp('/catalogo');

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
  });
});
