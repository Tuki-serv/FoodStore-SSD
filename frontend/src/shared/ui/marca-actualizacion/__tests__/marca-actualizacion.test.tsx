import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MarcaActualizacion } from '../marca-actualizacion';

// Mockup aprobado (gestion-pedidos.html): botón fantasma; en mobile solo ícono y sin la hora («hide-m», «lbl-m»).
describe('MarcaActualizacion', () => {
  it('es un botón fantasma con la hora marcada para ocultarse en mobile', () => {
    render(<MarcaActualizacion actualizadoEn={new Date(2026, 10, 23, 12, 41).getTime()} actualizando={false} onActualizar={() => {}} />);

    const boton = screen.getByRole('button', { name: 'Actualizar' });
    expect(boton.className).toContain('bg-transparent');
    expect(boton.querySelector('.lbl-m')).toHaveTextContent('Actualizar');
    expect(screen.getByText('Actualizado a las 12:41')).toHaveClass('when');
  });

  it('mantiene el nombre accesible y llama al callback al presionarlo', async () => {
    const user = userEvent.setup();
    const onActualizar = vi.fn();
    render(<MarcaActualizacion actualizadoEn={0} actualizando={false} onActualizar={onActualizar} />);

    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(onActualizar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Actualizado a las/)).toBeNull();
  });
});
