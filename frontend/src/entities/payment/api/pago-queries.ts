import { queryOptions } from '@tanstack/react-query';
import { obtenerConfiguracionPagos, obtenerEstadoPago } from './pagos-api';

/** Consultas de pagos: clave con el dominio primero; privadas de la sesión (no figuran en `CLAVES_PUBLICAS`). */
export const pagoQueries = {
  /** Clave pública de MercadoPago: vale toda la sesión y un 503 (sin configurar) no se reintenta. */
  configuracion: () =>
    queryOptions({
      queryKey: ['pagos', 'config'] as const,
      queryFn: async () => (await obtenerConfiguracionPagos()).public_key,
      staleTime: Infinity,
      retry: false,
    }),
  /** Último intento de pago del pedido; la respuesta de `crear` se escribe acá. */
  estado: (pedidoId: number) =>
    queryOptions({
      queryKey: ['pagos', pedidoId] as const,
      queryFn: () => obtenerEstadoPago(pedidoId),
    }),
};
