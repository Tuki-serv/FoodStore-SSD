import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../ui-store';

const CLAVE = 'foodstore.ui';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.getState().reset();
    window.localStorage.clear();
  });

  it('arranca con el panel expandido y el drawer cerrado', () => {
    expect(useUiStore.getState()).toMatchObject({ sidebarCollapsed: false, sidebarOpen: false });
  });

  it('toggleSidebarCollapsed colapsa y persiste solo sidebarCollapsed', () => {
    useUiStore.getState().toggleSidebarCollapsed();

    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    const guardado = JSON.parse(window.localStorage.getItem(CLAVE) ?? 'null') as { state: Record<string, unknown> };
    expect(guardado.state).toEqual({ sidebarCollapsed: true });
  });

  it('openSidebar y closeSidebar cambian sidebarOpen sin persistirlo', () => {
    useUiStore.getState().openSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(true);

    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(window.localStorage.getItem(CLAVE) ?? '').not.toContain('sidebarOpen');
  });

  it('reset vuelve al estado inicial', () => {
    useUiStore.getState().toggleSidebarCollapsed();
    useUiStore.getState().openSidebar();

    useUiStore.getState().reset();

    expect(useUiStore.getState()).toMatchObject({ sidebarCollapsed: false, sidebarOpen: false });
  });

  it('limpiarTransitorios vacía toasts y confirmación y conserva sidebarCollapsed', () => {
    const { toggleSidebarCollapsed, notificar, pedirConfirmacion } = useUiStore.getState();
    toggleSidebarCollapsed();
    notificar({ tipo: 'info', titulo: 'Uno' });
    pedirConfirmacion({ titulo: 'T', mensaje: 'M', onConfirmar: vi.fn() });

    useUiStore.getState().limpiarTransitorios();

    expect(useUiStore.getState()).toMatchObject({ toasts: [], confirmModal: null, sidebarCollapsed: true });
  });

  it('limpiarTransitorios sin nada pendiente no cambia el estado', () => {
    useUiStore.getState().limpiarTransitorios();

    expect(useUiStore.getState()).toMatchObject({ toasts: [], confirmModal: null, sidebarCollapsed: false });
  });
});

describe('uiStore con el almacenamiento del navegador', () => {
  async function storeNuevo(): Promise<typeof import('../ui-store')> {
    vi.resetModules();
    return import('../ui-store');
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rehidrata sidebarCollapsed desde lo guardado', async () => {
    window.localStorage.setItem(CLAVE, '{"state":{"sidebarCollapsed":true},"version":1}');

    const { useUiStore: store } = await storeNuevo();

    expect(store.getState().sidebarCollapsed).toBe(true);
    expect(store.getState().sidebarOpen).toBe(false);
  });

  it('no rehidrata sidebarOpen aunque venga en lo guardado', async () => {
    window.localStorage.setItem(CLAVE, '{"state":{"sidebarCollapsed":false,"sidebarOpen":true},"version":1}');

    const { useUiStore: store } = await storeNuevo();

    expect(store.getState().sidebarOpen).toBe(false);
  });

  it('arranca expandido sin excepción si leer el almacenamiento lanza', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const { useUiStore: store } = await storeNuevo();

    expect(store.getState().sidebarCollapsed).toBe(false);
  });

  it('sigue funcionando en memoria si escribir el almacenamiento lanza', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { useUiStore: store } = await storeNuevo();

    expect(() => store.getState().toggleSidebarCollapsed()).not.toThrow();
    expect(store.getState().sidebarCollapsed).toBe(true);
  });
});
