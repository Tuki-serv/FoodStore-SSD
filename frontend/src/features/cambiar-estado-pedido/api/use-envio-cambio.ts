import type { UseMutationResult } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { clasificarErrorCambioEstado, type CambioEstadoPedido, type ClaseErrorCambioEstado, type PedidoDetalle } from '@/entities/pedido';
import { aApiError, type ApiError } from '@/shared/api';

export interface EnvioCambio {
  enviar: (cambio: CambioEstadoPedido) => void;
  pendiente: boolean;
  error: ApiError | null;
  clase: ClaseErrorCambioEstado | null;
}

export type MutacionCambio = UseMutationResult<PedidoDetalle, unknown, CambioEstadoPedido>;

/**
 * Envío de un cambio desde un diálogo con la mutación dada (`useCambiarEstadoPedido` o `useCancelarMiPedido`): una sola
 * petición a la vez (aunque haya doble clic) y el error clasificado para mostrarlo ahí mismo.
 */
export function useEnvioCambio(mutacion: MutacionCambio, onExito: () => void): EnvioCambio {
  const [error, setError] = useState<ApiError | null>(null);
  const enviando = useRef(false);

  const enviar = (cambio: CambioEstadoPedido): void => {
    if (enviando.current) return;
    enviando.current = true;
    setError(null);
    mutacion.mutate(cambio, {
      onSuccess: () => onExito(),
      onError: (fallo) => setError(aApiError(fallo)),
      onSettled: () => {
        enviando.current = false;
      },
    });
  };

  return { enviar, pendiente: mutacion.isPending, error, clase: error === null ? null : clasificarErrorCambioEstado(error) };
}
