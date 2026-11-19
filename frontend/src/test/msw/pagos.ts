import { delay, http, HttpResponse } from 'msw';
import type { CrearPagoBody, EstadoPagoPedido, RespuestaCrearPago } from '@/entities/payment';
import { API } from './server';

export const CLAVE_PUBLICA_PRUEBA = 'APP_USR-clave-publica-de-prueba';

/** Fallo simulado: un rechazo del backend (`{detail, code, field}`) o ausencia de respuesta. */
export type FalloPago = 'red' | { status: number; detail: string; code?: string };

/** Estado en memoria que replica a `backend/app/modules/pagos`: lo lee y lo muta cada handler. */
export interface EstadoPagos {
  /** Cuerpos recibidos por `POST /pagos/crear`, en orden. */
  creaciones: CrearPagoBody[];
  /** Ids pedidos por `GET /pagos/:id`, en orden. */
  consultas: number[];
  /** Veces que se pidió `GET /pagos/config`. */
  configuraciones: number;
  /** `null` = `GET /pagos/config` responde 503. */
  clavePublica: string | null | 'red';
  /** Respuesta de `POST /pagos/crear` por intento (se usa la última si hay más intentos que entradas); 201 con estos campos. */
  resultados: (Partial<RespuestaCrearPago> | FalloPago)[];
  /** Respuesta de `GET /pagos/:id`. */
  estadoConsultado: Partial<EstadoPagoPedido> | FalloPago;
  /** Demora (ms) de `POST /pagos/crear`, para ver «Procesando el pago…» y el doble envío. */
  demoraCrear: number | undefined;
}

export function crearEstadoPagos(parcial: Partial<EstadoPagos> = {}): EstadoPagos {
  return {
    creaciones: [],
    consultas: [],
    configuraciones: 0,
    clavePublica: CLAVE_PUBLICA_PRUEBA,
    resultados: [{ estado: 'aprobado' }],
    estadoConsultado: { estado: null },
    demoraCrear: undefined,
    ...parcial,
  };
}

function esFallo(valor: unknown): valor is FalloPago {
  return valor === 'red' || (typeof valor === 'object' && valor !== null && 'status' in valor);
}

function respuestaDeFallo(fallo: FalloPago) {
  if (fallo === 'red') return HttpResponse.error();
  return HttpResponse.json({ detail: fallo.detail, code: fallo.code ?? `HTTP_${fallo.status}`, field: null }, { status: fallo.status });
}

/** `GET /pagos/config`, `POST /pagos/crear` y `GET /pagos/:pedido_id` con la respuesta configurable en `estado`. */
export function handlersPagos(estado: EstadoPagos) {
  return [
    http.get(`${API}/pagos/config`, () => {
      estado.configuraciones += 1;
      if (estado.clavePublica === 'red') return HttpResponse.error();
      if (estado.clavePublica === null) {
        return HttpResponse.json({ detail: 'MercadoPago no configurado: falta MP_PUBLIC_KEY', code: 'HTTP_503', field: null }, { status: 503 });
      }
      return HttpResponse.json({ public_key: estado.clavePublica });
    }),
    http.post(`${API}/pagos/crear`, async ({ request }) => {
      const cuerpo = (await request.json()) as CrearPagoBody;
      estado.creaciones.push(cuerpo);
      if (estado.demoraCrear !== undefined) await delay(estado.demoraCrear);
      const resultado = estado.resultados[Math.min(estado.creaciones.length, estado.resultados.length) - 1] ?? { estado: 'aprobado' };
      if (esFallo(resultado)) return respuestaDeFallo(resultado);
      const respuesta: RespuestaCrearPago = {
        pago_id: 31,
        pedido_id: cuerpo.pedido_id,
        estado: 'aprobado',
        mp_order_id: 'ORD01JX7',
        mp_payment_id: 'PAY01JX7',
        mp_status: 'processed',
        mp_status_detail: 'accredited',
        ...resultado,
      };
      return HttpResponse.json(respuesta, { status: 201 });
    }),
    http.get(`${API}/pagos/:pedidoId`, ({ params }) => {
      const pedidoId = Number(params.pedidoId);
      estado.consultas.push(pedidoId);
      const consultado = estado.estadoConsultado;
      if (esFallo(consultado)) return respuestaDeFallo(consultado);
      const respuesta: EstadoPagoPedido = { pedido_id: pedidoId, pago_id: null, estado: null, mp_status: null, mp_status_detail: null, ...consultado };
      return HttpResponse.json(respuesta);
    }),
  ];
}
