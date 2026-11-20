import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EstadoPedidoCodigo } from '../model';
import { SelectorEstadoPedido } from '../ui';

describe('SelectorEstadoPedido', () => {
  it('ofrece «Todos» y los seis estados con su etiqueta', () => {
    render(<SelectorEstadoPedido id="estado" valor={null} onCambiar={() => undefined} />);

    const opciones = screen.getAllByRole('option').map((opcion) => opcion.textContent);

    expect(opciones).toEqual(['Todos', 'Pendiente', 'Confirmado', 'En preparación', 'En camino', 'Entregado', 'Cancelado']);
  });

  it('elegir «Entregado» llama onCambiar con ENTREGADO y «Todos» con null', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    render(<SelectorEstadoPedido id="estado" valor="ENTREGADO" onCambiar={onCambiar} />);
    const selector = screen.getByRole('combobox');
    expect(selector).toHaveValue('ENTREGADO');

    await usuario.selectOptions(selector, 'Todos');
    await usuario.selectOptions(selector, 'Cancelado');

    expect(onCambiar).toHaveBeenNthCalledWith(1, null);
    expect(onCambiar).toHaveBeenNthCalledWith(2, 'CANCELADO');
  });

  it('muestra el estado que le pasan como seleccionado', async () => {
    const usuario = userEvent.setup();
    function Envoltorio() {
      const [valor, setValor] = useState<EstadoPedidoCodigo | null>(null);
      return <SelectorEstadoPedido id="estado" valor={valor} onCambiar={setValor} />;
    }
    render(<Envoltorio />);

    await usuario.selectOptions(screen.getByRole('combobox'), 'En camino');

    expect(screen.getByRole('combobox')).toHaveValue('EN_CAMINO');
  });
});
