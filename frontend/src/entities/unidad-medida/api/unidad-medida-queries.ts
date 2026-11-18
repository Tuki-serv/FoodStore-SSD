import { queryOptions } from '@tanstack/react-query';
import { apiClient, type Paginado } from '@/shared/api';
import type { UnidadMedida } from '../model';

const TREINTA_MINUTOS_MS = 30 * 60_000;

/** `GET /unidades-medida/?size=100`: pública; el seed trae 7, así que una página alcanza. Devuelve el arreglo de unidades. */
async function obtenerUnidades(): Promise<UnidadMedida[]> {
  const { data } = await apiClient.get<Paginado<UnidadMedida>>('/unidades-medida/', { params: { size: 100 } });
  return data.items;
}

/** Las unidades casi no cambian: se cachean 30 minutos. `unidades-medida` es clave pública. */
export const unidadMedidaQueries = {
  todas: () => queryOptions({ queryKey: ['unidades-medida', 'todas'] as const, queryFn: obtenerUnidades, staleTime: TREINTA_MINUTOS_MS }),
};
