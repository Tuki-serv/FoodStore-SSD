import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pedido58 } from '@/test/render-gestion';
import { agregarPedidos, crearEstadoPedidos, handlersPedidos } from '@/test/msw/pedidos';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

function conPedido58() {
  const estado = crearEstadoPedidos();
  agregarPedidos(estado, [pedido58({ usuario_id: 1 })]);
  server.use(...handlersPedidos(estado));
  return estado;
}

describe('rutas de «Mis pedidos»', () => {
  it('un CLIENT en /mis-pedidos ve la pantalla real, no la provisoria', async () => {
    conPedido58();
    renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: '#58' })).toBeInTheDocument();
    expect(document.querySelector('[data-owner]')).toBeNull();
  });

  it('un CLIENT en /mis-pedidos/58 ve el detalle del pedido', async () => {
    conPedido58();
    renderApp('/mis-pedidos/58', { sesion: { roles: ['CLIENT'] } });

    expect(await screen.findByRole('heading', { name: /Pedido #58/, level: 1 })).toBeInTheDocument();
  });

  it.each(['/mis-pedidos', '/mis-pedidos/58'])('un visitante sin sesión en %s va a /ingresar recordando la ruta', async (ruta) => {
    const { router } = renderApp(ruta);

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: ruta, search: '', hash: '' } });
  });
});
