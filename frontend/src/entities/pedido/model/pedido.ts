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

/** Estados del pedido (seed de `estado_pedido`). */
export type EstadoPedidoCodigo = 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREP' | 'EN_CAMINO' | 'ENTREGADO' | 'CANCELADO';

/** Resumen de la dirección de entrega de un pedido (`direccion` del detalle). */
export interface DireccionPedido {
  id: number;
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigo_postal: string | null;
}

/** Elemento del listado `GET /pedidos/`: el pedido y su dueño, sin ítems. */
export interface PedidoResumen {
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
}

/** Filtros del listado de pedidos: sin `estado`/`desde`/`hasta` significa «todos» (fechas `YYYY-MM-DD`, UTC). */
export interface FiltrosListadoPedidos {
  estado?: EstadoPedidoCodigo;
  desde?: string;
  hasta?: string;
  page: number;
  size: number;
}

/** Fila del historial append-only de un pedido; `usuario_*` nulos = lo hizo el Sistema. */
export interface EventoHistorial {
  id: number;
  pedido_id: number;
  estado_desde: string | null;
  estado_hacia: string;
  motivo: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  created_at: string;
}

/** Cuerpo de `PATCH /pedidos/{id}/estado`; `motivo` solo viaja si se escribió (obligatorio al cancelar). */
export interface CambioEstadoPedido {
  nuevo_estado: EstadoPedidoCodigo;
  motivo?: string;
}

/** `PedidoDetalle` del backend: importes como decimales en string con dos decimales. */
export interface PedidoDetalle extends PedidoResumen {
  direccion_id: number | null;
  /** Resumen de la dirección de entrega; `null` para el retiro en el local. */
  direccion: DireccionPedido | null;
  items: DetallePedido[];
}
