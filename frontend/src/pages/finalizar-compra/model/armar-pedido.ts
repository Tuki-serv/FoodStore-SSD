import { itemsDesdeCarrito, type FormaPagoCodigo, type LineaParaPedido, type PedidoCrear } from '@/entities/pedido';

/** Valores ya validados del formulario de checkout. `direccionId` es `null` para el retiro en el local. */
export interface EleccionesCheckout {
  direccionId: number | null;
  formaPago: FormaPagoCodigo;
  notas: string;
}

/** Cuerpo de `POST /pedidos/`: las notas viajan recortadas y solo si quedó algo escrito. */
export function armarPedido({ direccionId, formaPago, notas }: EleccionesCheckout, lineas: readonly LineaParaPedido[]): PedidoCrear {
  const notasRecortadas = notas.trim();
  return {
    direccion_id: direccionId,
    forma_pago_codigo: formaPago,
    ...(notasRecortadas === '' ? {} : { notas: notasRecortadas }),
    items: itemsDesdeCarrito(lineas),
  };
}
