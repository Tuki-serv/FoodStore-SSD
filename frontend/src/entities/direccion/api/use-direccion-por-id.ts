import { useQuery } from '@tanstack/react-query';
import type { Direccion } from '../model';
import { direccionQueries, TAMANO_LISTA_COMPLETA } from './direccion-queries';

/**
 * La dirección con ese id, buscada en el listado completo del usuario (la misma consulta que el selector: no hay
 * `GET /direcciones/{id}`). Con `null` (retiro en el local) no pide nada.
 */
export function useDireccionPorId(id: number | null): { direccion: Direccion | undefined; cargando: boolean } {
  const consulta = useQuery({ ...direccionQueries.lista({ page: 1, size: TAMANO_LISTA_COMPLETA }), enabled: id !== null });
  return {
    direccion: id === null ? undefined : consulta.data?.items.find((direccion) => direccion.id === id),
    cargando: id !== null && consulta.isPending,
  };
}
