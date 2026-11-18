import { screen } from '@testing-library/react';
import {
  arbolSeed,
  crearEstadoCatalogo,
  handlersCatalogo,
  productosSeed,
  type CategoriaNodoDto,
  type ProductoDto,
} from './msw/catalogo';
import { server } from './msw/server';
import { renderApp, type OpcionesApp } from './render-app';

export interface OpcionesCatalogo extends OpcionesApp {
  productos?: ProductoDto[];
  arbol?: CategoriaNodoDto[];
}

/** Renderiza la app en `ruta` con la red del catálogo simulada (estado en memoria que replica al backend). Anónimo salvo que se pase `sesion`. */
export function montarCatalogo(ruta = '/catalogo', { productos = productosSeed, arbol = arbolSeed, ...opcionesApp }: OpcionesCatalogo = {}) {
  const estado = crearEstadoCatalogo(productos, arbol);
  server.use(...handlersCatalogo(estado));
  const app = renderApp(ruta, opcionesApp);
  return { estado, ...app };
}

/** Espera a que la página «Catálogo» esté montada (título del shell). */
export const esperarCatalogo = () => screen.findByRole('heading', { name: 'Catálogo', level: 1 });

/** Tarjetas de producto visibles, en orden. */
export const tarjetas = (): HTMLElement[] => screen.queryAllByRole('article');

/** Nombres de las tarjetas visibles. */
export const nombresVisibles = (): string[] => tarjetas().map((tarjeta) => tarjeta.querySelector('h3')?.textContent ?? '');
