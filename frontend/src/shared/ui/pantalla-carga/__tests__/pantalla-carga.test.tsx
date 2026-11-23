import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PantallaCarga } from '../pantalla-carga';

describe('PantallaCarga', () => {
  it('anuncia «Cargando…» como estado accesible y muestra el logo', () => {
    render(<PantallaCarga />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.getByRole('img', { name: 'Food Store' })).toBeInTheDocument();
  });

  it('el indicador giratorio es decorativo (no suma texto al estado)', () => {
    render(<PantallaCarga />);

    expect(screen.getByRole('status').textContent?.trim()).toBe('Cargando…');
  });
});
