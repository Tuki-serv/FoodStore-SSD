import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { abrirSesion } from '@/entities/session';
import { apiClient } from '@/shared/api';
import { handlerMe } from '@/test/msw/auth';
import { crearEstadoCatalogo, handlersCatalogo, productoDto } from '@/test/msw/catalogo';
import { API, server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import { montarUsuarios } from '@/test/render-usuarios';

type Router = ReturnType<typeof renderApp>['router'];

const ubicacion = (router: Router) => `${router.state.location.pathname}${router.state.location.search}`;
const titulo = (nombre: string) => screen.findByRole('heading', { name: nombre, level: 1 });

describe('anónimo en rutas protegidas', () => {
  it('Mis pedidos con query: va a /ingresar y recuerda la ruta pedida', async () => {
    const { router } = renderApp('/mis-pedidos?page=2');

    expect(await titulo('Ingresar')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/mis-pedidos', search: '?page=2', hash: '' } });
  });

  it('administración: va a /ingresar', async () => {
    const { router } = renderApp('/admin/usuarios');

    expect(await titulo('Ingresar')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/ingresar');
  });

  it('reemplaza la entrada del historial en lugar de sumar otra', async () => {
    const { router } = renderApp('/direcciones');
    await titulo('Ingresar');

    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('el catálogo es público', async () => {
    const { router } = renderApp('/catalogo');

    expect(await titulo('Catálogo')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo');
  });
});

describe('usuario con sesión y rol insuficiente', () => {
  it('CLIENT en /admin/usuarios: ve «Sin permiso» dentro del shell, con la URL intacta y el enlace al catálogo', async () => {
    const { router } = renderApp('/admin/usuarios', { sesion: { roles: ['CLIENT'] } });

    expect(await titulo('No tenés acceso a esta sección')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/admin/usuarios');
    const principal = screen.getByRole('main');
    expect(within(principal).getByRole('link', { name: 'Ir al catálogo' })).toHaveAttribute('href', '/catalogo');
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('el texto de «Sin permiso» no es técnico', async () => {
    renderApp('/admin/dashboard', { sesion: { roles: ['CLIENT'] } });

    await titulo('No tenés acceso a esta sección');

    expect(screen.getByText(/Tu cuenta no tiene permiso para ver esta página/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText(/403|ADMIN/)).not.toBeInTheDocument();
  });

  it('STOCK en /admin/productos: ve «Productos y stock»', async () => {
    renderApp('/admin/productos', { sesion: { roles: ['STOCK'] } });

    expect(await titulo('Productos y stock')).toBeInTheDocument();
  });

  it('STOCK en /admin/categorias: ve «Sin permiso»', async () => {
    renderApp('/admin/categorias', { sesion: { roles: ['STOCK'] } });

    expect(await titulo('No tenés acceso a esta sección')).toBeInTheDocument();
  });

  it('PEDIDOS entra a /gestion-pedidos', async () => {
    renderApp('/gestion-pedidos', { sesion: { roles: ['PEDIDOS'] } });

    expect(await titulo('Gestión de pedidos')).toBeInTheDocument();
  });

  it('ADMIN en /admin/usuarios ve «Usuarios»', async () => {
    montarUsuarios('/admin/usuarios', { roles: ['CLIENT', 'ADMIN'] });

    expect(await titulo('Usuarios')).toBeInTheDocument();
  });
});

describe('rutas solo para visitantes sin sesión', () => {
  it('CLIENT en /ingresar sin ruta recordada: va a /catalogo', async () => {
    const { router } = renderApp('/ingresar', { sesion: { roles: ['CLIENT'] } });

    expect(await titulo('Catálogo')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo');
  });

  it('CLIENT en /registrarse: va a /catalogo', async () => {
    const { router } = renderApp('/registrarse', { sesion: { roles: ['CLIENT'] } });

    expect(await titulo('Catálogo')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo');
  });

  it('anónimo llevado a /ingresar desde /direcciones y luego autenticado como CLIENT: vuelve a /direcciones', async () => {
    const { router } = renderApp('/direcciones');
    await titulo('Ingresar');
    server.use(handlerMe(['CLIENT']));

    await act(() => abrirSesion('A9'));

    expect(await titulo('Direcciones')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/direcciones');
  });

  it('vuelve también con query y hash de la ruta recordada', async () => {
    const { router } = renderApp('/mis-pedidos?page=2#fin');
    await titulo('Ingresar');
    server.use(handlerMe(['CLIENT']));

    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/mis-pedidos'));
    expect(router.state.location.search).toBe('?page=2');
    expect(router.state.location.hash).toBe('#fin');
  });

  it.each([['//evil.example'], ['https://evil.example/x'], ['/no-existe'], ['mis-pedidos'], ['/\\evil'], ['/%2f%2fevil'], ['/__proto__']])(
    'una ruta recordada inválida (%s) se ignora y va a /catalogo',
    async (pathname) => {
      const { router } = renderApp('/catalogo');
      await titulo('Catálogo');
      server.use(handlerMe(['CLIENT']));

      await act(() => router.navigate('/ingresar', { state: { desde: { pathname, search: '', hash: '' } } }));
      await titulo('Ingresar');
      await act(() => abrirSesion('A9'));

      expect(await titulo('Catálogo')).toBeInTheDocument();
      expect(ubicacion(router)).toBe('/catalogo');
    },
  );

  it('vuelve al detalle de un producto recordado (/catalogo/7)', async () => {
    const { router } = renderApp('/catalogo');
    await titulo('Catálogo');
    server.use(handlerMe(['CLIENT']));

    await act(() => router.navigate('/ingresar', { state: { desde: { pathname: '/catalogo/7', search: '', hash: '' } } }));
    await titulo('Ingresar');
    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo/7'));
  });

  it('vuelve al catálogo con sus filtros y página (/catalogo?categoria=2&page=2)', async () => {
    // Con el catálogo base la categoría 2 entra en una sola página: el catálogo corregiría `page=2` (fuera de rango) a la 1
    // y la URL esperada duraría un instante (test intermitente bajo carga). 15 bebidas = 2 páginas reales.
    const bebidas = Array.from({ length: 15 }, (_, i) =>
      productoDto({ id: i + 1, nombre: `Bebida ${i + 1}`, categorias: [{ id: 2, nombre: 'Bebidas', es_principal: true }] }),
    );
    server.use(...handlersCatalogo(crearEstadoCatalogo(bebidas)));
    const { router } = renderApp('/catalogo?categoria=2&page=2');
    await titulo('Catálogo');
    await act(() => router.navigate('/ingresar', { state: { desde: { pathname: '/catalogo', search: '?categoria=2&page=2', hash: '' } } }));
    await titulo('Ingresar');
    server.use(handlerMe(['CLIENT']));

    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2'));
    // La página 2 existe: se muestra y la URL no se corrige.
    expect(await screen.findByRole('link', { name: 'Bebida 13' })).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2');
  });

  it('conserva query y hash del detalle recordado (/catalogo/7?x=1#a)', async () => {
    const { router } = renderApp('/catalogo');
    await titulo('Catálogo');
    server.use(handlerMe(['CLIENT']));

    await act(() => router.navigate('/ingresar', { state: { desde: { pathname: '/catalogo/7', search: '?x=1', hash: '#a' } } }));
    await titulo('Ingresar');
    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo/7'));
    expect(router.state.location.search).toBe('?x=1');
    expect(router.state.location.hash).toBe('#a');
  });

  it.each([['/catalogo/abc'], ['/catalogo/0'], ['/catalogo/-3'], ['/catalogo/07'], ['/catalogo/7/extra'], ['/catalogo/1e3']])(
    'un detalle recordado inválido (%s) vuelve a /catalogo',
    async (pathname) => {
      const { router } = renderApp('/catalogo');
      await titulo('Catálogo');
      server.use(handlerMe(['CLIENT']));

      await act(() => router.navigate('/ingresar', { state: { desde: { pathname, search: '', hash: '' } } }));
      await titulo('Ingresar');
      await act(() => abrirSesion('A9'));

      await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
    },
  );

  it('una ruta recordada a la que el usuario no accede (administración como CLIENT) se ignora', async () => {
    const { router } = renderApp('/admin/usuarios');
    await titulo('Ingresar');
    server.use(handlerMe(['CLIENT']));

    await act(() => abrirSesion('A9'));

    expect(await titulo('Catálogo')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo');
  });
});

describe('espera de la sesión', () => {
  it('recarga en /mis-pedidos con rehidratación demorada: pantalla de carga con la URL intacta y luego «Mis pedidos»', async () => {
    const { router } = renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] }, demoraRehidratacion: 60 });

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(ubicacion(router)).toBe('/mis-pedidos');

    expect(await titulo('Mis pedidos')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/mis-pedidos');
    expect(router.state.location.state).toBeNull();
  });
});

describe('sesión perdida en una ruta protegida', () => {
  it('CLIENT en /mis-pedidos y un 401 sin renovación posible: va a /ingresar recordando /mis-pedidos', async () => {
    const { router } = renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } });
    await titulo('Mis pedidos');
    // La cookie del refresh ya no es válida y un pedido responde 401.
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ detail: 'Sesión inválida', code: 'HTTP_401', field: null }, { status: 401 })),
      http.get(`${API}/pedidos`, () => HttpResponse.json({ detail: 'Token vencido', code: 'HTTP_401', field: null }, { status: 401 })),
    );

    await act(async () => {
      await apiClient.get('/pedidos').catch(() => undefined);
    });

    expect(await titulo('Ingresar')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/mis-pedidos', search: '', hash: '' } });
  });
});

describe('rutas públicas y no encontrada', () => {
  it('ADMIN en /no-existe: ve «Página no encontrada» con la navegación de ADMIN', async () => {
    renderApp('/no-existe', { sesion: { roles: ['ADMIN'] } });

    expect(await titulo('Página no encontrada')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('anónimo en /no-existe: ve «Página no encontrada» sin redirigir', async () => {
    const { router } = renderApp('/no-existe');

    expect(await titulo('Página no encontrada')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/no-existe');
  });
});
