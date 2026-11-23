import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { montarCatalogo } from '@/test/render-catalogo';
import { setViewport } from '@/test/viewport';

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;

describe('catálogo: encabezado de página fijo (D9)', () => {
  it('el título, el buscador, las categorías, «Precio» y «Solo con stock» viven en la banda fija; la grilla queda fuera', async () => {
    act(() => setViewport(1280));
    montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(banda()).toHaveClass('is-sticky');
    const dentro = within(banda());
    expect(dentro.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeInTheDocument();
    expect(dentro.getByRole('searchbox', { name: 'Buscar productos' })).toBeInTheDocument();
    expect(dentro.getByRole('group', { name: 'Categorías principales' })).toBeInTheDocument();
    expect(dentro.getByRole('button', { name: /Precio/ })).toBeInTheDocument();
    expect(dentro.getByRole('status')).toHaveTextContent(/productos?$/);
    expect(banda()).not.toContainElement(screen.getByRole('link', { name: 'Hamburguesa Clásica' }));
  });

  it('con categoría y precio aplicados la banda muestra un chip quitable por filtro y «Limpiar filtros»; quitar uno lo saca de la URL', async () => {
    act(() => setViewport(1280));
    const { router, usuario } = montarCatalogo('/catalogo?categoria=4&min=1000');
    await waitFor(() => expect(within(banda()).getByRole('group', { name: 'Filtros aplicados' })).toBeInTheDocument());

    const aplicados = within(within(banda()).getByRole('group', { name: 'Filtros aplicados' }));
    expect(aplicados.getAllByRole('button').map((boton) => boton.getAttribute('aria-label') ?? boton.textContent)).toEqual([
      'Quitar filtro Veganas',
      'Quitar filtro Desde $ 1.000',
      'Limpiar filtros',
    ]);

    await usuario.click(aplicados.getByRole('button', { name: 'Quitar filtro Desde $ 1.000' }));

    await waitFor(() => expect(router.state.location.search).toBe('?categoria=4'));
  });

  it('en mobile la banda lleva el botón «Filtros» con el contador de filtros activos y las categorías desplazables', async () => {
    act(() => setViewport(390));
    montarCatalogo('/catalogo?categoria=4&min=1000');

    const boton = await screen.findByRole('button', { name: /^Filtros/ });
    expect(banda()).toContainElement(boton);
    expect(within(boton).getByLabelText('2 aplicados')).toBeInTheDocument();
    expect(await within(banda()).findByRole('group', { name: 'Categorías principales' })).toBeInTheDocument();
  });
});
