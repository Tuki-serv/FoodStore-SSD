export const MOTIVO_RECHAZO_GENERICO = 'Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.';

const FONDOS = 'La tarjeta no tiene fondos suficientes.';
const DATOS = 'Revisá los datos de la tarjeta e intentá de nuevo.';
const EMISOR = 'El banco emisor rechazó el pago. Probá con otra tarjeta o consultalo con el banco.';

/**
 * Textos aprobados en el mockup de C-20a por `mp_status_detail`. Orders y Payments usan nombres distintos para lo mismo,
 * por eso hay variantes; la tabla se ajusta con lo observado en sandbox (OQ-6). Lo desconocido cae en el texto genérico.
 */
const MOTIVOS: Readonly<Record<string, string>> = {
  insufficient_amount: FONDOS,
  cc_rejected_insufficient_amount: FONDOS,
  cc_rejected_bad_filled_card_number: DATOS,
  cc_rejected_bad_filled_other: DATOS,
  cc_rejected_bad_filled_security_code: 'El código de seguridad no es correcto.',
  cc_rejected_bad_filled_date: 'La fecha de vencimiento no es correcta.',
  rejected_by_issuer: EMISOR,
  cc_rejected_call_for_authorize: EMISOR,
  cc_rejected_card_disabled: EMISOR,
  cc_amount_rate_limit_exceeded: 'La tarjeta no admite pagos por este monto.',
  cc_rejected_duplicated_payment: 'Ya hiciste un pago igual hace un momento.',
};

export function motivoRechazo(detalle: string | null | undefined): string {
  if (detalle === null || detalle === undefined) return MOTIVO_RECHAZO_GENERICO;
  return MOTIVOS[detalle] ?? MOTIVO_RECHAZO_GENERICO;
}
