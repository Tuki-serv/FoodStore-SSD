import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { arbolSeed } from '@/test/msw/catalogo';
import { ArbolCategorias } from '../index';

const montar = (seleccionada: number | null = null, onElegir = vi.fn()) => {
  const vista = render(<ArbolCategorias arbol={arbolSeed} seleccionada={seleccionada} onElegir={onElegir} />);
  return { onElegir, ...vista };
};

describe('ArbolCategorias', () => {
  it('es una navegación «Categorías» con «Todas» primero y las raíces en el orden del servidor', () => {
    montar();

    const nav = screen.getByRole('navigation', { name: 'Categorías' });
    const botones = within(nav).getAllByRole('button').map((boton) => boton.textContent);
    expect(botones).toEqual(['Todas', 'Bebidas', 'Gaseosas', 'Hamburguesas', 'Sin TACC', 'Veganas', 'Postres']);
  });

  it('anida las subcategorías en una lista dentro de su padre', () => {
    montar();

    const hamburguesas = screen.getByRole('button', { name: 'Hamburguesas' }).closest('li');
    const hijas = within(hamburguesas as HTMLElement).getByRole('list');
    expect(within(hijas).getAllByRole('button').map((boton) => boton.textContent)).toEqual(['Sin TACC', 'Veganas']);
    expect(within(screen.getByRole('button', { name: 'Postres' }).closest('li') as HTMLElement).queryByRole('list')).not.toBeInTheDocument();
  });

  it('marca como actual solo la categoría seleccionada', () => {
    montar(4);

    expect(screen.getByRole('button', { name: 'Veganas' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByRole('button').filter((boton) => boton.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('sin selección la actual es «Todas»', () => {
    montar(null);

    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-current', 'true');
  });

  it('elegir «Veganas» avisa con su id y elegir «Todas» avisa con null', async () => {
    const { onElegir } = montar(1);
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'Veganas' }));
    await usuario.click(screen.getByRole('button', { name: 'Todas' }));

    expect(onElegir.mock.calls).toEqual([[4], [null]]);
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = montar(4);

    await esperarSinViolacionesA11y(container);
  });
});
