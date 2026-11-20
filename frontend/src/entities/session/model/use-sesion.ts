import { useMutation } from '@tanstack/react-query';
import {
  actualizarPerfilRemoto,
  cerrarSesionRemota,
  cerrarTodasLasSesionesRemota,
  iniciarSesionRemota,
  obtenerUsuarioActual,
  registrarUsuarioRemoto,
  type CredencialesIngreso,
  type DatosRegistro,
} from '@/shared/api';
import { selectEstado, selectRoles, selectUsuario, useAuthStore } from '@/shared/auth';
import { abrirSesion } from '../api';

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

/** Login (`POST /auth/login`) y apertura de la sesión con el access recibido; los fallos se relanzan como `ApiError`. */
export function useIniciarSesion() {
  return useMutation({
    mutationFn: async (credenciales: CredencialesIngreso): Promise<void> => {
      await abrirSesion(await iniciarSesionRemota(credenciales));
    },
  });
}

/** Resultado de registrarse: sesión abierta, o cuenta creada pero sin sesión (el login posterior falló). */
export type ResultadoRegistro = { tipo: 'sesionAbierta' } | { tipo: 'cuentaCreadaSinSesion'; email: string };

/**
 * Registro y auto-login (DU-1): `POST /auth/register` y, con 201, login con las mismas credenciales. Si el registro falla,
 * se relanza su error; si falla el login posterior, la cuenta ya existe y se devuelve `cuentaCreadaSinSesion`.
 */
export function useRegistrarse() {
  return useMutation({
    mutationFn: async (datos: DatosRegistro): Promise<ResultadoRegistro> => {
      const creado = await registrarUsuarioRemoto(datos);
      try {
        await abrirSesion(await iniciarSesionRemota({ email: creado.email, password: datos.password }));
        return { tipo: 'sesionAbierta' };
      } catch {
        return { tipo: 'cuentaCreadaSinSesion', email: creado.email };
      }
    },
  });
}

/** `PATCH /usuarios/me` y reemplazo de los datos de la sesión conservando sus roles (la respuesta no los trae). */
export function useActualizarPerfil() {
  return useMutation({
    mutationFn: actualizarPerfilRemoto,
    onSuccess: (usuario) => {
      const { roles } = useAuthStore.getState().usuario ?? { roles: [] };
      useAuthStore.getState().establecerUsuario({ ...usuario, roles });
    },
  });
}

/**
 * Vuelve a pedir `GET /auth/me` y reemplaza el usuario de la sesión (el access no cambia). Lo usa quien edita sus propios roles
 * (C-23): el panel lateral deriva sus secciones de los roles de la sesión.
 */
export function useRefrescarSesion() {
  return useMutation({
    mutationFn: obtenerUsuarioActual,
    onSuccess: (usuario) => useAuthStore.getState().establecerUsuario(usuario),
  });
}

/** Cierra todas las sesiones (`POST /auth/logout-all`) y, responda lo que responda, deja la sesión local `anonima`. */
export function useCerrarTodasLasSesiones() {
  return useMutation({
    mutationFn: cerrarTodasLasSesionesRemota,
    onSettled: () => {
      useAuthStore.getState().cerrarLocal({ motivo: 'logout' });
    },
  });
}
