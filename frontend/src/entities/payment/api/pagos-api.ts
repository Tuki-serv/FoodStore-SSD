import { apiClient } from '@/shared/api';
import type { ConfiguracionPagos, CrearPagoBody, EstadoPagoPedido, RespuestaCrearPago } from '../model';

/** `GET /pagos/config` (usuario autenticado): clave pública de MercadoPago; 503 si el backend no la tiene configurada. */
export async function obtenerConfiguracionPagos(): Promise<ConfiguracionPagos> {
  const { data } = await apiClient.get<ConfiguracionPagos>('/pagos/config');
  return data;
}

/** `GET /pagos/{pedido_id}`: último intento de pago del pedido (`estado: null` si no tiene intentos). */
export async function obtenerEstadoPago(pedidoId: number): Promise<EstadoPagoPedido> {
  const { data } = await apiClient.get<EstadoPagoPedido>(`/pagos/${pedidoId}`);
  return data;
}

/** `POST /pagos/crear`: cobra con el token del brick y responde el resultado inmediato (201). */
export async function crearPago(cuerpo: CrearPagoBody): Promise<RespuestaCrearPago> {
  const { data } = await apiClient.post<RespuestaCrearPago>('/pagos/crear', cuerpo);
  return data;
}
