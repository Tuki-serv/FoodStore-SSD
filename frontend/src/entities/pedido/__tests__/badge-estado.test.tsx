import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BadgeEstado } from '../ui';

describe('BadgeEstado (spec frontend-visual-language, «Estado de pedido como badge»)', () => {
  it.each([
    ['CONFIRMADO', 'Confirmado', 'b-confirmado'],
    ['CANCELADO', 'Cancelado', 'b-cancelado'],
    ['EN_CAMINO', 'En camino', 'b-en-camino'],
  ])('el estado %s se muestra como badge con el estilo de su estado', (codigo, texto, claseEstado) => {
    render(<BadgeEstado codigo={codigo} />);

    const badge = screen.getByText(texto);
    expect(badge).toHaveClass('badge', claseEstado);
  });

  it('un estado desconocido se muestra tal cual con el estilo neutro', () => {
    render(<BadgeEstado codigo="RARO" />);

    expect(screen.getByText('RARO')).toHaveClass('badge', 'b-neutro');
  });
});
