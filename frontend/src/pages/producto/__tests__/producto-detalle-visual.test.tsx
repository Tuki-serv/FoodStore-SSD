import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { productoDto } from '@/test/msw/catalogo';
import { montarCatalogo } from '@/test/render-catalogo';

// Estructura del mockup aprobado `mockups/producto-detalle.html` (revision-visual): ruta, categoría como texto, compra, alérgenos e ingredientes.
const titulo = (nombre: string) => screen.findByRole('heading', { name: nombre, level: 1 });
const ruta = () => screen.getByRole('navigation', { name: 'Ruta de navegación' });

describe('Detalle de producto · ruta «Catálogo / categoría / producto»', () => {
  it('la banda muestra la ruta con vuelta al catálogo, la categoría principal y el producto actual; ya no hay «Volver al catálogo»', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    expect(within(ruta()).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/catalogo');
    expect(within(ruta()).getByRole('link', { name: 'Hamburguesas' })).toHaveAttribute('href', '/catalogo?categoria=1');
    expect(within(ruta()).getByText('Hamburguesa Clásica')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Volver al catálogo' })).not.toBeInTheDocument();
  });

  it('un producto sin categorías omite el tramo de categoría', async () => {
    montarCatalogo('/catalogo/9', { productos: [productoDto({ id: 9, nombre: 'Flan', categorias: [] })] });
    await titulo('Flan');

    expect(within(ruta()).getAllByRole('link').map((enlace) => enlace.textContent)).toEqual(['Catálogo']);
    expect(within(ruta()).getByText('Flan')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Detalle de producto · categoría como texto, precio y compra', () => {
  it('las categorías se muestran como texto sobre el título (principal primero), sin enlaces ni badge', async () => {
    montarCatalogo('/catalogo/3');
    await titulo('Burger Vegana');

    const texto = screen.getByText('Hamburguesas · Veganas');
    expect(texto).toHaveClass('tagline');
    expect(texto.closest('a')).toBeNull();
    expect(texto.className).not.toMatch(/\bbadge\b|\bb-[a-z-]+\b/);
  });

  it('el precio lleva el «$» chico y el importe aparte', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    const precio = document.querySelector<HTMLElement>('.pd-price .price')!;
    expect(precio.querySelector('small')).toHaveTextContent('$');
    expect(precio).toHaveTextContent('$ 1.500');
  });

  it('cantidad y «Agregar al carrito» van en una fila de compra sin caja', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    const compra = document.querySelector<HTMLElement>('.pd-buy')!;
    expect(within(compra).getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toBeInTheDocument();
    expect(within(compra).getByRole('button', { name: 'Sumar una unidad' })).toBeInTheDocument();
    expect(document.querySelector('.buy')).toBeNull();
  });
});

describe('Detalle de producto · alérgenos e ingredientes', () => {
  it('los alérgenos son un bloque con título «Contiene alérgenos» y la lista aparte, no una alerta', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    const bloque = screen.getByRole('note');
    expect(within(bloque).getByText('Contiene alérgenos').tagName).toBe('STRONG');
    expect(within(bloque).getByText('Pan Brioche, Mayonesa')).toBeInTheDocument();
    expect(bloque).toHaveClass('pd-section');
    expect(bloque).not.toHaveClass('allergen-note');
  });

  it('los ingredientes son una lista con divisores y la marca «Alérgeno», no chips', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    const region = screen.getByRole('region', { name: 'Ingredientes' });
    expect(within(region).getByRole('list')).toHaveClass('ing-list');
    expect(region).toHaveClass('pd-section');
    expect(within(region).getAllByText('Alérgeno')).toHaveLength(2);
  });
});
