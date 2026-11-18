import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import type { DireccionDatos } from '../model';
import { actualizarDireccion, crearDireccion, eliminarDireccion, marcarDireccionPrincipal } from './direcciones-api';
import { direccionQueries } from './direccion-queries';

/**
 * Invalidación de `['direcciones']` (único lugar): el orden y la principal los decide el servidor (sin optimismo).
 * Se invalida al terminar bien, y también ante un 403/404: la dirección ya no existe y el listado quedó desactualizado.
 */
function useInvalidarDirecciones() {
  const cliente = useQueryClient();
  const invalidar = (): Promise<void> => cliente.invalidateQueries({ queryKey: direccionQueries.todas() });
  return {
    onSuccess: invalidar,
    onError: (error: ApiError): void => {
      if (error.status === 403 || error.status === 404) void invalidar();
    },
  };
}

export function useCrearDireccion() {
  return useMutation({ mutationFn: (datos: DireccionDatos) => crearDireccion(datos), ...useInvalidarDirecciones() });
}

export function useActualizarDireccion() {
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DireccionDatos }) => actualizarDireccion(id, datos),
    ...useInvalidarDirecciones(),
  });
}

export function useMarcarPrincipal() {
  return useMutation({ mutationFn: (id: number) => marcarDireccionPrincipal(id), ...useInvalidarDirecciones() });
}

export function useEliminarDireccion() {
  return useMutation({ mutationFn: (id: number) => eliminarDireccion(id), ...useInvalidarDirecciones() });
}
