import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IngredienteCambios, IngredienteDatos } from '../model';
import { crearIngrediente, editarIngrediente, eliminarIngrediente } from './ingredientes-api';

/**
 * Invalidación única tras una mutación de ingredientes: el listado (`['ingredientes']`) y los productos
 * (el detalle público muestra la marca de alérgeno de cada ingrediente).
 */
function useInvalidarIngredientes() {
  const cliente = useQueryClient();
  return {
    onSuccess: async (): Promise<void> => {
      await Promise.all([cliente.invalidateQueries({ queryKey: ['ingredientes'] }), cliente.invalidateQueries({ queryKey: ['productos'] })]);
    },
  };
}

export function useCrearIngrediente() {
  return useMutation({ mutationFn: (datos: IngredienteDatos) => crearIngrediente(datos), ...useInvalidarIngredientes() });
}

export function useEditarIngrediente() {
  return useMutation({
    mutationFn: ({ id, cambios }: { id: number; cambios: IngredienteCambios }) => editarIngrediente(id, cambios),
    ...useInvalidarIngredientes(),
  });
}

export function useEliminarIngrediente() {
  return useMutation({ mutationFn: (id: number) => eliminarIngrediente(id), ...useInvalidarIngredientes() });
}
