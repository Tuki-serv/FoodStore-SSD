import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { busquedasDeLista, type EstadoCatalogo } from '@/test/msw/catalogo';
import { montarCatalogo } from '@/test/render-catalogo';
import { setViewport } from '@/test/viewport';

const BASE = '?page=1&size=12&disponible=true';
const esperarPedido = (estado: EstadoCatalogo, esperado: string) => waitFor(() => expect(busquedasDeLista(estado)).toContain(esperado));
const ubicacion = (router: { state: { location: { pathname: string; search: string } } }) => `${router.state.location.pathname}${router.state.location.search}`;

const montarMobile = (ruta = '/catalogo') => {
  act(() => setViewport(390));
  return montarCatalogo(ruta);
};

describe('catálogo en mobile (< 1024 px)', () => {
  it('ofrece los chips «Todas», «Bebidas», «Hamburguesas» y «Postres» (con aria-pressed) y no el árbol lateral', async () => {
    montarMobile();

    const chips = await screen.findByRole('group', { name: 'Categorías principales' });

    expect(within(chips).getAllByRole('button').map((boton) => boton.textContent)).toEqual(['Todas', 'Bebidas', 'Hamburguesas', 'Postres']);
    expect(within(chips).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Bebidas' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('navigation', { name: 'Categorías' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Filtros' })).not.toBeInTheDocument();
  });

  it('un chip de categoría raíz filtra por ella y sus descendientes y queda presionado', async () => {
    const { estado, router, usuario } = montarMobile();
    const chips = await screen.findByRole('group', { name: 'Categorías principales' });

    await usuario.click(within(chips).getByRole('button', { name: 'Bebidas' }));

    await esperarPedido(estado, `${BASE}&categoria_ids=2&categoria_ids=6`);
    expect(ubicacion(router)).toBe('/catalogo?categoria=2');
    expect(within(chips).getByRole('button', { name: 'Bebidas' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('con una subcategoría elegida queda presionado el chip de su raíz', async () => {
    montarMobile('/catalogo?categoria=4');
    const chips = await screen.findByRole('group', { name: 'Categorías principales' });

    expect(within(chips).getByRole('button', { name: 'Hamburguesas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('«Filtros» abre la hoja con el árbol completo; elegir «Veganas» filtra y «Ver resultados» cierra y devuelve el foco a «Filtros»', async () => {
    const { estado, router, usuario } = montarMobile();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    const abrir = screen.getByRole('button', { name: /^Filtros/ });

    await usuario.click(abrir);
    const hoja = screen.getByRole('dialog', { name: 'Filtros' });
    const arbol = within(hoja).getByRole('navigation', { name: 'Categorías' });
    expect(within(arbol).getAllByRole('button').map((boton) => boton.textContent)).toContain('Veganas');
    await usuario.click(within(arbol).getByRole('button', { name: 'Veganas' }));

    await esperarPedido(estado, `${BASE}&categoria_ids=4`);
    const ver = await within(hoja).findByRole('button', { name: 'Ver resultados (1)' });
    await usuario.click(ver);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filtros/ })).toHaveFocus();
    expect(ubicacion(router)).toBe('/catalogo?categoria=4');
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
  });

  it('Escape y el botón de cerrar también cierran la hoja', async () => {
    const { usuario } = montarMobile();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('button', { name: /^Filtros/ }));
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /^Filtros/ }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar filtros' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el contador de «Filtros» refleja los filtros aplicados', async () => {
    montarMobile('/catalogo?categoria=1&stock=1&q=burger');
    await screen.findByRole('link', { name: 'Burger BBQ Bacon' });

    const boton = screen.getByRole('button', { name: /^Filtros/ });

    expect(boton).toHaveTextContent('3');
    expect(boton).toHaveAccessibleName('Filtros 3 aplicados');
  });

  it('sin filtros aplicados «Filtros» no muestra contador', async () => {
    montarMobile();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(screen.getByRole('button', { name: 'Filtros' })).toBeInTheDocument();
  });

  it('«Limpiar» de la hoja deja todo sin filtros', async () => {
    const { router, usuario } = montarMobile('/catalogo?categoria=1&stock=1');
    await screen.findByText('4 productos');

    await usuario.click(screen.getByRole('button', { name: /^Filtros/ }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Limpiar' }));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
  });

  it('la hoja trae el precio y «Solo con stock», y no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarMobile();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('button', { name: /^Filtros/ }));
    const hoja = screen.getByRole('dialog', { name: 'Filtros' });

    expect(within(hoja).getByRole('textbox', { name: 'Precio mínimo' })).toBeInTheDocument();
    expect(within(hoja).getByRole('switch', { name: 'Solo con stock' })).toBeInTheDocument();
    await esperarSinViolacionesA11y(hoja);
  });

  it('al pasar a desktop desaparece «Filtros» y aparecen «Precio» y «Solo con stock» en la barra, sin columna lateral', async () => {
    montarMobile();
    await screen.findByRole('group', { name: 'Categorías principales' });
    expect(screen.queryByRole('button', { name: 'Precio' })).not.toBeInTheDocument();

    act(() => setViewport(1440));

    expect(await screen.findByRole('button', { name: 'Precio' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Solo con stock' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filtros/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Filtros' })).not.toBeInTheDocument();
  });
});
