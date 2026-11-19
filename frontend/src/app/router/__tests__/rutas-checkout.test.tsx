import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rutaPagoPedido, rutaPedidoCreado, RUTA_FINALIZAR_COMPRA, RUTA_PAGO_PEDIDO, RUTA_PEDIDO_CREADO } from '@/shared/config';
import { renderApp } from '@/test/render-app';

describe('rutas del checkout', () => {
  it('un visitante sin sesión en /finalizar-compra va a /ingresar recordando la ruta', async () => {
    const { router } = renderApp('/finalizar-compra');

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/finalizar-compra', search: '', hash: '' } });
  });

  it('un usuario solo ADMIN en /finalizar-compra ve «Sin permiso» con la URL intacta', async () => {
    const { router } = renderApp('/finalizar-compra', { sesion: { roles: ['ADMIN'] } });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/finalizar-compra');
  });

  it('un usuario solo ADMIN en la confirmación de un pedido ve «Sin permiso»', async () => {
    renderApp('/finalizar-compra/pedido/57', { sesion: { roles: ['ADMIN'] } });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
  });

  it('un CLIENT en /finalizar-compra/pedido/58/pago ve la página provisoria «Pago» con dueño C-20', async () => {
    renderApp('/finalizar-compra/pedido/58/pago', { sesion: { roles: ['CLIENT'] } });

    const pagina = (await screen.findByRole('heading', { name: 'Pago', level: 1 })).closest('[data-owner]');
    expect(pagina).toHaveAttribute('data-owner', 'C-20');
  });

  it('un visitante sin sesión en la ruta de pago va a /ingresar', async () => {
    const { router } = renderApp('/finalizar-compra/pedido/58/pago');

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
  });
});

describe('paths del checkout', () => {
  it('declara los patrones del router', () => {
    expect(RUTA_FINALIZAR_COMPRA).toBe('/finalizar-compra');
    expect(RUTA_PEDIDO_CREADO).toBe('/finalizar-compra/pedido/:pedidoId');
    expect(RUTA_PAGO_PEDIDO).toBe('/finalizar-compra/pedido/:pedidoId/pago');
  });

  it.each([
    [57, '/finalizar-compra/pedido/57', '/finalizar-compra/pedido/57/pago'],
    [120, '/finalizar-compra/pedido/120', '/finalizar-compra/pedido/120/pago'],
  ])('arma los paths del pedido %i', (id, creado, pago) => {
    expect(rutaPedidoCreado(id)).toBe(creado);
    expect(rutaPagoPedido(id)).toBe(pago);
  });
});
