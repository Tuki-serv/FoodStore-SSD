import { ACCESO_RUTAS, RUTAS, esRol, puedeAcceder, type Ruta } from '@/shared/config';
import type { IconName } from '@/shared/ui';

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

interface SeccionConfig {
  id: string;
  titulo?: string;
  items: ItemNav[];
}

/** Navegación declarada una sola vez, en orden canónico. Quién ve cada ítem lo decide `ACCESO_RUTAS`, no esta lista. */
const NAVEGACION: SeccionConfig[] = [
  {
    id: 'principal',
    items: [
      { id: 'catalogo', label: 'Catálogo', to: RUTAS.catalogo, icon: 'catalogo' },
      { id: 'carrito', label: 'Carrito', to: RUTAS.carrito, icon: 'carrito' },
      { id: 'mis-pedidos', label: 'Mis pedidos', to: RUTAS.misPedidos, icon: 'pedidos' },
      { id: 'direcciones', label: 'Direcciones', to: RUTAS.direcciones, icon: 'direcciones' },
      { id: 'mi-cuenta', label: 'Mi cuenta', to: RUTAS.miCuenta, icon: 'cuenta' },
    ],
  },
  {
    id: 'acceso',
    items: [
      { id: 'ingresar', label: 'Ingresar', to: RUTAS.ingresar, icon: 'ingresar' },
      { id: 'registrarse', label: 'Registrarse', to: RUTAS.registrarse, icon: 'registrarse' },
    ],
  },
  {
    id: 'operacion',
    items: [
      { id: 'gestion-pedidos', label: 'Gestión de pedidos', to: RUTAS.gestionPedidos, icon: 'gestion' },
    ],
  },
  {
    id: 'administracion',
    titulo: 'Administración',
    items: [
      { id: 'categorias', label: 'Categorías', to: RUTAS.adminCategorias, icon: 'categorias' },
      { id: 'ingredientes', label: 'Ingredientes', to: RUTAS.adminIngredientes, icon: 'ingredientes' },
      { id: 'productos', label: 'Productos y stock', to: RUTAS.adminProductos, icon: 'productos' },
      { id: 'usuarios', label: 'Usuarios', to: RUTAS.adminUsuarios, icon: 'usuarios' },
      { id: 'dashboard', label: 'Dashboard', to: RUTAS.adminDashboard, icon: 'dashboard' },
    ],
  },
];

/**
 * Secciones de navegación para los roles dados (unión, sin duplicados, orden canónico).
 * Los roles desconocidos para la UI (p. ej. `COCINA`) se ignoran; sin roles conocidos es la variante «sin sesión».
 * Un grupo sin ítems visibles se omite.
 */
export function seccionesParaRoles(roles: readonly string[]): SeccionNav[] {
  const conocidos = roles.filter(esRol);
  const estado = conocidos.length > 0 ? 'autenticada' : 'anonima';
  const secciones: SeccionNav[] = [];
  for (const { id, titulo, items } of NAVEGACION) {
    const visibles = items.filter((item) => puedeAcceder(ACCESO_RUTAS[item.to], estado, conocidos));
    if (visibles.length === 0) continue;
    secciones.push(titulo === undefined ? { id, items: visibles } : { id, titulo, items: visibles });
  }
  return secciones;
}
