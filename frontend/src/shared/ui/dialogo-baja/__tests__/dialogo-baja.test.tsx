import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogoBaja } from '..';

describe('DialogoBaja', () => {
  it('por defecto confirma con «Eliminar» y, en curso, muestra «Eliminando…» deshabilitado', () => {
    const { rerender } = render(<DialogoBaja titulo="¿Eliminar X?" onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled();

    rerender(<DialogoBaja titulo="¿Eliminar X?" pendiente onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
  });

  it('con etiquetas propias usa «Desactivar» / «Desactivando…»', () => {
    const { rerender } = render(<DialogoBaja titulo="¿Desactivar a X?" etiquetaConfirmar="Desactivar" etiquetaPendiente="Desactivando…" onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Desactivar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();

    rerender(<DialogoBaja titulo="¿Desactivar a X?" pendiente etiquetaConfirmar="Desactivar" etiquetaPendiente="Desactivando…" onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Desactivando…' })).toBeDisabled();
  });

  it('en curso muestra un spinner decorativo dentro del botón de confirmar; en reposo no', () => {
    const { rerender } = render(<DialogoBaja titulo="¿Desactivar a X?" etiquetaConfirmar="Desactivar" etiquetaPendiente="Desactivando…" onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Desactivar' }).querySelector('.spin')).toBeNull();

    rerender(<DialogoBaja titulo="¿Desactivar a X?" pendiente etiquetaConfirmar="Desactivar" etiquetaPendiente="Desactivando…" onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    const spinner = screen.getByRole('button', { name: 'Desactivando…' }).querySelector('.spin');
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('dibuja el cuerpo propio antes del aviso', () => {
    render(<DialogoBaja titulo="¿Desactivar a X?" cuerpo={<p>Quién es</p>} aviso={{ titulo: 'Aviso', peligro: true }} onConfirmar={vi.fn()} onCerrar={vi.fn()} />);

    const cuerpo = screen.getByText('Quién es');
    const aviso = screen.getByRole('alert');
    expect(cuerpo.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
