import { delay, http, HttpResponse } from 'msw';
import type { DetallePedido, PedidoDetalle } from '@/entities/pedido';
import { API } from './server';

/** Cómo responde `POST /pedidos/`: 201, un rechazo del backend (`{detail, code, field}`) o un fallo de red. */
export type RespuestaCrearPedido = 'ok' | 'red' | { status: number; detail: string; code?: string; field?: string | null };

/** Precios del catálogo de prueba, para armar los snapshots del pedido creado a partir del cuerpo recibido. */
const CATALOGO_PRUEBA: Record<number, { nombre: string; precio: string }> = {
  1: { nombre: 'Hamburguesa Clásica', precio: '1500.00' },
  5: { nombre: 'Coca-Cola 500ml', precio: '800.00' },
};

/** Estado en memoria que replica al backend (`backend/app/modules/pedidos`): lo lee y lo muta cada handler. */
export interface EstadoPedidos {
  /** Cuerpos recibidos por `POST /pedidos/`, en orden. */
  creaciones: unknown[];
  /** Ids pedidos por `GET /pedidos/:id`, en orden. */
  consultas: number[];
  /** Pedidos existentes (`GET /pedidos/:id` responde 404 para cualquier otro id). */
  pedidos: Map<number, PedidoDetalle>;
  proximoId: number;
  respuestaCrear: RespuestaCrearPedido;
  /** Campos que pisan al pedido armado a partir del cuerpo (por ejemplo `forma_pago_codigo` o un `total` distinto). */
  pedidoCreado: Partial<PedidoDetalle>;
  /** Demora (ms) de `POST /pedidos/`, para ver «Creando pedido…» y el doble clic. */
  demoraCrear: number | undefined;
}

export function crearEstadoPedidos(parcial: Partial<EstadoPedidos> = {}): EstadoPedidos {
  return {
    creaciones: [],
    consultas: [],
    pedidos: new Map(),
    proximoId: 57,
    respuestaCrear: 'ok',
    pedidoCreado: {},
    demoraCrear: undefined,
    ...parcial,
  };
}

/** `PedidoDetalle` tal como lo devuelve el backend: un pedido `PENDIENTE` de efectivo, sin ítems salvo los dados. */
export function pedidoDto(parcial: Partial<PedidoDetalle> & Pick<PedidoDetalle, 'id'>): PedidoDetalle {
  return {
    estado_codigo: 'PENDIENTE',
    forma_pago_codigo: 'EFECTIVO',
    subtotal: '3800.00',
    descuento: '0.00',
    costo_envio: '50.00',
    total: '3850.00',
    notas: null,
    created_at: '2026-11-19T12:00:00Z',
    usuario_id: 1,
    cliente_nombre: 'Ana Gómez',
    direccion_id: 4,
    items: [],
    ...parcial,
  };
}

/** Ítem de un pedido ya creado con sus snapshots. */
export function detalleDto(parcial: Partial<DetallePedido> & Pick<DetallePedido, 'pedido_id' | 'producto_id'>): DetallePedido {
  return {
    cantidad: 1,
    nombre_snapshot: 'Producto',
    precio_snapshot: '1000.00',
    subtotal_snapshot: '1000.00',
    personalizacion: [],
    personalizacion_snapshot: [],
    created_at: '2026-11-19T12:00:00Z',
    ...parcial,
  };
}

interface CuerpoCrear {
  direccion_id?: number | null;
  forma_pago_codigo: string;
  notas?: string;
  items: { producto_id: number; cantidad: number; personalizacion?: number[] }[];
}

/** Pedido que el backend armaría con el cuerpo recibido: precios del catálogo de prueba, envío 50.00 y descuento 0.00 (DD-10). */
function pedidoDesdeCuerpo(id: number, cuerpo: CuerpoCrear): PedidoDetalle {
  const items = cuerpo.items.map((item) => {
    const producto = CATALOGO_PRUEBA[item.producto_id] ?? { nombre: `Producto ${item.producto_id}`, precio: '1000.00' };
    const subtotalCentavos = Math.round(Number(producto.precio) * 100) * item.cantidad;
    return detalleDto({
      pedido_id: id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      nombre_snapshot: producto.nombre,
      precio_snapshot: producto.precio,
      subtotal_snapshot: (subtotalCentavos / 100).toFixed(2),
      personalizacion: item.personalizacion ?? [],
    });
  });
  const subtotalCentavos = items.reduce((total, item) => total + Math.round(Number(item.subtotal_snapshot) * 100), 0);
  return pedidoDto({
    id,
    forma_pago_codigo: cuerpo.forma_pago_codigo,
    subtotal: (subtotalCentavos / 100).toFixed(2),
    total: ((subtotalCentavos + 5000) / 100).toFixed(2),
    notas: cuerpo.notas ?? null,
    direccion_id: cuerpo.direccion_id ?? null,
    items,
  });
}

/** `POST /pedidos/` y `GET /pedidos/:id` con la respuesta configurable en `estado` (201, rechazos del backend o red caída). */
export function handlersPedidos(estado: EstadoPedidos) {
  return [
    http.post(`${API}/pedidos/`, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoCrear;
      estado.creaciones.push(cuerpo);
      if (estado.demoraCrear !== undefined) await delay(estado.demoraCrear);
      const respuesta = estado.respuestaCrear;
      if (respuesta === 'red') return HttpResponse.error();
      if (respuesta !== 'ok') {
        return HttpResponse.json(
          { detail: respuesta.detail, code: respuesta.code ?? `HTTP_${respuesta.status}`, field: respuesta.field ?? null },
          { status: respuesta.status },
        );
      }
      const id = estado.proximoId;
      estado.proximoId += 1;
      const pedido = { ...pedidoDesdeCuerpo(id, cuerpo), ...estado.pedidoCreado, id };
      estado.pedidos.set(id, pedido);
      return HttpResponse.json(pedido, { status: 201 });
    }),
    http.get(`${API}/pedidos/:id`, ({ params }) => {
      const id = Number(params.id);
      estado.consultas.push(id);
      const pedido = estado.pedidos.get(id);
      if (pedido === undefined) return HttpResponse.json({ detail: 'Pedido no encontrado', code: 'HTTP_404', field: null }, { status: 404 });
      return HttpResponse.json(pedido);
    }),
  ];
}
