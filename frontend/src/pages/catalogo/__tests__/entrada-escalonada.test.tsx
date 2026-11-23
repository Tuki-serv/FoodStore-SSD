import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { productoDto } from '@/test/msw/catalogo';
import { montarCatalogo, nombresVisibles } from '@/test/render-catalogo';

const grilla = () => screen.getByRole('list', { name: 'Productos' });
const retardo = (li: HTMLElement) => li.style.getPropertyValue('--i');

const doce = Array.from({ length: 12 }, (_, i) => productoDto({ id: i + 1, nombre: `Producto ${String(i + 1).padStart(2, '0')}` }));

describe('Catálogo · entrada escalonada (spec frontend-visual-language)', () => {
  it('al montar con resultados, la grilla lleva la clase de entrada y cada tarjeta su índice, topado en 8', async () => {
    montarCatalogo('/catalogo', { productos: doce });
    await screen.findByText('12 productos');

    expect(grilla()).toHaveClass('stagger');
    const items = within(grilla()).getAllByRole('listitem');
    expect(items.map(retardo)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '8', '8', '8']);
  });

  it('al cambiar la categoría la grilla ya no lleva la clase de entrada: los nuevos resultados no se animan', async () => {
    const { usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('group', { name: 'Categorías principales' });
    await waitFor(() => expect(nombresVisibles().length).toBeGreaterThan(4));
    expect(grilla()).toHaveClass('stagger');

    await usuario.click(within(screen.getByRole('group', { name: 'Categorías principales' })).getByRole('button', { name: 'Hamburguesas' }));

    await screen.findByText('4 productos');
    expect(nombresVisibles()).toHaveLength(4);
    expect(grilla()).not.toHaveClass('stagger');
  });
});
