import { describe, expect, it } from 'vitest';
import { seccionesParaRoles } from '@/app/layouts/app-shell/model/navigation';
import { MAPA_RUTAS } from '../route-map';

describe('MAPA_RUTAS', () => {
  it('contiene un path por cada sección de navegación de todos los roles', () => {
    const combinaciones = [[], ['CLIENT'], ['PEDIDOS'], ['STOCK'], ['ADMIN']];
    const pathsDeLaNavegacion = combinaciones.flatMap((roles) =>
      seccionesParaRoles(roles).flatMap((seccion) => seccion.items.map((item) => item.to)),
    );
    const pathsDelMapa = MAPA_RUTAS.map((ruta) => ruta.path);

    expect(pathsDeLaNavegacion.length).toBeGreaterThan(0);
    for (const path of pathsDeLaNavegacion) {
      expect(pathsDelMapa).toContain(path);
    }
  });

  it('declara el dueño y el título de cada ruta', () => {
    expect(MAPA_RUTAS).toEqual([
      { path: '/catalogo', title: 'Catálogo', owner: 'C-16b' },
      { path: '/ingresar', title: 'Ingresar', owner: 'C-14' },
      { path: '/registrarse', title: 'Registrarse', owner: 'C-14' },
      { path: '/carrito', title: 'Carrito', owner: 'C-18' },
      { path: '/mis-pedidos', title: 'Mis pedidos', owner: 'C-21' },
      { path: '/direcciones', title: 'Direcciones', owner: 'C-15' },
      { path: '/mi-cuenta', title: 'Mi cuenta', owner: 'C-14' },
      { path: '/gestion-pedidos', title: 'Gestión de pedidos', owner: 'C-22' },
      { path: '/admin/categorias', title: 'Categorías', owner: 'C-17a' },
      { path: '/admin/ingredientes', title: 'Ingredientes', owner: 'C-17a' },
      { path: '/admin/productos', title: 'Productos y stock', owner: 'C-17b' },
      { path: '/admin/usuarios', title: 'Usuarios', owner: 'C-23' },
      { path: '/admin/dashboard', title: 'Dashboard', owner: 'C-24' },
    ]);
  });
});

describe('consistencia entre navegación y mapa de rutas', () => {
  it('cada ítem de navegación tiene como etiqueta el título de su ruta', () => {
    const items = seccionesParaRoles(['ADMIN']).flatMap((seccion) => seccion.items);

    expect(items).toHaveLength(11);
    for (const item of items) {
      expect(MAPA_RUTAS.find((ruta) => ruta.path === item.to)?.title).toBe(item.label);
    }
  });
});
