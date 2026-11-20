import { useRef, useState } from 'react';
import { clasificarErrorCambioEstado, type CambioEstadoPedido, type ClaseErrorCambioEstado } from '@/entities/pedido';
import { aApiError, type ApiError } from '@/shared/api';
import { useCambiarEstadoPedido } from './use-cambiar-estado-pedido';

export interface EnvioCambio {
  enviar: (cambio: CambioEstadoPedido) => void;
  pendiente: boolean;
  error: ApiError | null;
  clase: ClaseErrorCambioEstado | null;
}

/** Envío de un cambio desde un diálogo: un solo PATCH a la vez (aunque haya doble clic) y el error clasificado para mostrarlo ahí mismo. */
export function useEnvioCambio(pedidoId: number, onExito: () => void): EnvioCambio {
  const mutacion = useCambiarEstadoPedido(pedidoId);
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
