import { useAuthStore } from '@/shared/auth';

/** Deja la sesión del store autenticada con los roles dados (sin pasar por la red), como lo haría el login. */
export function iniciarSesionDePrueba(roles: string[] = ['CLIENT']): void {
  useAuthStore.getState().establecerSesion('A1', { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles });
}

/** Deja la sesión como visitante anónimo (el estado inicial `verificando` no existe en una app ya montada). */
export function quedarAnonimo(): void {
  useAuthStore.getState().cerrarLocal();
}
