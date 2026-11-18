import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/shared/model';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { renderApp } from '@/test/render-app';

async function abrirShell() {
  const app = renderApp('/catalogo');
  await screen.findByRole('heading', { name: 'Catálogo', level: 1 });
  return app;
}

/** Un botón real con el foco, como el que abre la confirmación en una pantalla. */
function botonDisparador(): HTMLButtonElement {
  const boton = document.createElement('button');
  boton.textContent = 'Eliminar Trabajo';
  document.body.append(boton);
  boton.focus();
  return boton;
}

function pedir(onConfirmar: () => void, extra: { variante?: 'peligro' | 'normal'; textoCancelar?: string } = {}) {
  act(() => {
    useUiStore.getState().pedirConfirmacion({
      titulo: '¿Eliminar Trabajo?',
      mensaje: 'Belgrano 455.',
      textoConfirmar: 'Eliminar',
      onConfirmar,
      ...extra,
    });
  });
}

describe('confirmación global', () => {
  it('muestra el diálogo con título, mensaje y el botón de confirmar, con el foco en «Cancelar»', async () => {
    await abrirShell();

    pedir(vi.fn());

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar Trabajo?' });
    expect(dialogo).toHaveAccessibleDescription('Belgrano 455.');
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('«Eliminar» con doble clic ejecuta la acción una sola vez y cierra el diálogo', async () => {
    const { usuario } = await abrirShell();
    const onConfirmar = vi.fn();
    pedir(onConfirmar);

    await usuario.dblClick(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('«Cancelar» cierra sin ejecutar la acción', async () => {
    const { usuario } = await abrirShell();
    const onConfirmar = vi.fn();
    pedir(onConfirmar);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Escape cierra sin ejecutar la acción y el foco vuelve al botón que lo abrió', async () => {
    const { usuario } = await abrirShell();
    const disparador = botonDisparador();
    const onConfirmar = vi.fn();
    pedir(onConfirmar);

    await usuario.keyboard('{Escape}');

    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(disparador).toHaveFocus();
    disparador.remove();
  });

  it('un clic fuera del diálogo (scrim) también cierra sin ejecutar', async () => {
    const { usuario } = await abrirShell();
    const onConfirmar = vi.fn();
    pedir(onConfirmar);

    const scrim = document.querySelector('[data-scrim]');
    await usuario.click(scrim as Element);

    expect(onConfirmar).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin textos indicados usa «Confirmar» y «Cancelar»', async () => {
    await abrirShell();

    act(() => {
      useUiStore.getState().pedirConfirmacion({ titulo: '¿Seguro?', mensaje: 'Esto no se puede deshacer.', onConfirmar: vi.fn() });
    });

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('la variante «peligro» marca el botón de confirmar como destructivo', async () => {
    await abrirShell();

    pedir(vi.fn(), { variante: 'peligro' });

    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveAttribute('data-variante', 'peligro');
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toHaveAttribute('data-variante', 'peligro');
  });

  it('no tiene violaciones de accesibilidad con el diálogo abierto', async () => {
    await abrirShell();
    pedir(vi.fn(), { variante: 'peligro' });

    await esperarSinViolacionesA11y(screen.getByRole('dialog'));
  });
});
