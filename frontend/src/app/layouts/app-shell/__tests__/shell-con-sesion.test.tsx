import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { API, server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

const navegacion = () => screen.getByRole('navigation', { name: 'Principal' });
const enlaces = () => within(navegacion()).getAllByRole('link').map((enlace) => enlace.textContent);

function contarLogouts(demora = 0): { llamadas: number } {
  const cuenta = { llamadas: 0 };
  server.use(
    http.post(`${API}/auth/logout`, async () => {
      cuenta.llamadas += 1;
      if (demora > 0) await delay(demora);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return cuenta;
}

describe('shell alimentado por la sesión', () => {
  it('Ana Gómez con CLIENT y ADMIN: grupo Administración con 5 enlaces y pie con nombre, rol principal y «Cerrar sesión»', async () => {
    renderApp('/catalogo', { sesion: { roles: ['CLIENT', 'ADMIN'], nombre: 'Ana', apellido: 'Gómez' } });

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    const grupo = within(navegacion()).getByText('Administración').closest('div, section, ul, li');
    expect(grupo).not.toBeNull();
    expect(enlaces()).toEqual([
      'Catálogo',
      'Carrito',
      'Mis pedidos',
      'Direcciones',
      'Mi cuenta',
      'Gestión de pedidos',
      'Categorías',
      'Ingredientes',
      'Productos y stock',
      'Usuarios',
      'Dashboard',
    ]);
  });

  it('visitante anónimo: Catálogo, Ingresar y Registrarse, sin pie de usuario', async () => {
    renderApp('/catalogo');

    await screen.findByRole('heading', { name: 'Catálogo', level: 1 });
    expect(enlaces()).toEqual(['Catálogo', 'Ingresar', 'Registrarse']);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('PEDIDOS con CLIENT: el rol principal del pie es PEDIDOS', async () => {
    renderApp('/catalogo', { sesion: { roles: ['CLIENT', 'PEDIDOS'], nombre: 'Luis', apellido: 'Paz' } });

    expect(await screen.findByText('Luis Paz')).toBeInTheDocument();
    expect(screen.getByText('PEDIDOS')).toBeInTheDocument();
    expect(screen.queryByText('CLIENT')).not.toBeInTheDocument();
  });

  it('solo CLIENT: el rol principal es CLIENT', async () => {
    renderApp('/catalogo', { sesion: { roles: ['CLIENT'] } });

    await screen.findByText('Ana Gómez');
    expect(screen.getByText('CLIENT')).toBeInTheDocument();
  });

  it('el orden de prioridad es ADMIN, PEDIDOS, STOCK, CLIENT sin importar el orden recibido', async () => {
    renderApp('/catalogo', { sesion: { roles: ['STOCK', 'PEDIDOS'] } });

    await screen.findByText('Ana Gómez');
    expect(screen.getByText('PEDIDOS')).toBeInTheDocument();
  });
});

describe('cerrar sesión desde el panel', () => {
  it('hace un POST /auth/logout, lleva a /catalogo y el pie desaparece', async () => {
    const logouts = contarLogouts();
    const { router, usuario } = renderApp('/catalogo', { sesion: { roles: ['CLIENT'] } });

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument());
    expect(logouts.llamadas).toBe(1);
    expect(router.state.location.pathname).toBe('/catalogo');
    expect(enlaces()).toEqual(['Catálogo', 'Ingresar', 'Registrarse']);
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('un doble clic dispara un solo logout', async () => {
    const logouts = contarLogouts(60);
    const { usuario } = renderApp('/catalogo', { sesion: { roles: ['CLIENT'] } });

    await usuario.dblClick(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument());
    expect(logouts.llamadas).toBe(1);
  });

  it('desde /admin/dashboard lleva a /catalogo y no a /ingresar', async () => {
    contarLogouts();
    const { router, usuario } = renderApp('/admin/dashboard', { sesion: { roles: ['ADMIN'] } });

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
    expect(router.state.location.state).toBeNull();
  });

  it('desde una ruta pública distinta del catálogo (404) también lleva a /catalogo', async () => {
    contarLogouts();
    const { router, usuario } = renderApp('/no-existe', { sesion: { roles: ['CLIENT'] } });

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('con el backend caído cierra la sesión local igual', async () => {
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    const { router, usuario } = renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } });

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/catalogo');
  });

  it('tras cerrar sesión, una ruta protegida visitada después lleva a /ingresar (el motivo no queda pegado)', async () => {
    contarLogouts();
    const { router, usuario } = renderApp('/catalogo', { sesion: { roles: ['CLIENT'] } });
    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('link', { name: 'Ingresar' });

    await act(() => router.navigate('/mis-pedidos'));

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
  });
});

describe('revalidación de la sesión desde el shell', () => {
  const SIN_AUTORIZACION = { detail: 'Credenciales inválidas', code: 'HTTP_401', field: null };

  beforeEach(() => {
    // Solo `Date`: MSW, TanStack Query y `findBy` siguen con timers reales.
    vi.useFakeTimers({ toFake: ['Date'] });
    server.use(http.get(`${API}/pedidos/`, () => HttpResponse.json({ items: [], total: 0, page: 1, size: 10, pages: 0 })));
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    vi.useRealTimers();
  });

  /** La sesión se cerró en otro dispositivo: `GET /auth/me` y la renovación responden 401. */
  function cerrarSesionEnOtroDispositivo() {
    server.use(
      http.get(`${API}/auth/me`, () => HttpResponse.json(SIN_AUTORIZACION, { status: 401 })),
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(SIN_AUTORIZACION, { status: 401 })),
    );
  }

  it('CLIENT en /carrito que navega a /mis-pedidos pasados 15 s con la sesión cerrada en otro dispositivo va a /ingresar recordando /mis-pedidos', async () => {
    const { router } = renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByText('Ana Gómez');
    cerrarSesionEnOtroDispositivo();
    vi.advanceTimersByTime(16_000);

    await act(() => router.navigate('/mis-pedidos'));

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/mis-pedidos', search: '', hash: '' } });
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('CLIENT que vuelve a la pestaña en /carrito pasados 15 s con la sesión cerrada en otro dispositivo va a /ingresar recordando /carrito', async () => {
    const { router } = renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByText('Ana Gómez');
    cerrarSesionEnOtroDispositivo();
    vi.advanceTimersByTime(16_000);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.state).toEqual({ desde: { pathname: '/carrito', search: '', hash: '' } });
  });

  it('con la sesión vigente navegar pasados 15 s no cambia de ruta ni cierra la sesión', async () => {
    const { router } = renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByText('Ana Gómez');
    vi.advanceTimersByTime(16_000);

    await act(() => router.navigate('/mis-pedidos'));

    expect(await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeInTheDocument();
    expect(selectEstado(useAuthStore.getState())).toBe('autenticada');
  });
});
