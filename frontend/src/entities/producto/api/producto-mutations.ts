import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Paginado } from '@/shared/api';
import type { Producto, ProductoCambios, ProductoDatos } from '../model';
import {
  crearProducto,
  editarProducto,
  eliminarProducto,
  fijarDisponibilidad,
  fijarStock,
} from './producto-gestion-api';

/** Invalida la gestión (`productos-gestion`) y el catálogo público (`productos`: listados y detalle). */
async function invalidarProductos(cliente: QueryClient): Promise<void> {
  await Promise.all([cliente.invalidateQueries({ queryKey: ['productos-gestion'] }), cliente.invalidateQueries({ queryKey: ['productos'] })]);
}

/** Escribe el producto devuelto por el servidor en las listas de gestión cacheadas (la fila cambia sin esperar al refetch). */
function escribirEnListas(cliente: QueryClient, actualizado: Producto): void {
  cliente.setQueriesData<Paginado<Producto>>({ queryKey: ['productos-gestion', 'lista'] }, (pagina) =>
    pagina === undefined ? pagina : { ...pagina, items: pagina.items.map((p) => (p.id === actualizado.id ? actualizado : p)) },
  );
}

function useAlTerminar(escribir: boolean) {
  const cliente = useQueryClient();
  return async (actualizado: Producto | undefined): Promise<void> => {
    if (escribir && actualizado !== undefined) escribirEnListas(cliente, actualizado);
    await invalidarProductos(cliente);
  };
}

export function useCrearProducto() {
  const alTerminar = useAlTerminar(false);
  return useMutation({ mutationFn: (datos: ProductoDatos) => crearProducto(datos), onSuccess: (creado) => alTerminar(creado) });
}

export function useEditarProducto() {
  const alTerminar = useAlTerminar(true);
  return useMutation({
    mutationFn: ({ id, cambios }: { id: number; cambios: ProductoCambios }) => editarProducto(id, cambios),
    onSuccess: (editado) => alTerminar(editado),
  });
}

export function useEliminarProducto() {
  const alTerminar = useAlTerminar(false);
  return useMutation({ mutationFn: (id: number) => eliminarProducto(id), onSuccess: () => alTerminar(undefined) });
}

/** Stock absoluto de una fila: escribe la respuesta en la lista (no recarga la página ni pierde el foco). */
export function useFijarStock() {
  const alTerminar = useAlTerminar(true);
  return useMutation({
    mutationFn: ({ id, stock }: { id: number; stock: number }) => fijarStock(id, stock),
    onSuccess: (actualizado) => alTerminar(actualizado),
  });
}

/** Interruptor de disponibilidad de una fila: no optimista, refleja el valor devuelto por el servidor. */
export function useFijarDisponibilidad() {
  const alTerminar = useAlTerminar(true);
  return useMutation({
    mutationFn: ({ id, disponible }: { id: number; disponible: boolean }) => fijarDisponibilidad(id, disponible),
    onSuccess: (actualizado) => alTerminar(actualizado),
  });
}
