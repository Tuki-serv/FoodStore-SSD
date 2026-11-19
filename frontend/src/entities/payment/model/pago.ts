/** Estado de un intento de pago tal como lo devuelve el backend (`PagoCrearResponse` / `PagoEstadoResponse`). */
export type PagoEstado = 'pendiente' | 'aprobado' | 'rechazado' | 'a_devolver';

/** Respuesta de `POST /pagos/crear` (201). */
export interface RespuestaCrearPago {
  pago_id: number;
  pedido_id: number;
  estado: PagoEstado;
  mp_order_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  mp_status_detail: string | null;
}

/** Respuesta de `GET /pagos/{pedido_id}`: `estado` es `null` si el pedido todavía no tiene intentos. */
export interface EstadoPagoPedido {
  pedido_id: number;
  pago_id: number | null;
  estado: PagoEstado | null;
  mp_status: string | null;
  mp_status_detail: string | null;
}

/** Respuesta de `GET /pagos/config`. */
export interface ConfiguracionPagos {
  public_key: string;
}

export type TipoPago = 'credit_card' | 'debit_card';

/** Cuerpo exacto de `POST /pagos/crear` (`CrearPagoRequest`): nunca lleva datos de tarjeta, solo el token del brick. */
export interface CrearPagoBody {
  pedido_id: number;
  token: string;
  payment_method_id: string;
  payment_type_id: TipoPago;
  installments: number;
  issuer_id: number | null;
  payer: { email: string; identification?: { type: string; number: string } };
}
