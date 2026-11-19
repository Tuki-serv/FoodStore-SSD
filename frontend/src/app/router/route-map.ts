import { RUTAS, type Ruta } from '@/shared/config';

/** Change que implementa la pantalla real de cada ruta (mientras tanto: página provisoria). */
export type DuenoRuta = 'C-14' | 'C-15' | 'C-16b' | 'C-17a' | 'C-17b' | 'C-18' | 'C-20' | 'C-21' | 'C-22' | 'C-23' | 'C-24';

export interface RutaDeclarada {
  path: Ruta;
  title: string;
  owner: DuenoRuta;
}

/** Mapa de rutas con dueño: cada sección de la navegación apunta a una de estas. */
export const MAPA_RUTAS: readonly RutaDeclarada[] = [
  { path: RUTAS.catalogo, title: 'Catálogo', owner: 'C-16b' },
  { path: RUTAS.ingresar, title: 'Ingresar', owner: 'C-14' },
  { path: RUTAS.registrarse, title: 'Registrarse', owner: 'C-14' },
  { path: RUTAS.carrito, title: 'Carrito', owner: 'C-18' },
  { path: RUTAS.misPedidos, title: 'Mis pedidos', owner: 'C-21' },
  { path: RUTAS.direcciones, title: 'Direcciones', owner: 'C-15' },
  { path: RUTAS.miCuenta, title: 'Mi cuenta', owner: 'C-14' },
  { path: RUTAS.gestionPedidos, title: 'Gestión de pedidos', owner: 'C-22' },
  { path: RUTAS.adminCategorias, title: 'Categorías', owner: 'C-17a' },
  { path: RUTAS.adminIngredientes, title: 'Ingredientes', owner: 'C-17a' },
  { path: RUTAS.adminProductos, title: 'Productos y stock', owner: 'C-17b' },
  { path: RUTAS.adminUsuarios, title: 'Usuarios', owner: 'C-23' },
  { path: RUTAS.adminDashboard, title: 'Dashboard', owner: 'C-24' },
];
