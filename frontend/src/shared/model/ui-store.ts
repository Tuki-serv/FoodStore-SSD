import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { almacenamientoSeguro } from '@/shared/lib';

export type TipoToast = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  tipo: TipoToast;
  titulo: string;
  mensaje?: string;
}

/** Diálogo de confirmación pendiente (C-13b dejó el estado; lo dibuja `ConfirmacionGlobal` del shell, C-15). */
export interface ConfirmModal {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** `peligro` pinta el botón de confirmar como acción destructiva (por defecto `normal`). */
  variante?: 'peligro' | 'normal';
  onConfirmar: () => void;
}

/** Estado de UI global (cliente). Solo `sidebarCollapsed` se persiste; el resto vale para la página abierta. */
export interface UiState {
  /** Panel lateral colapsado a solo íconos (desktop). Se persiste. */
  sidebarCollapsed: boolean;
  /** Drawer de navegación abierto (mobile). No se persiste. */
  sidebarOpen: boolean;
  /** Panel del carrito abierto (lo dibuja C-18). */
  cartOpen: boolean;
  /** Cola de notificaciones. */
  toasts: Toast[];
  confirmModal: ConfirmModal | null;
  toggleSidebarCollapsed: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  abrirCarrito: () => void;
  cerrarCarrito: () => void;
  /** Encola una notificación y devuelve su identificador único. */
  notificar: (toast: Omit<Toast, 'id'>) => string;
  descartarToast: (id: string) => void;
  pedirConfirmacion: (modal: ConfirmModal) => void;
  cerrarConfirmacion: () => void;
  /** Descarta toasts y confirmación pendiente (al terminar la sesión) sin tocar las preferencias persistidas. */
  limpiarTransitorios: () => void;
  reset: () => void;
}

export const CLAVE_UI_STORAGE = 'foodstore.ui';

const ESTADO_INICIAL = { sidebarCollapsed: false, sidebarOpen: false, cartOpen: false, toasts: [], confirmModal: null } as const;

// Contador de módulo: los ids no se repiten ni después de un `reset()`.
let ultimoIdToast = 0;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...ESTADO_INICIAL,
      toasts: [],
      toggleSidebarCollapsed: () => set((estado) => ({ sidebarCollapsed: !estado.sidebarCollapsed })),
      openSidebar: () => set({ sidebarOpen: true }),
      closeSidebar: () => set({ sidebarOpen: false }),
      abrirCarrito: () => set({ cartOpen: true }),
      cerrarCarrito: () => set({ cartOpen: false }),
      notificar: (toast) => {
        ultimoIdToast += 1;
        const id = `toast-${ultimoIdToast}`;
        set((estado) => ({ toasts: [...estado.toasts, { ...toast, id }] }));
        return id;
      },
      descartarToast: (id) => set((estado) => ({ toasts: estado.toasts.filter((toast) => toast.id !== id) })),
      pedirConfirmacion: (modal) => set({ confirmModal: modal }),
      cerrarConfirmacion: () => set({ confirmModal: null }),
      limpiarTransitorios: () => set({ toasts: [], confirmModal: null }),
      reset: () => set({ ...ESTADO_INICIAL, toasts: [] }),
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
export const selectCartOpen = (estado: UiState): boolean => estado.cartOpen;
export const selectToasts = (estado: UiState): Toast[] => estado.toasts;
export const selectConfirmModal = (estado: UiState): ConfirmModal | null => estado.confirmModal;
