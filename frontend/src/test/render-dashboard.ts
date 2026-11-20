import { vi } from 'vitest';
import { crearEstadoEstadisticas, handlersEstadisticas, type EstadoEstadisticas } from './msw/estadisticas';
import { crearEstadoPedidos, handlersPedidos } from './msw/pedidos';
import { server } from './msw/server';
import { renderApp } from './render-app';

/** «Hoy» de los tests del dashboard (UTC): el de las specs. */
export const HOY_DASHBOARD = '2026-11-20';

/** jsdom no tiene `ResizeObserver`, que recharts usa para medir el contenedor; este doble no observa nada (los tests leen las tablas, no el SVG). */
class ResizeObserverInerte {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

export interface OpcionesDashboard {
  roles?: string[];
  estado?: EstadoEstadisticas;
  /** Fecha UTC (`YYYY-MM-DD`) que ve la página como «hoy». */
  hoy?: string;
}

/**
 * Renderiza la app en una ruta del dashboard como un usuario con los roles dados, con la red de estadísticas simulada
 * (y la de pedidos, a la que se navega desde «Pedidos activos» y los estados). Solo `Date` se congela; los timers siguen reales.
 */
export function montarDashboard(ruta = '/admin/dashboard', { roles = ['ADMIN', 'CLIENT'], estado = crearEstadoEstadisticas(), hoy = HOY_DASHBOARD }: OpcionesDashboard = {}) {
  vi.stubGlobal('ResizeObserver', ResizeObserverInerte);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${hoy}T12:00:00Z`));
  server.use(...handlersEstadisticas(estado), ...handlersPedidos(crearEstadoPedidos()));
  const app = renderApp(ruta, { sesion: { roles } });
  return { estado, ...app };
}
