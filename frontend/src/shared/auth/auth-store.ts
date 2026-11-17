import { create } from 'zustand';

/** Usuario de la sesión (de `GET /auth/me`). Los roles son los `codigo` y solo informan a la UI (DD-24). */
export interface UsuarioSesion {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  roles: string[];
}

export type EstadoSesion = 'verificando' | 'autenticada' | 'anonima';
export type MotivoCierre = 'logout' | 'expirada';

/**
 * Sesión del frontend. El access token vive solo en memoria (DD-27): este store no usa `persist`.
 * La cookie HttpOnly del refresh rehidrata la sesión al recargar.
 */
export interface AuthState {
  accessToken: string | null;
  usuario: UsuarioSesion | null;
  estado: EstadoSesion;
  /** Por qué pasó a `anonima`; sirve para decidir a dónde navegar. */
  motivo: MotivoCierre | null;
  /** Fija el access sin condiciones: lo usan el login y la rehidratación, que parten de una sesión sin access. */
  establecerAccess: (accessToken: string) => void;
  /**
   * Renovación del access (401): solo aplica si el access vigente sigue siendo `previo`. Si mientras tanto hubo logout
   * o un login nuevo, la respuesta tardía se descarta y no deja un token en memoria.
   */
  renovarAccess: (previo: string | null, nuevo: string) => void;
  establecerSesion: (accessToken: string, usuario: UsuarioSesion) => void;
  establecerUsuario: (usuario: UsuarioSesion) => void;
  cerrarLocal: (opciones?: { motivo?: MotivoCierre }) => void;
  /** Vence la sesión autenticada cuyo access era `previo`; no pisa un logout ni un login posteriores. */
  expirarSesion: (previo: string | null) => void;
  /** Borra el motivo una vez que la UI ya reaccionó a él. */
  limpiarMotivo: () => void;
  reset: () => void;
}

const ESTADO_INICIAL = { accessToken: null, usuario: null, estado: 'verificando', motivo: null } as const;

export const useAuthStore = create<AuthState>()((set, get) => ({
  ...ESTADO_INICIAL,
  establecerAccess: (accessToken) => set({ accessToken }),
  renovarAccess: (previo, nuevo) => {
    if (previo !== null && get().accessToken === previo) set({ accessToken: nuevo });
  },
  establecerSesion: (accessToken, usuario) => set({ accessToken, usuario, estado: 'autenticada', motivo: null }),
  establecerUsuario: (usuario) => set({ usuario }),
  cerrarLocal: (opciones) =>
    set({ accessToken: null, usuario: null, estado: 'anonima', motivo: opciones?.motivo ?? null }),
  expirarSesion: (previo) => {
    const { estado, accessToken } = get();
    if (estado !== 'autenticada' || accessToken !== previo) return;
    set({ accessToken: null, usuario: null, estado: 'anonima', motivo: 'expirada' });
  },
  limpiarMotivo: () => set({ motivo: null }),
  reset: () => set({ ...ESTADO_INICIAL }),
}));

const SIN_ROLES: readonly string[] = [];

export const selectEstado = (estado: AuthState): EstadoSesion => estado.estado;
export const selectUsuario = (estado: AuthState): UsuarioSesion | null => estado.usuario;
export const selectRoles = (estado: AuthState): readonly string[] => estado.usuario?.roles ?? SIN_ROLES;
export const selectEstaAutenticado = (estado: AuthState): boolean => estado.estado === 'autenticada';
export const selectAccessToken = (estado: AuthState): string | null => estado.accessToken;
