import { delay, http, HttpResponse } from 'msw';
import type { DetallePedido, DireccionPedido, EventoHistorial, PedidoDetalle, PedidoResumen } from '@/entities/pedido';
import type { Paginado } from '@/shared/api';
import { API } from './server';

/** Cómo responde `POST /pedidos/`: 201, un rechazo del backend (`{detail, code, field}`) o un fallo de red. */
export type RespuestaCrearPedido = 'ok' | 'red' | { status: number; detail: string; code?: string; field?: string | null };

/** Respuesta forzable de una ruta: un rechazo del backend (`{detail, code, field}`) o un fallo de red. */
export type FalloPedidos = 'red' | { status: number; detail: string; code?: string; field?: string | null };

/** Fallos forzables por ruta; mientras uno esté puesto, esa ruta responde con él (cada test lo pone y lo saca). */
export interface FallosPedidos {
  lista?: FalloPedidos;
  detalle?: FalloPedidos;
  historial?: FalloPedidos;
  /** `PATCH /pedidos/:id/estado` (p. ej. 409 `INSUFFICIENT_STOCK`, 409 `INVALID_TRANSITION`, 403, 404, 422, 500, red). */
  estado?: FalloPedidos;
}

/** Cuerpo recibido por `PATCH /pedidos/:id/estado`. */
export interface CambioEstadoRecibido {
  id: number;
  cuerpo: { nuevo_estado: string; motivo?: string };
}

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
  /** Historial por pedido; un pedido sin entrada tiene el evento inicial «Pedido creado» de su dueño. */
  historiales: Map<number, EventoHistorial[]>;
  /** Query strings recibidos por `GET /pedidos/` (el listado), en orden. */
  consultasLista: Record<string, string>[];
  /** Ids pedidos por `GET /pedidos/:id/historial`, en orden. */
  consultasHistorial: number[];
  /** Cuerpos recibidos por `PATCH /pedidos/:id/estado`, en orden (incluye los rechazados). */
  cambiosEstado: CambioEstadoRecibido[];
  fallos: FallosPedidos;
  /** Demora (ms) de `GET /pedidos/` (el listado), para ver «Actualizando…». */
  demoraLista: number | undefined;
  /** Demora (ms) de `PATCH /pedidos/:id/estado`, para ver «Guardando…» y el doble clic. */
  demoraEstado: number | undefined;
  /** Quién hace los cambios de estado en el historial (el gestor de la sesión). */
  actor: { id: number; nombre: string };
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
    historiales: new Map(),
    consultasLista: [],
    consultasHistorial: [],
    cambiosEstado: [],
    fallos: {},
    demoraLista: undefined,
    demoraEstado: undefined,
    actor: { id: 9, nombre: 'Carla' },
    ...parcial,
  };
}

/** Dirección de entrega del detalle («Casa», Av. Siempre Viva 742, Springfield). */
export function direccionDto(parcial: Partial<DireccionPedido> & Pick<DireccionPedido, 'id'>): DireccionPedido {
  return { alias: 'Casa', linea1: 'Av. Siempre Viva 742', linea2: null, ciudad: 'Springfield', provincia: null, codigo_postal: null, ...parcial };
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
    direccion: direccionDto({ id: 4 }),
    items: [],
    ...parcial,
  };
}

/** Fila del historial tal como la devuelve el backend (`usuario_nombre` ya resuelto). */
export function eventoDto(parcial: Partial<EventoHistorial> & Pick<EventoHistorial, 'id' | 'pedido_id' | 'estado_hacia'>): EventoHistorial {
  return {
    estado_desde: null,
    motivo: null,
    usuario_id: 1,
    usuario_nombre: 'Ana Gómez',
    created_at: '2026-11-19T12:00:00Z',
    ...parcial,
  };
}

/** Agrega pedidos al estado (con su historial si se da; si no, el evento inicial). */
export function agregarPedidos(estado: EstadoPedidos, pedidos: PedidoDetalle[], historiales: Record<number, EventoHistorial[]> = {}): void {
  for (const pedido of pedidos) {
    estado.pedidos.set(pedido.id, pedido);
    const historial = historiales[pedido.id];
    if (historial !== undefined) estado.historiales.set(pedido.id, historial);
  }
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
  const direccionId = cuerpo.direccion_id ?? null;
  return pedidoDto({
    id,
    forma_pago_codigo: cuerpo.forma_pago_codigo,
    subtotal: (subtotalCentavos / 100).toFixed(2),
    total: ((subtotalCentavos + 5000) / 100).toFixed(2),
    notas: cuerpo.notas ?? null,
    direccion_id: direccionId,
    direccion: direccionId === null ? null : direccionDto({ id: direccionId }),
    items,
  });
}

