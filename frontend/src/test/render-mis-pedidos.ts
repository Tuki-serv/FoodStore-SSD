import type { EventoHistorial, PedidoDetalle } from '@/entities/pedido';
import { crearEstadoPagos, handlersPagos, type EstadoPagos } from './msw/pagos';
import { agregarPedidos, crearEstadoPedidos, handlersPedidos, pedidoDto, type EstadoPedidos } from './msw/pedidos';
import { server } from './msw/server';
import { renderApp } from './render-app';

/** Un pedido de la sesión simulada (`usuario_id` 1, «Ana López») en la fecha local dada; por defecto `EFECTIVO` `PENDIENTE` por `"3850.00"` con envío. */
export function pedidoPropio(id: number, parcial: Partial<PedidoDetalle> = {}): PedidoDetalle {
  return pedidoDto({ id, usuario_id: 1, cliente_nombre: 'Ana López', created_at: new Date(2026, 10, 19, 12, 40).toISOString(), ...parcial });
}

export interface OpcionesMisPedidos {
  pedidos?: PedidoDetalle[];
  historiales?: Record<number, EventoHistorial[]>;
  estado?: Partial<EstadoPedidos>;
  /** Respuesta de `GET /pagos/:pedidoId` y demás (por defecto: sin intentos de pago). */
  pagos?: Partial<EstadoPagos>;
  roles?: string[];
}

/** Renderiza la app en una ruta de «Mis pedidos» como el usuario 1 (por defecto `CLIENT`), con la red de pedidos simulada. */
export function montarMisPedidos(ruta: string, { pedidos = [], historiales = {}, estado: parcial, pagos: pagosParcial, roles = ['CLIENT'] }: OpcionesMisPedidos = {}) {
  const estado = crearEstadoPedidos(parcial);
  agregarPedidos(estado, pedidos, historiales);
  const pagos = crearEstadoPagos(pagosParcial);
  server.use(...handlersPedidos(estado), ...handlersPagos(pagos));
  const app = renderApp(ruta, { sesion: { roles } });
  return { estado, pagos, ...app };
}
