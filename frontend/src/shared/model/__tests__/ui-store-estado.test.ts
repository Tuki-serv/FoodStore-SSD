import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_UI_STORAGE, useUiStore } from '..';

const ui = () => useUiStore.getState();

describe('uiStore: carrito abierto', () => {
  beforeEach(() => {
    ui().reset();
  });

  it('arranca cerrado, abrirCarrito lo abre y cerrarCarrito lo cierra', () => {
    expect(ui().cartOpen).toBe(false);

    ui().abrirCarrito();
    expect(ui().cartOpen).toBe(true);

    ui().cerrarCarrito();
    expect(ui().cartOpen).toBe(false);
  });
});

describe('uiStore: notificaciones', () => {
  beforeEach(() => {
    ui().reset();
  });

  it('notificar devuelve identificadores únicos y encola con tipo y título', () => {
    const primero = ui().notificar({ tipo: 'success', titulo: 'Producto agregado' });
    const segundo = ui().notificar({ tipo: 'error', titulo: 'No pudimos guardar', mensaje: 'Probá de nuevo' });

    expect(primero).not.toBe(segundo);
    expect(ui().toasts).toEqual([
      { id: primero, tipo: 'success', titulo: 'Producto agregado' },
      { id: segundo, tipo: 'error', titulo: 'No pudimos guardar', mensaje: 'Probá de nuevo' },
    ]);
  });

  it('descartarToast quita solo esa notificación y conserva la otra con su mismo id', () => {
    const primero = ui().notificar({ tipo: 'info', titulo: 'Uno' });
    const segundo = ui().notificar({ tipo: 'warning', titulo: 'Dos' });

    ui().descartarToast(primero);

    expect(ui().toasts).toEqual([{ id: segundo, tipo: 'warning', titulo: 'Dos' }]);
  });

  it('descartar un id inexistente no cambia la cola', () => {
    ui().notificar({ tipo: 'info', titulo: 'Uno' });

    ui().descartarToast('no-existe');

    expect(ui().toasts).toHaveLength(1);
  });

  it('los ids no se repiten ni después de un reset', () => {
    const antes = ui().notificar({ tipo: 'info', titulo: 'Uno' });
    ui().reset();
    const despues = ui().notificar({ tipo: 'info', titulo: 'Uno' });

    expect(despues).not.toBe(antes);
  });
});

describe('uiStore: diálogo de confirmación', () => {
  beforeEach(() => {
    ui().reset();
  });

  it('pedirConfirmacion abre el diálogo con sus datos y cerrarConfirmacion lo cierra', () => {
    const alConfirmar = vi.fn();

    ui().pedirConfirmacion({ titulo: 'Eliminar categoría', mensaje: '¿Seguro?', onConfirmar: alConfirmar });

    expect(ui().confirmModal).toMatchObject({ titulo: 'Eliminar categoría', mensaje: '¿Seguro?' });
    ui().confirmModal?.onConfirmar();
    expect(alConfirmar).toHaveBeenCalledTimes(1);

    ui().cerrarConfirmacion();
    expect(ui().confirmModal).toBeNull();
  });
});

describe('uiStore: persistencia', () => {
  beforeEach(() => {
    ui().reset();
    window.localStorage.clear();
  });

  it('con carrito abierto, notificación y diálogo, solo sidebarCollapsed se guarda', () => {
    ui().toggleSidebarCollapsed();
    ui().abrirCarrito();
    ui().notificar({ tipo: 'success', titulo: 'Hecho' });
    ui().pedirConfirmacion({ titulo: 'Confirmar', mensaje: '¿Seguro?', onConfirmar: () => undefined });

    const guardado = JSON.parse(window.localStorage.getItem(CLAVE_UI_STORAGE) ?? 'null') as { state: Record<string, unknown> };
    expect(guardado.state).toEqual({ sidebarCollapsed: true });
  });

  it('al recargar el carrito está cerrado, no hay notificaciones y el panel sigue colapsado', async () => {
    window.localStorage.setItem(CLAVE_UI_STORAGE, '{"state":{"sidebarCollapsed":true,"cartOpen":true,"toasts":[{"id":"x"}]},"version":1}');

    await useUiStore.persist.rehydrate();

    expect(ui().sidebarCollapsed).toBe(true);
    expect(ui().cartOpen).toBe(false);
    expect(ui().toasts).toEqual([]);
    expect(ui().confirmModal).toBeNull();
  });
});
