import type { EstadoPedidoCodigo } from './pedido';

export type TipoAccionPedido = 'avance' | 'confirmar-pago' | 'cancelar';

export interface AccionPedido {
  destino: EstadoPedidoCodigo;
  etiqueta: string;
  tipo: TipoAccionPedido;
}

const CANCELAR: AccionPedido = { destino: 'CANCELADO', etiqueta: 'Cancelar pedido', tipo: 'cancelar' };
const CONFIRMAR_PAGO: AccionPedido = { destino: 'CONFIRMADO', etiqueta: 'Confirmar pago', tipo: 'confirmar-pago' };
const PASAR_A_PREPARACION: AccionPedido = { destino: 'EN_PREP', etiqueta: 'Pasar a preparación', tipo: 'avance' };
const DESPACHAR: AccionPedido = { destino: 'EN_CAMINO', etiqueta: 'Despachar', tipo: 'avance' };
const MARCAR_ENTREGADO: AccionPedido = { destino: 'ENTREGADO', etiqueta: 'Marcar entregado', tipo: 'avance' };

/**
 * Acciones que la FSM del backend permite a `PEDIDOS`/`ADMIN` (misma tabla para ambos) según el estado y la forma de pago.
 * Es una COPIA de `backend/app/modules/pedidos/fsm.py` (`_GESTION` + `CONFIRMAN_POR_FORMA_PAGO`): la UI solo esconde lo
 * imposible; el backend sigue siendo la autoridad y cualquier rechazo se muestra (`clasificarErrorCambioEstado`).
 * Un pedido `MERCADOPAGO` se confirma solo con el pago aprobado, así que en `PENDIENTE` no ofrece «Confirmar pago».
 */
export function accionesGestion(estado: string, formaPago: string): AccionPedido[] {
  switch (estado) {
    case 'PENDIENTE':
      return formaPago === 'MERCADOPAGO' ? [CANCELAR] : [CONFIRMAR_PAGO, CANCELAR];
    case 'CONFIRMADO':
      return [PASAR_A_PREPARACION, CANCELAR];
    case 'EN_PREP':
      return [DESPACHAR, CANCELAR];
    case 'EN_CAMINO':
      return [MARCAR_ENTREGADO];
    default:
      return [];
  }
}

/** La única acción que no es cancelar (la que ofrece la fila del listado), o `null` si no hay avance posible. */
export function proximoAvance(estado: string, formaPago: string): AccionPedido | null {
  return accionesGestion(estado, formaPago).find((accion) => accion.tipo !== 'cancelar') ?? null;
}

/**
 * `true` si el cliente dueño puede cancelar el pedido en ese estado (`DELETE /pedidos/{id}`): `PENDIENTE` y `CONFIRMADO`.
 * COPIA de `backend/app/modules/pedidos/fsm.py` (`TRANSICIONES[CLIENT]`): la UI solo esconde lo imposible; el backend sigue
 * siendo la autoridad y un 409 se muestra (`clasificarErrorCambioEstado`).
 */
export function puedeCancelarCliente(estado: string): boolean {
  return estado === 'PENDIENTE' || estado === 'CONFIRMADO';
}
