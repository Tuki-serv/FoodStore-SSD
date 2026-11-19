import type { FormaPagoCodigo } from './pedido';

export interface FormaPago {
  codigo: FormaPagoCodigo;
  etiqueta: string;
  /** Texto corto bajo la etiqueta. */
  descripcion: string;
  /** El local confirma el pago a mano (DD-22): el pedido queda `PENDIENTE` hasta entonces. */
  confirmacionManual: boolean;
}

/** Catálogo local de formas de pago (las tres del seed; el backend no tiene endpoint que las liste). Orden de presentación. */
export const FORMAS_PAGO: readonly FormaPago[] = [
  { codigo: 'MERCADOPAGO', etiqueta: 'Tarjeta (Mercado Pago)', descripcion: 'Crédito o débito', confirmacionManual: false },
  { codigo: 'EFECTIVO', etiqueta: 'Efectivo', descripcion: 'Pagás al recibirlo o retirarlo', confirmacionManual: true },
  { codigo: 'TRANSFERENCIA', etiqueta: 'Transferencia bancaria', descripcion: 'El local te pasa los datos', confirmacionManual: true },
];

/** ¿El local confirma a mano el pago de esta forma? Un código desconocido no la requiere. */
export function esConfirmacionManual(codigo: string): boolean {
  return FORMAS_PAGO.some((forma) => forma.codigo === codigo && forma.confirmacionManual);
}
