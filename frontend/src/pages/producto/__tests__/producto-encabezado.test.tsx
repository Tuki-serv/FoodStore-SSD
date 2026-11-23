import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarCatalogo } from '@/test/render-catalogo';

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;

describe('Detalle de producto · encabezado sin acciones (D9)', () => {
  it('la banda lleva solo la ruta (vuelta al catálogo), sin h1 propio y sin quedar fija; el h1 sigue en el producto', async () => {
    montarCatalogo('/catalogo/1');
    const titulo = await screen.findByRole('heading', { level: 1, name: 'Hamburguesa Clásica' });

    expect(within(banda()).getByRole('link', { name: 'Catálogo' })).toBeInTheDocument();
    expect(within(banda()).queryByRole('heading')).toBeNull();
    expect(banda()).not.toHaveClass('is-sticky');
    expect(banda()).not.toContainElement(titulo);
  });
});
