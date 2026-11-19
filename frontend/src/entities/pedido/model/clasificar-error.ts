import type { ApiError } from '@/shared/api';

/** Qué le toca hacer a la persona ante un rechazo de `POST /pedidos/`. */
export type ClaseErrorCreacion = 'productos' | 'forma-pago' | 'conexion' | 'sin-permiso' | 'otro';

/**
 * Textos de `detail` del backend (`PedidoService.crear_pedido`). El backend no da un código estable para estos casos
 * (todos llegan como `HTTP_400`/`HTTP_404`), así que este es el ÚNICO lugar que decide por texto: excepción documentada
 * a la regla «decidir por `code`» (design D6, OQ-1). Un texto que cambie cae en `otro`, sin romper nada.
 */
const DETALLES_PRODUCTOS: readonly string[] = [
  'No hay stock suficiente',
  'Producto no disponible',
  'Producto no encontrado',
  'No puede pedir dos veces el mismo producto con la misma personalización',
];
const DETALLES_FORMA_PAGO: readonly string[] = ['Forma de pago no está habilitada', 'Forma de pago no encontrada'];

export function clasificarErrorCreacion(error: ApiError): ClaseErrorCreacion {
  if (error.status === null || error.status >= 500) return 'conexion';
  if (error.status === 403) return 'sin-permiso';
  if (error.status === 400 || error.status === 404) {
    if (DETALLES_PRODUCTOS.includes(error.detail)) return 'productos';
    if (DETALLES_FORMA_PAGO.includes(error.detail)) return 'forma-pago';
  }
  return 'otro';
}
