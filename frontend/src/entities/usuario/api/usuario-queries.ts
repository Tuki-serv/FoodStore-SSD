import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { FiltrosUsuarios } from '../model';
import { listarUsuarios } from './usuarios-api';

/** Consultas de usuarios: `usuarios` es clave privada (se descarta al cerrar sesión). */
export const usuarioQueries = {
  lista: (filtros: FiltrosUsuarios) =>
    queryOptions({
      queryKey: ['usuarios', 'lista', filtros] as const,
      queryFn: () => listarUsuarios(filtros),
      placeholderData: keepPreviousData,
    }),
};
