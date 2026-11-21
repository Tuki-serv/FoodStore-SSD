import type { ApiError } from '@/shared/api';

/** Qué le toca hacer a la persona ante un rechazo de `POST /pedidos/`. */
export type ClaseErrorCreacion = 'productos' | 'forma-pago' | 'entrega' | 'conexion' | 'sin-permiso' | 'otro';

/** Códigos de negocio de la creación (spec `api-conventions`): el caso se decide por `code`, nunca por el texto de `detail`. */
const CODIGOS_PRODUCTOS: readonly string[] = [
  'PRODUCT_NOT_FOUND',
  'PRODUCT_UNAVAILABLE',
  'INSUFFICIENT_STOCK',
  'DUPLICATE_ITEM',
  'INVALID_CUSTOMIZATION',
];
const CODIGO_FORMA_PAGO = 'PAYMENT_METHOD_UNAVAILABLE';
const CODIGO_ENTREGA = 'ADDRESS_NOT_FOUND';

export function clasificarErrorCreacion(error: ApiError): ClaseErrorCreacion {
  if (error.status === null || error.status >= 500) return 'conexion';
  if (error.status === 403) return 'sin-permiso';
  if (CODIGOS_PRODUCTOS.includes(error.code)) return 'productos';
  if (error.code === CODIGO_FORMA_PAGO) return 'forma-pago';
  if (error.code === CODIGO_ENTREGA) return 'entrega';
  return 'otro';
}
