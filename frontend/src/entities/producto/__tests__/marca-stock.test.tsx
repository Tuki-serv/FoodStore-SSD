import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarcaStock } from '../index';

describe('MarcaStock', () => {
  it('stock 0: «Agotado» con el tono «out»', () => {
    render(<MarcaStock stock={0} />);

    expect(screen.getByText('Agotado')).toHaveClass('stock', 'out');
  });

  it('stock 2: «Quedan 2» con el tono «low»', () => {
    render(<MarcaStock stock={2} />);

    expect(screen.getByText('Quedan 2')).toHaveClass('stock', 'low');
  });

  it('ambas marcas comparten el estilo de marca de stock y ninguna usa los badges de estado de pedido', () => {
    render(
      <>
        <MarcaStock stock={0} />
        <MarcaStock stock={2} />
      </>,
    );

    for (const marca of [screen.getByText('Agotado'), screen.getByText('Quedan 2')]) {
      expect(marca).toHaveClass('stock');
      expect(marca.className).not.toMatch(/\bbadge\b|\bb-[a-z-]+\b/);
    }
  });

  it('con más de 5 unidades no muestra aviso', () => {
    const { container } = render(<MarcaStock stock={6} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('flotante agrega la posición sobre la imagen sin cambiar el estilo de marca', () => {
    render(<MarcaStock stock={0} flotante />);

    expect(screen.getByText('Agotado')).toHaveClass('stock', 'out', 'tag');
  });
});
