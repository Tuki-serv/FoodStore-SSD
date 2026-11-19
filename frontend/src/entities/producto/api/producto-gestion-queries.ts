import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { listarProductosGestion, normalizarFiltrosGestion, obtenerProductoGestion, type FiltrosGestion } from './producto-gestion-api';

/**
 * Consultas de gestión de productos. `productos-gestion` es un dominio **privado** a propósito: incluye productos no
 * disponibles que solo ven ADMIN/STOCK, así que se descarta al cerrar sesión (a diferencia de `productos`, que es público).
 */
export const productoGestionQueries = {
  todas: () => ['productos-gestion'] as const,
  listas: () => ['productos-gestion', 'lista'] as const,
  lista: (filtros: FiltrosGestion) => {
    const normalizados = normalizarFiltrosGestion(filtros);
    return queryOptions({
      queryKey: ['productos-gestion', 'lista', normalizados] as const,
      queryFn: () => listarProductosGestion(normalizados),
      placeholderData: keepPreviousData,
      staleTime: 0,
    });
  },
  detalle: (id: number) =>
    queryOptions({ queryKey: ['productos-gestion', 'detalle', id] as const, queryFn: () => obtenerProductoGestion(id), staleTime: 0 }),
};
