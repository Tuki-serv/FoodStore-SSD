import { RUTAS, esRol, type Rol, type Ruta } from '@/shared/config';
import type { IconName } from '@/shared/ui';

type Visibilidad = 'anon' | 'todos' | readonly Rol[];

export interface ItemNav {
  id: string;
  label: string;
  to: Ruta;
  icon: IconName;
}

export interface SeccionNav {
  id: string;
  /** Solo los grupos con encabezado (p. ej. «Administración») tienen título. */
  titulo?: string;
  items: ItemNav[];
}

interface ItemConfig extends ItemNav {
  visibleFor: Visibilidad;
}

interface SeccionConfig {
  id: string;
  titulo?: string;
  items: ItemConfig[];
}

const CON_SESION: readonly Rol[] = ['CLIENT', 'PEDIDOS', 'STOCK', 'ADMIN'];

/** Navegación declarada una sola vez, en orden canónico. */
const NAVEGACION: SeccionConfig[] = [
  {
    id: 'principal',
    items: [
      { id: 'catalogo', label: 'Catálogo', to: RUTAS.catalogo, icon: 'catalogo', visibleFor: 'todos' },
      { id: 'carrito', label: 'Carrito', to: RUTAS.carrito, icon: 'carrito', visibleFor: CON_SESION },
      { id: 'mis-pedidos', label: 'Mis pedidos', to: RUTAS.misPedidos, icon: 'pedidos', visibleFor: CON_SESION },
      { id: 'direcciones', label: 'Direcciones', to: RUTAS.direcciones, icon: 'direcciones', visibleFor: CON_SESION },
      { id: 'mi-cuenta', label: 'Mi cuenta', to: RUTAS.miCuenta, icon: 'cuenta', visibleFor: CON_SESION },
    ],
  },
  {
    id: 'acceso',
    items: [
      { id: 'ingresar', label: 'Ingresar', to: RUTAS.ingresar, icon: 'ingresar', visibleFor: 'anon' },
      { id: 'registrarse', label: 'Registrarse', to: RUTAS.registrarse, icon: 'registrarse', visibleFor: 'anon' },
    ],
  },
  {
    id: 'operacion',
    items: [
      { id: 'gestion-pedidos', label: 'Gestión de pedidos', to: RUTAS.gestionPedidos, icon: 'gestion', visibleFor: ['PEDIDOS', 'ADMIN'] },
    ],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    items: [
      { id: 'categorias', label: 'Categorías', to: RUTAS.adminCategorias, icon: 'categorias', visibleFor: ['ADMIN'] },
      { id: 'ingredientes', label: 'Ingredientes', to: RUTAS.adminIngredientes, icon: 'ingredientes', visibleFor: ['ADMIN'] },
      { id: 'productos', label: 'Productos y stock', to: RUTAS.adminProductos, icon: 'productos', visibleFor: ['ADMIN', 'STOCK'] },
      { id: 'usuarios', label: 'Usuarios', to: RUTAS.adminUsuarios, icon: 'usuarios', visibleFor: ['ADMIN'] },
      { id: 'dashboard', label: 'Dashboard', to: RUTAS.adminDashboard, icon: 'dashboard', visibleFor: ['ADMIN'] },
    ],
  },
];

function esVisible(visibleFor: Visibilidad, roles: readonly Rol[]): boolean {
  if (visibleFor === 'todos') return true;
  if (visibleFor === 'anon') return roles.length === 0;
  return visibleFor.some((rol) => roles.includes(rol));
}

function sinVisibilidad({ id, label, to, icon }: ItemConfig): ItemNav {
  return { id, label, to, icon };
}

/**
 * Secciones de navegación para los roles dados (unión, sin duplicados, orden canónico).
 * Los roles desconocidos para la UI (p. ej. `COCINA`) se ignoran; sin roles conocidos es la variante «sin sesión».
 * Un grupo sin ítems visibles se omite.
 */
export function seccionesParaRoles(roles: readonly string[]): SeccionNav[] {
  const conocidos = roles.filter(esRol);
  const secciones: SeccionNav[] = [];
  for (const { id, titulo, items } of NAVEGACION) {
    const visibles = items.filter((item) => esVisible(item.visibleFor, conocidos)).map(sinVisibilidad);
    if (visibles.length === 0) continue;
    secciones.push(titulo === undefined ? { id, items: visibles } : { id, titulo, items: visibles });
  }
  return secciones;
}
