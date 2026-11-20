import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pedidosUsuarios } from '@/test/msw/usuarios';
import { montarUsuarios } from '@/test/render-usuarios';
import { renderApp } from '@/test/render-app';

describe('ruta de «Usuarios»', () => {
  it('un usuario CLIENT + ADMIN en /admin/usuarios ve la pantalla real: «Usuarios» y «Nuevo usuario», no la provisoria', async () => {
    montarUsuarios('/admin/usuarios', { roles: ['CLIENT', 'ADMIN'] });

    expect(await screen.findByRole('heading', { name: 'Usuarios', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument();
    expect(document.querySelector('[data-owner]')).toBeNull();
    expect(screen.queryByText('Estamos preparando esta sección.')).not.toBeInTheDocument();
  });

  it.each([['CLIENT', 'PEDIDOS'], ['CLIENT', 'STOCK'], ['CLIENT']])('un usuario con roles %s ve «Sin permiso» y no se pide el listado', async (...roles) => {
    const { estado } = montarUsuarios('/admin/usuarios', { roles });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo usuario' })).not.toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/')).toEqual([]);
  });

  it('un visitante sin sesión va a /ingresar recordando la ruta', async () => {
    const { router } = renderApp('/admin/usuarios');

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/admin/usuarios', search: '', hash: '' } });
  });
});
