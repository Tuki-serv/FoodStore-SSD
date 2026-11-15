import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/** Estado de UI global (cliente). Los campos de otros changes (carrito, toasts, modales) los suma el change que los usa. */
export interface UiState {
  /** Panel lateral colapsado a solo íconos (desktop). Se persiste. */
  sidebarCollapsed: boolean;
  /** Drawer de navegación abierto (mobile). No se persiste. */
  sidebarOpen: boolean;
  toggleSidebarCollapsed: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  reset: () => void;
}

export const CLAVE_UI_STORAGE = 'foodstore.ui';

const ESTADO_INICIAL = { sidebarCollapsed: false, sidebarOpen: false } as const;

/** El almacenamiento del navegador puede no existir o lanzar (modo privado, cuota): ante un fallo el store sigue vivo en memoria. */
const almacenamientoSeguro: StateStorage = {
  getItem: (nombre) => {
    try {
      return window.localStorage.getItem(nombre);
    } catch {
      return null;
    }
  },
  setItem: (nombre, valor) => {
    try {
      window.localStorage.setItem(nombre, valor);
    } catch {
      // Sin persistencia: la preferencia vale solo para esta sesión.
    }
  },
  removeItem: (nombre) => {
    try {
      window.localStorage.removeItem(nombre);
    } catch {
      // Nada que limpiar.
    }
  },
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...ESTADO_INICIAL,
      toggleSidebarCollapsed: () => set((estado) => ({ sidebarCollapsed: !estado.sidebarCollapsed })),
      openSidebar: () => set({ sidebarOpen: true }),
      closeSidebar: () => set({ sidebarOpen: false }),
      reset: () => set({ ...ESTADO_INICIAL }),
    }),
    {
      name: CLAVE_UI_STORAGE,
      version: 1,
      storage: createJSONStorage(() => almacenamientoSeguro),
      partialize: (estado) => ({ sidebarCollapsed: estado.sidebarCollapsed }),
      // Solo se rehidrata lo persistible: un sidebarOpen guardado por error (o a mano) se ignora.
      merge: (guardado, actual) => {
        const colapsado = (guardado as Partial<Pick<UiState, 'sidebarCollapsed'>> | undefined)?.sidebarCollapsed;
        return { ...actual, sidebarCollapsed: typeof colapsado === 'boolean' ? colapsado : actual.sidebarCollapsed };
      },
    },
  ),
);

export const selectSidebarCollapsed = (estado: UiState): boolean => estado.sidebarCollapsed;
export const selectSidebarOpen = (estado: UiState): boolean => estado.sidebarOpen;