/** Destinos que la FSM del backend permite a `PEDIDOS`/`ADMIN` (copia independiente de `fsm.py` para el doble de red). */
const DESTINOS_GESTION: Record<string, string[]> = {
  PENDIENTE: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['EN_PREP', 'CANCELADO'],
  EN_PREP: ['EN_CAMINO', 'CANCELADO'],
  EN_CAMINO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

function respuestaDeFallo(fallo: FalloPedidos): Response {
  if (fallo === 'red') return HttpResponse.error();
  return HttpResponse.json({ detail: fallo.detail, code: fallo.code ?? `HTTP_${fallo.status}`, field: fallo.field ?? null }, { status: fallo.status });
}

const noEncontrado = () => HttpResponse.json({ detail: 'Pedido no encontrado', code: 'HTTP_404', field: null }, { status: 404 });

function historialDe(estado: EstadoPedidos, pedido: PedidoDetalle): EventoHistorial[] {
  const guardado = estado.historiales.get(pedido.id);
  if (guardado !== undefined) return guardado;
  const inicial = [
    eventoDto({
      id: pedido.id * 100,
      pedido_id: pedido.id,
      estado_hacia: 'PENDIENTE',
      motivo: 'Pedido creado',
      usuario_id: pedido.usuario_id,
      usuario_nombre: pedido.cliente_nombre,
      created_at: pedido.created_at,
    }),
  ];
  estado.historiales.set(pedido.id, inicial);
  return inicial;
}

function aResumen(pedido: PedidoDetalle): PedidoResumen {
  return {
    id: pedido.id,
    estado_codigo: pedido.estado_codigo,
    forma_pago_codigo: pedido.forma_pago_codigo,
    subtotal: pedido.subtotal,
    descuento: pedido.descuento,
    costo_envio: pedido.costo_envio,
    total: pedido.total,
    notas: pedido.notas,
    created_at: pedido.created_at,
    usuario_id: pedido.usuario_id,
    cliente_nombre: pedido.cliente_nombre,
  };
}

/** `GET /pedidos/` (filtros y paginación reales sobre el estado), `GET /pedidos/:id`, `GET /pedidos/:id/historial`, `PATCH /pedidos/:id/estado` y `POST /pedidos/`. */
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
    http.get(`${API}/pedidos/`, async ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      estado.consultasLista.push(params);
      if (estado.demoraLista !== undefined) await delay(estado.demoraLista);
      if (estado.fallos.lista !== undefined) return respuestaDeFallo(estado.fallos.lista);
      const page = Number(params.page ?? 1);
      const size = Number(params.size ?? 20);
      const filtrados = [...estado.pedidos.values()]
        .filter((pedido) => params.estado === undefined || pedido.estado_codigo === params.estado)
        .filter((pedido) => params.desde === undefined || pedido.created_at.slice(0, 10) >= params.desde)
        .filter((pedido) => params.hasta === undefined || pedido.created_at.slice(0, 10) <= params.hasta)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
      const cuerpo: Paginado<PedidoResumen> = {
        items: filtrados.slice((page - 1) * size, page * size).map(aResumen),
        total: filtrados.length,
        page,
        size,
        pages: Math.ceil(filtrados.length / size),
      };
      return HttpResponse.json(cuerpo);
    }),
    http.get(`${API}/pedidos/:id`, ({ params }) => {
      const id = Number(params.id);
      estado.consultas.push(id);
      if (estado.fallos.detalle !== undefined) return respuestaDeFallo(estado.fallos.detalle);
      const pedido = estado.pedidos.get(id);
      return pedido === undefined ? noEncontrado() : HttpResponse.json(pedido);
    }),
    http.get(`${API}/pedidos/:id/historial`, ({ params }) => {
      const id = Number(params.id);
      estado.consultasHistorial.push(id);
      if (estado.fallos.historial !== undefined) return respuestaDeFallo(estado.fallos.historial);
      const pedido = estado.pedidos.get(id);
      return pedido === undefined ? noEncontrado() : HttpResponse.json(historialDe(estado, pedido));
    }),
    http.patch(`${API}/pedidos/:id/estado`, async ({ params, request }) => {
      const id = Number(params.id);
      const cuerpo = (await request.json()) as CambioEstadoRecibido['cuerpo'];
      estado.cambiosEstado.push({ id, cuerpo });
      if (estado.demoraEstado !== undefined) await delay(estado.demoraEstado);
      if (estado.fallos.estado !== undefined) return respuestaDeFallo(estado.fallos.estado);
      const pedido = estado.pedidos.get(id);
      if (pedido === undefined) return noEncontrado();
      const permitidos = DESTINOS_GESTION[pedido.estado_codigo] ?? [];
      const confirmaMercadoPago = cuerpo.nuevo_estado === 'CONFIRMADO' && pedido.forma_pago_codigo === 'MERCADOPAGO';
      if (!permitidos.includes(cuerpo.nuevo_estado) || confirmaMercadoPago) {
        return HttpResponse.json(
          { detail: `No se puede cambiar de ${pedido.estado_codigo} a ${cuerpo.nuevo_estado}`, code: 'INVALID_TRANSITION', field: null },
          { status: 409 },
        );
      }
      const historial = historialDe(estado, pedido);
      historial.push(
        eventoDto({
          id: pedido.id * 100 + historial.length,
          pedido_id: id,
          estado_desde: pedido.estado_codigo,
          estado_hacia: cuerpo.nuevo_estado,
          motivo: cuerpo.motivo ?? null,
          usuario_id: estado.actor.id,
          usuario_nombre: estado.actor.nombre,
          created_at: new Date().toISOString(),
        }),
      );
      const actualizado = { ...pedido, estado_codigo: cuerpo.nuevo_estado };
      estado.pedidos.set(id, actualizado);
      return HttpResponse.json(actualizado);
    }),
  ];
}
