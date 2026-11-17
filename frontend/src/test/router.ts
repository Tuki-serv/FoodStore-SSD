import { createMemoryRouter, type RouteObject } from 'react-router-dom';
import { FUTURO_ROUTER } from '@/app/router/future';

/** Router en memoria para los tests, sobre el mismo árbol de rutas y con los mismos future flags que la app. */
export function crearRouterDePrueba(rutas: RouteObject[], entradas: string[]) {
  return createMemoryRouter(rutas, { initialEntries: entradas, future: FUTURO_ROUTER });
}
