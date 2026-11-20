import type { Rol } from './roles';

/** Paths de la aplicación, en español como la UI. Fuente única: la navegación y el router los referencian desde acá. */
export const RUTAS = {
  catalogo: '/catalogo',
  ingresar: '/ingresar',
  registrarse: '/registrarse',
  carrito: '/carrito',
  misPedidos: '/mis-pedidos',
  direcciones: '/direcciones',
  miCuenta: '/mi-cuenta',
  gestionPedidos: '/gestion-pedidos',
  adminCategorias: '/admin/categorias',
  adminIngredientes: '/admin/ingredientes',
  adminProductos: '/admin/productos',
  adminUsuarios: '/admin/usuarios',
  adminDashboard: '/admin/dashboard',
} as const;

/** Detalle de producto: sub-ruta pública del catálogo. No es una sección de navegación, así que no entra en `RUTAS` ni en `ACCESO_RUTAS`. */
export const RUTA_PRODUCTO = '/catalogo/:productoId';

export const rutaProducto = (id: number): string => `${RUTAS.catalogo}/${id}`;

/** Detalle operativo de un pedido (C-22): sub-ruta de `gestionPedidos`, mismo acceso (`PEDIDOS`/`ADMIN`); fuera de `RUTAS` y `ACCESO_RUTAS`. */
export const RUTA_GESTION_PEDIDO = '/gestion-pedidos/:pedidoId';

export const rutaGestionPedido = (id: number): string => `${RUTAS.gestionPedidos}/${id}`;

/** Checkout de C-19: sub-rutas solo para `CLIENT`, fuera de `RUTAS` y `ACCESO_RUTAS` (no son secciones de navegación). */
export const RUTA_FINALIZAR_COMPRA = '/finalizar-compra';
export const RUTA_PEDIDO_CREADO = '/finalizar-compra/pedido/:pedidoId';
/** Punto de traspaso al pago con tarjeta: pantalla provisoria hasta que C-20 la implemente. */
export const RUTA_PAGO_PEDIDO = '/finalizar-compra/pedido/:pedidoId/pago';

export const rutaPedidoCreado = (id: number): string => `${RUTA_FINALIZAR_COMPRA}/pedido/${id}`;
export const rutaPagoPedido = (id: number): string => `${rutaPedidoCreado(id)}/pago`;

export type Ruta = (typeof RUTAS)[keyof typeof RUTAS];

/** Quién puede abrir una ruta: todos, solo visitantes sin sesión, cualquier usuario con sesión o ciertos roles. */
export type Acceso = 'publica' | 'anonima' | 'sesion' | { readonly roles: readonly Rol[] };

/** Estado de la sesión tal como lo necesita la tabla de acceso (coincide con `EstadoSesion` de `shared/auth`). */
export type EstadoAcceso = 'verificando' | 'autenticada' | 'anonima';

/** Tabla única de acceso por ruta: la leen el router (guards) y la navegación. Es ayuda de UX; el backend autoriza cada pedido. */
export const ACCESO_RUTAS: Record<Ruta, Acceso> = {
  [RUTAS.catalogo]: 'publica',
  [RUTAS.ingresar]: 'anonima',
  [RUTAS.registrarse]: 'anonima',
  [RUTAS.carrito]: 'sesion',
  [RUTAS.misPedidos]: 'sesion',
  [RUTAS.direcciones]: 'sesion',
  [RUTAS.miCuenta]: 'sesion',
  [RUTAS.gestionPedidos]: { roles: ['PEDIDOS', 'ADMIN'] },
  [RUTAS.adminCategorias]: { roles: ['ADMIN'] },
  [RUTAS.adminIngredientes]: { roles: ['ADMIN'] },
  [RUTAS.adminProductos]: { roles: ['ADMIN', 'STOCK'] },
  [RUTAS.adminUsuarios]: { roles: ['ADMIN'] },
  [RUTAS.adminDashboard]: { roles: ['ADMIN'] },
};

/** ¿Puede esta sesión (estado y roles) abrir una ruta con este acceso? Mientras se verifica, solo las públicas. */
export function puedeAcceder(acceso: Acceso, estado: EstadoAcceso, roles: readonly string[]): boolean {
  if (acceso === 'publica') return true;
  if (estado === 'verificando') return false;
  if (acceso === 'anonima') return estado === 'anonima';
  if (estado !== 'autenticada') return false;
  if (acceso === 'sesion') return true;
  return acceso.roles.some((rol) => roles.includes(rol));
}
