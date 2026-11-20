import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CambiosUsuario, DatosAltaUsuario } from '../model';
import { actualizarUsuario, crearUsuario, desactivarUsuario } from './usuarios-api';

/** Invalidación única tras una mutación de usuarios: todo el dominio `['usuarios']`. */
function useInvalidarUsuarios() {
  const cliente = useQueryClient();
  return { onSuccess: (): Promise<void> => cliente.invalidateQueries({ queryKey: ['usuarios'] }) };
}

export function useCrearUsuario() {
  return useMutation({ mutationFn: (datos: DatosAltaUsuario) => crearUsuario(datos), ...useInvalidarUsuarios() });
}

export function useActualizarUsuario() {
  return useMutation({ mutationFn: ({ id, cambios }: { id: number; cambios: CambiosUsuario }) => actualizarUsuario(id, cambios), ...useInvalidarUsuarios() });
}

export function useDesactivarUsuario() {
  return useMutation({ mutationFn: (id: number) => desactivarUsuario(id), ...useInvalidarUsuarios() });
}
