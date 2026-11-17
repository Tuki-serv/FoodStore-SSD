import { useMutation } from '@tanstack/react-query';
import { cerrarSesionRemota } from '@/shared/api';
import { selectEstado, selectRoles, selectUsuario, useAuthStore } from '@/shared/auth';

export function useSesion() {
  const estado = useAuthStore(selectEstado);
  const usuario = useAuthStore(selectUsuario);
  const roles = useAuthStore(selectRoles);
  return { estado, usuario, roles };
}

export function useRolesSesion(): readonly string[] {
  return useAuthStore(selectRoles);
}

/**
 * Cierra la sesión: `POST /auth/logout` (renueva el access si venció) y, responda lo que responda el backend,
 * deja la sesión local `anonima`. El carrito persistido no se toca (CE-14).
 */
export function useCerrarSesion() {
  return useMutation({
    mutationFn: cerrarSesionRemota,
    onSettled: () => {
      useAuthStore.getState().cerrarLocal({ motivo: 'logout' });
    },
  });
}
