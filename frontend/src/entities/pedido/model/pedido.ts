/** Códigos de forma de pago sembrados en el backend (DD-17). */
export type FormaPagoCodigo = 'MERCADOPAGO' | 'EFECTIVO' | 'TRANSFERENCIA';

/** Item del cuerpo de `POST /pedidos/`: `personalizacion` son los ids de ingredientes excluidos (ordenados). */
export interface ItemPedidoCrear {
  producto_id: number;
  cantidad: number;
  personalizacion: number[];
}

/** Cuerpo de `POST /pedidos/`. `notas` solo viaja si se escribió; `direccion_id` es `null` para el retiro en el local. */
export interface PedidoCrear {
  direccion_id: number | null;
  forma_pago_codigo: FormaPagoCodigo;
  notas?: string;
  items: ItemPedidoCrear[];
}

/** Ítem de un pedido ya creado: snapshots del nombre, el precio y la personalización al momento de crearlo. */
export interface DetallePedido {
  pedido_id: number;
  producto_id: number;
  cantidad: number;
  nombre_snapshot: string;
  precio_snapshot: string;
  subtotal_snapshot: string;
  personalizacion: number[] | null;
  personalizacion_snapshot: string[] | null;
  created_at: string;
}

/** `PedidoDetalle` del backend: importes como decimales en string con dos decimales. */
export interface PedidoDetalle {
  id: number;
  estado_codigo: string;
  forma_pago_codigo: string;
  subtotal: string;
  descuento: string;
  costo_envio: string;
  total: string;
  notas: string | null;
  created_at: string;
  usuario_id: number;
  cliente_nombre: string;
  direccion_id: number | null;
  items: DetallePedido[];
}
