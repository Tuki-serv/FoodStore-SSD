/** Paths de la aplicación, en español como la UI. Fuente única: la navegación y el router los referencian desde acá. */
export const RUTAS = {
  raiz: '/',
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
