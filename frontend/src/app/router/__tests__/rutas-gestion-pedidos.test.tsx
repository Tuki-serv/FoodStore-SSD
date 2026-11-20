import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { agregarPedidos, crearEstadoPedidos, handlersPedidos, pedidoDto } from '@/test/msw/pedidos';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

function conPedidos() {
  const estado = crearEstadoPedidos();
  agregarPedidos(estado, [pedidoDto({ id: 57 }), pedidoDto({ id: 58 })]);
  server.use(...handlersPedidos(estado));
  return estado;
}

describe('rutas de la gestión de pedidos', () => {
  it.each(['PEDIDOS', 'ADMIN'])('un usuario %s en /gestion-pedidos ve la pantalla real, no la provisoria', async (rol) => {
    conPedidos();
    renderApp('/gestion-pedidos', { sesion: { roles: [rol] } });

    expect(await screen.findByRole('heading', { name: 'Gestión de pedidos', level: 1 })).toBeInTheDocument();
    expect(document.querySelector('[data-owner]')).toBeNull();
  });

  it('un usuario PEDIDOS en /gestion-pedidos/58 ve el detalle del pedido', async () => {
    conPedidos();
    renderApp('/gestion-pedidos/58', { sesion: { roles: ['PEDIDOS'] } });

    expect(await screen.findByRole('heading', { name: /Pedido #58/, level: 1 })).toBeInTheDocument();
  });

  it('un CLIENT en /gestion-pedidos/57 ve «Sin permiso» y no se pide el pedido', async () => {
    const estado = conPedidos();
    renderApp('/gestion-pedidos/57', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(estado.consultas).toEqual([]);
    expect(estado.consultasHistorial).toEqual([]);
  });

  it('un CLIENT en /gestion-pedidos ve «Sin permiso»', async () => {
    const estado = conPedidos();
    renderApp('/gestion-pedidos', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(estado.consultasLista).toEqual([]);
  });

  it.each(['/gestion-pedidos', '/gestion-pedidos/57'])('un visitante sin sesión en %s va a /ingresar recordando la ruta', async (ruta) => {
    const { router } = renderApp(ruta);

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: ruta, search: '', hash: '' } });
  });
});
