import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EstadoPedidoCodigo } from '../model';
import { SelectorEstadoPedido } from '../ui';

describe('SelectorEstadoPedido (control segmentado)', () => {
  it('ofrece «Todos» y los seis estados como botones de un grupo «Filtrar por estado»', () => {
    render(<SelectorEstadoPedido valor={null} onCambiar={() => undefined} />);

    const grupo = screen.getByRole('group', { name: 'Filtrar por estado' });
    const botones = screen.getAllByRole('button').map((boton) => boton.textContent);

    expect(grupo).toContainElement(screen.getByRole('button', { name: 'Todos' }));
    expect(botones).toEqual(['Todos', 'Pendiente', 'Confirmado', 'En preparación', 'En camino', 'Entregado', 'Cancelado']);
  });

  it('marca con aria-pressed solo el estado elegido (y «Todos» con null)', () => {
    const { rerender } = render(<SelectorEstadoPedido valor={null} onCambiar={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Todos', pressed: true })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);

    rerender(<SelectorEstadoPedido valor="ENTREGADO" onCambiar={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Entregado', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos', pressed: false })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('pulsar «Cancelado» llama onCambiar con CANCELADO y «Todos» con null', async () => {
    const usuario = userEvent.setup();
    const onCambiar = vi.fn();
    render(<SelectorEstadoPedido valor="ENTREGADO" onCambiar={onCambiar} />);

    await usuario.click(screen.getByRole('button', { name: 'Todos' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelado' }));

    expect(onCambiar).toHaveBeenNthCalledWith(1, null);
    expect(onCambiar).toHaveBeenNthCalledWith(2, 'CANCELADO');
  });

  it('se opera con el teclado (Tab y Enter) y refleja el estado que le pasan', async () => {
    const usuario = userEvent.setup();
    function Envoltorio() {
      const [valor, setValor] = useState<EstadoPedidoCodigo | null>(null);
      return <SelectorEstadoPedido valor={valor} onCambiar={setValor} />;
    }
    render(<Envoltorio />);

    screen.getByRole('button', { name: 'En camino' }).focus();
    await usuario.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'En camino', pressed: true })).toBeInTheDocument();
  });

  it('el grupo toma su nombre de la etiqueta visible cuando se le pasa idEtiqueta', () => {
    render(
      <>
        <span id="et">Estado</span>
        <SelectorEstadoPedido idEtiqueta="et" valor={null} onCambiar={() => undefined} />
      </>,
    );

    expect(screen.getByRole('group', { name: 'Estado' })).toBeInTheDocument();
  });
});
