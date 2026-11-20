export { INTERVALO_ACTUALIZACION_MS } from './actualizacion';
export { BRAND_NAME, LOGO_ALT } from './brand';
export { readConfig, VARIABLES_FRONTEND } from './env';
export type { AppConfig } from './env';
export { NOMBRE_ROL, nombreDeRol, ROLES, esRol } from './roles';
export type { Rol } from './roles';
export {
  ACCESO_RUTAS,
  puedeAcceder,
  RUTA_FINALIZAR_COMPRA,
  RUTA_GESTION_PEDIDO,
  RUTA_MI_PEDIDO,
  RUTA_PAGO_PEDIDO,
  RUTA_PEDIDO_CREADO,
  RUTA_PRODUCTO,
  RUTAS,
  rutaGestionPedido,
  rutaMiPedido,
  rutaPagoPedido,
  rutaPedidoCreado,
  rutaProducto,
} from './routes';
export type { Acceso, EstadoAcceso, Ruta } from './routes';
