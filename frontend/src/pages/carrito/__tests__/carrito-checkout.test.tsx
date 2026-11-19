import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore, type LineaCarrito } from '@/entities/cart';
import { renderApp } from '@/test/render-app';

const hamburguesa: LineaCarrito = {
  productoId: 1,
  nombre: 'Hamburguesa Clásica',
  precioUnitario: '1500.00',
  imagenUrl: null,
  cantidad: 2,
  personalizacion: [],
  personalizacionNombres: [],
};

const precargar = (...lineas: LineaCarrito[]): void => {
  act(() => useCartStore.setState({ lineas }));
};
const resumen = () => screen.getByRole('region', { name: 'Resumen' });

describe('carrito: salida al checkout', () => {
  it('un CLIENT con productos ve «Finalizar compra» y al pulsarlo la URL pasa a /finalizar-compra', async () => {
    precargar(hamburguesa);
    const { router, usuario } = renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByRole('heading', { name: 'Carrito', level: 1 });

    await usuario.click(within(resumen()).getByRole('link', { name: 'Finalizar compra' }));

    expect(router.state.location.pathname).toBe('/finalizar-compra');
  });

  it('un usuario con CLIENT entre varios roles también ve «Finalizar compra»', async () => {
    precargar(hamburguesa);
    renderApp('/carrito', { sesion: { roles: ['CLIENT', 'STOCK'] } });
    await screen.findByRole('heading', { name: 'Carrito', level: 1 });

    expect(within(resumen()).getByRole('link', { name: 'Finalizar compra' })).toHaveAttribute('href', '/finalizar-compra');
  });

  it('un usuario solo ADMIN no ve «Finalizar compra» y ve que solo las cuentas de cliente pueden hacer pedidos', async () => {
    precargar(hamburguesa);
    renderApp('/carrito', { sesion: { roles: ['ADMIN'] } });
    await screen.findByRole('heading', { name: 'Carrito', level: 1 });

    expect(screen.queryByRole('link', { name: 'Finalizar compra' })).not.toBeInTheDocument();
    expect(within(resumen()).getByText('Solo las cuentas de cliente pueden hacer pedidos.')).toBeInTheDocument();
  });

  it('la nota del resumen menciona el costo de envío de $ 50 y los precios finales', async () => {
    precargar(hamburguesa);
    renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByRole('heading', { name: 'Carrito', level: 1 });

    expect(within(resumen()).getByText('Se suma un costo de envío de $ 50. Los precios finales se confirman al crear el pedido.')).toBeInTheDocument();
  });

  it('con el carrito vacío no hay resumen ni «Finalizar compra»', async () => {
    renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
    await screen.findByRole('heading', { name: 'Tu carrito está vacío' });

    expect(screen.queryByRole('link', { name: 'Finalizar compra' })).not.toBeInTheDocument();
  });
});
