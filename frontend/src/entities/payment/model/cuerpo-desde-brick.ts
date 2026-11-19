import type { CrearPagoBody, TipoPago } from './pago';

/** Lo que usamos de lo que entrega `onSubmit` del brick `CardPayment` (los números pueden llegar como texto). */
export interface DatosBrick {
  token: string;
  payment_method_id: string;
  installments: number | string;
  issuer_id?: number | string | null;
  payer: { email?: string; identification?: { type?: string; number?: string } };
}

export interface AdicionalBrick {
  paymentTypeId?: string;
}

const TIPOS_ADMITIDOS: readonly string[] = ['credit_card', 'debit_card'];

function aEnteroONull(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Arma el cuerpo de `POST /pagos/crear` a partir de lo que entrega el brick. Solo copia los campos del contrato
 * (PCI SAQ-A: sin datos de tarjeta; el resto de lo que traiga el brick se descarta).
 */
export function cuerpoDesdeBrick(pedidoId: number, datos: DatosBrick, adicional: AdicionalBrick | undefined): CrearPagoBody {
  const tipo = adicional?.paymentTypeId;
  if (tipo === undefined || !TIPOS_ADMITIDOS.includes(tipo)) {
    throw new Error('El formulario de tarjeta no informó un tipo de pago admitido');
  }
  const email = datos.payer.email ?? '';
  const { type, number } = datos.payer.identification ?? {};
  return {
    pedido_id: pedidoId,
    token: datos.token,
    payment_method_id: datos.payment_method_id,
    payment_type_id: tipo as TipoPago,
    installments: Number(datos.installments),
    issuer_id: aEnteroONull(datos.issuer_id),
    payer: type && number ? { email, identification: { type, number } } : { email },
  };
}
