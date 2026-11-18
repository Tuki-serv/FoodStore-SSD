import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacion } from '../paginacion';

describe('Paginacion', () => {
  it('con una sola página no dibuja nada', () => {
    const { container } = render(<Paginacion etiqueta="Paginación de prueba" page={1} pages={1} onCambiar={() => undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('en la página 2 de 3 muestra «Página 2 de 3» y ambos botones habilitados dentro de una navegación con nombre', async () => {
    const onCambiar = vi.fn();
    render(<Paginacion etiqueta="Paginación del catálogo" page={2} pages={3} onCambiar={onCambiar} />);
    const usuario = userEvent.setup();

    const nav = screen.getByRole('navigation', { name: 'Paginación del catálogo' });
    expect(nav).toHaveTextContent('Página 2 de 3');
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    await usuario.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onCambiar.mock.calls).toEqual([[3], [1]]);
  });

  it('en los extremos deshabilita «Anterior» (primera) o «Siguiente» (última)', () => {
    const { rerender } = render(<Paginacion etiqueta="P" page={1} pages={3} onCambiar={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();

    rerender(<Paginacion etiqueta="P" page={3} pages={3} onCambiar={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});
