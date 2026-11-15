import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../providers';

describe('arranque de la aplicación', () => {
  it('en / muestra el panel lateral con la navegación Principal y el Catálogo', async () => {
    window.history.pushState({}, '', '/');

    render(<AppProviders />);

    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/catalogo');
  });
});
