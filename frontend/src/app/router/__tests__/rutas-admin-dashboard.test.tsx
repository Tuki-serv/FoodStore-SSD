import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import { MAPA_RUTAS } from '@/app/router/route-map';
import { routes } from '@/app/router/routes';
import { PlaceholderPage } from '@/pages/placeholder';
import { montarDashboard } from '@/test/render-dashboard';
import { renderApp } from '@/test/render-app';

describe('ruta del «Dashboard»', () => {
  it('un usuario CLIENT + ADMIN en /admin/dashboard ve la pantalla real: «Dashboard» y las tarjetas, no la provisoria', async () => {
    montarDashboard('/admin/dashboard', { roles: ['CLIENT', 'ADMIN'] });

    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Indicadores del período' })).toBeInTheDocument();
    expect(document.querySelector('[data-owner]')).toBeNull();
    expect(screen.queryByText('Estamos preparando esta sección.')).not.toBeInTheDocument();
  });

  it('un usuario CLIENT + PEDIDOS ve «Sin permiso» y no se pide ninguna estadística', async () => {
    const { estado } = montarDashboard('/admin/dashboard', { roles: ['CLIENT', 'PEDIDOS'] });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Indicadores del período' })).not.toBeInTheDocument();
    expect(estado.pedidos).toEqual([]);
  });

  it('un visitante sin sesión va a /ingresar recordando la ruta', async () => {
    const { router } = renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/admin/dashboard', search: '', hash: '' } });
  });

  it('ninguna ruta del mapa se arma con la página provisoria', () => {
    const rutasDelShell = routes[0]?.children?.[0]?.children ?? [];

    for (const { path } of MAPA_RUTAS) {
      const ruta = rutasDelShell.find((candidata) => candidata.path === path);
      expect(ruta, path).toBeDefined();
      const pantalla = (ruta?.element as ReactElement<{ children: ReactElement }>).props.children;
      expect(pantalla.type, path).not.toBe(PlaceholderPage);
    }
  });
});
