import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CrearPagoBody, EstadoPagoPedido } from '../model';
import { pagoQueries } from './pago-queries';
import { crearPago } from './pagos-api';

/**
 * Cobra el pedido con el token del brick. Al terminar bien escribe el resultado en la caché de
 * `pagoQueries.estado(pedido_id)`: la página decide la vista desde ahí, sin pedir `GET /pagos/{id}` otra vez.
 */
export function useCrearPago() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: CrearPagoBody) => crearPago(cuerpo),
    onSuccess: (respuesta) => {
      const estado: EstadoPagoPedido = {
        pedido_id: respuesta.pedido_id,
        pago_id: respuesta.pago_id,
        estado: respuesta.estado,
        mp_status: respuesta.mp_status,
        mp_status_detail: respuesta.mp_status_detail,
      };
      cliente.setQueryData(pagoQueries.estado(respuesta.pedido_id).queryKey, estado);
    },
  });
}
