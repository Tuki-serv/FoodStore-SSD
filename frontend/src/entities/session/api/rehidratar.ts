import { obtenerUsuarioActual, renovarAccess } from '@/shared/api';
import { useAuthStore } from '@/shared/auth';

/**
 * Recupera la sesión al arrancar: `POST /auth/refresh` (la cookie viaja sola) y `GET /auth/me`.
 * Cualquier fallo (401, red, 5xx) deja la sesión `anonima` y no lanza: la app sigue usable para las rutas públicas.
 */
export async function rehidratarSesion(): Promise<void> {
  const { establecerAccess, establecerSesion, cerrarLocal } = useAuthStore.getState();
  try {
    const access = await renovarAccess();
    establecerAccess(access);
    const usuario = await obtenerUsuarioActual();
    // Si /auth/me tuvo que renovar de nuevo, el access vigente es el del store.
    establecerSesion(useAuthStore.getState().accessToken ?? access, usuario);
  } catch {
    cerrarLocal();
  }
}

/**
 * Abre la sesión con el access de `POST /auth/login` (lo usa C-14): lo guarda, pide el usuario y queda `autenticada`.
 * Si `GET /auth/me` falla, la sesión queda `anonima` sin access y el `ApiError` se relanza.
 */
export async function abrirSesion(accessToken: string): Promise<void> {
  const { establecerAccess, establecerSesion, cerrarLocal } = useAuthStore.getState();
  establecerAccess(accessToken);
  try {
    const usuario = await obtenerUsuarioActual();
    establecerSesion(useAuthStore.getState().accessToken ?? accessToken, usuario);
  } catch (error) {
    cerrarLocal();
    throw error;
  }
}
