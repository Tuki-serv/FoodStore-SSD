import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectorCantidad } from '../selector-cantidad';

describe('SelectorCantidad', () => {
  it('con el valor en el máximo (99) «Sumar» queda deshabilitado y «Restar» no', () => {
    render(<SelectorCantidad valor={99} max={99} onCambiar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sumar una unidad' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restar una unidad' })).toBeEnabled();
  });

  it('con el valor en 1 «Restar» queda deshabilitado y «Sumar» no', () => {
    render(<SelectorCantidad valor={1} max={99} onCambiar={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Restar una unidad' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sumar una unidad' })).toBeEnabled();
  });

  it('las etiquetas personalizadas son los nombres accesibles de los botones', () => {
    render(
      <SelectorCantidad
        valor={2}
        max={99}
        onCambiar={vi.fn()}
        etiquetaRestar="Restar una unidad de Flan"
        etiquetaSumar="Sumar una unidad de Flan"
      />,
    );

    expect(screen.getByRole('button', { name: 'Restar una unidad de Flan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sumar una unidad de Flan' })).toBeInTheDocument();
  });

  it('sumar y restar llaman a onCambiar con el valor nuevo; la cantidad se anuncia', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    render(<SelectorCantidad valor={4} max={10} onCambiar={onCambiar} />);

    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad' }));
    await usuario.click(screen.getByRole('button', { name: 'Restar una unidad' }));

    expect(onCambiar).toHaveBeenNthCalledWith(1, 5);
    expect(onCambiar).toHaveBeenNthCalledWith(2, 3);
    expect(screen.getByRole('status')).toHaveTextContent('4');
  });
});
