import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { listarProductos, normalizarFiltros, obtenerProducto, type FiltrosProductos } from './productos-api';

/** Consultas de productos: clave con el dominio primero (`productos` es pública: no se descarta al cerrar sesión). */
export const productoQueries = {
  todas: () => ['productos'] as const,
  listas: () => ['productos', 'lista'] as const,
  lista: (filtros: FiltrosProductos) => {
    const normalizados = normalizarFiltros(filtros);
    return queryOptions({
      queryKey: ['productos', 'lista', normalizados] as const,
      queryFn: () => listarProductos(normalizados),
      placeholderData: keepPreviousData,
    });
  },
  detalle: (id: number) => queryOptions({ queryKey: ['productos', 'detalle', id] as const, queryFn: () => obtenerProducto(id) }),
};
