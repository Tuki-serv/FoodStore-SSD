import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import type { CategoriaCambios, CategoriaDatos } from '../model';
import { crearCategoria, editarCategoria, eliminarCategoria } from './categorias-api';

/**
 * Invalidación única tras una mutación de categorías: el árbol (`['categorias']`, el mismo que lee el catálogo público)
 * y los productos (las tarjetas muestran la categoría principal por nombre). Sin optimismo: el servidor decide el orden.
 */
function useInvalidarCategorias() {
  const cliente = useQueryClient();
  return {
    onSuccess: async (): Promise<void> => {
      await Promise.all([cliente.invalidateQueries({ queryKey: ['categorias'] }), cliente.invalidateQueries({ queryKey: ['productos'] })]);
    },
  };
}

export function useCrearCategoria() {
  return useMutation({ mutationFn: (datos: CategoriaDatos) => crearCategoria(datos), ...useInvalidarCategorias() });
}

export function useEditarCategoria() {
  return useMutation({
    mutationFn: ({ id, cambios }: { id: number; cambios: CategoriaCambios }) => editarCategoria(id, cambios),
    ...useInvalidarCategorias(),
  });
}

/**
 * La baja también refresca el árbol cuando el servidor la rechaza porque el árbol mostrado estaba desactualizado:
 * 409 `CATEGORY_HAS_CHILDREN` (apareció una subcategoría) o 404 (ya la eliminaron en otro lado).
 */
export function useEliminarCategoria() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => eliminarCategoria(id),
    ...useInvalidarCategorias(),
    onError: (error: ApiError): void => {
      if (error.code === 'CATEGORY_HAS_CHILDREN' || error.status === 404) void cliente.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}
