import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { Dialogo } from '../dialogo';

function montar(onCerrar = vi.fn()) {
  const usuario = userEvent.setup();
  const vista = render(
    <>
      <button type="button">Abrir</button>
      <Dialogo titulo="¿Eliminar «Trabajo»?" descripcion="Belgrano 455." onCerrar={onCerrar}>
        <button type="button" data-autofocus>
          Cancelar
        </button>
        <button type="button">Eliminar</button>
      </Dialogo>
    </>,
  );
  return { usuario, onCerrar, ...vista };
}

describe('Dialogo', () => {
  it('es un diálogo modal con el título como nombre y la descripción asociada', () => {
    montar();

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Trabajo»?' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleDescription('Belgrano 455.');
  });

  it('al abrirse enfoca el control marcado con data-autofocus', () => {
    montar();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('sin control marcado enfoca el propio diálogo', () => {
    render(
      <Dialogo titulo="Aviso" onCerrar={() => undefined}>
        <button type="button">Entendido</button>
      </Dialogo>,
    );

    expect(screen.getByRole('dialog', { name: 'Aviso' })).toHaveFocus();
  });

  it('Tab desde el último botón vuelve al primero y Shift+Tab desde el primero va al último', async () => {
    const { usuario } = montar();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveFocus();

    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

    await usuario.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveFocus();
  });

  it('Escape llama a onCerrar', async () => {
    const { usuario, onCerrar } = montar();

    await usuario.keyboard('{Escape}');

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('un clic en el scrim llama a onCerrar pero uno dentro del diálogo no', async () => {
    const { usuario, onCerrar, container } = montar();

    await usuario.click(screen.getByRole('dialog'));
    expect(onCerrar).not.toHaveBeenCalled();

    const scrim = container.querySelector('[data-scrim]');
    expect(scrim).not.toBeNull();
    await usuario.click(scrim as Element);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('al desmontarse devuelve el foco al control que lo tenía antes', () => {
    const boton = document.createElement('button');
    document.body.append(boton);
    boton.focus();
    const { unmount } = render(
      <Dialogo titulo="Aviso" onCerrar={() => undefined}>
        <button type="button" data-autofocus>
          Ok
        </button>
      </Dialogo>,
    );
    expect(screen.getByRole('button', { name: 'Ok' })).toHaveFocus();

    unmount();

    expect(boton).toHaveFocus();
    boton.remove();
  });

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = montar();

    await esperarSinViolacionesA11y(container);
  });
});
