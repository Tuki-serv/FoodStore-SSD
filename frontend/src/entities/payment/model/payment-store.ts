import { create } from 'zustand';

export type EstadoPago = 'inactivo' | 'procesando' | 'aprobado' | 'rechazado' | 'pendiente' | 'error';

export interface ResultadoPago {
  estado: 'aprobado' | 'rechazado' | 'pendiente';
  mpPaymentId: number;
  statusDetail: string | null;
}

/**
 * Pago en curso (C-20). Solo vive en memoria: al recargar vuelve a `inactivo` (el estado real del pago lo tiene el
 * backend y llega por el webhook). Nunca guarda datos de tarjeta: la tokenización la hace MercadoPago.js.
 */
export interface PaymentState {
  pedidoId: number | null;
  estado: EstadoPago;
  mpPaymentId: number | null;
  statusDetail: string | null;
  error: string | null;
  iniciar: (pedidoId: number) => void;
  registrarResultado: (resultado: ResultadoPago) => void;
  registrarError: (mensaje: string) => void;
  reset: () => void;
}

const ESTADO_INICIAL = { pedidoId: null, estado: 'inactivo', mpPaymentId: null, statusDetail: null, error: null } as const;

export const usePaymentStore = create<PaymentState>()((set) => ({
  ...ESTADO_INICIAL,
  iniciar: (pedidoId) => set({ ...ESTADO_INICIAL, pedidoId, estado: 'procesando' }),
  registrarResultado: ({ estado, mpPaymentId, statusDetail }) => set({ estado, mpPaymentId, statusDetail, error: null }),
  registrarError: (mensaje) => set({ estado: 'error', error: mensaje }),
  reset: () => set({ ...ESTADO_INICIAL }),
}));

export const selectEstadoPago = (estado: PaymentState): EstadoPago => estado.estado;
export const selectPagoEnCurso = (estado: PaymentState): boolean => estado.estado === 'procesando';
export const selectPedidoEnPago = (estado: PaymentState): number | null => estado.pedidoId;
