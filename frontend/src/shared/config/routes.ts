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
