import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore, type LineaCarrito } from '@/entities/cart';
import { useUiStore } from '@/shared/model';
import { renderApp } from '@/test/render-app';
import { setViewport } from '@/test/viewport';

const linea = (productoId: number, cantidad: number): LineaCarrito => ({
  productoId,
  nombre: `Producto ${productoId}`,
  precioUnitario: '1000.00',
  imagenUrl: null,
  cantidad,
  personalizacion: [],
  personalizacionNombres: [],
});

/** Monta la app con sesión `CLIENT` y espera a que el shell (con la navegación) esté dibujado. */
async function montar(ruta = '/catalogo') {
  const vista = renderApp(ruta, { sesion: { roles: ['CLIENT'] } });
  await screen.findByRole('navigation', { name: 'Principal' });
  return vista;
}
const panel = () => within(screen.getByRole('navigation', { name: 'Principal' }));
const barraSuperior = () => within(document.querySelector<HTMLElement>('.topbar') as HTMLElement);

describe('contador del carrito en el panel', () => {
  it('con el carrito vacío, al agregar 2 unidades el enlace «Carrito, 2 productos» muestra «2»', async () => {
    await montar();
    await screen.findByRole('link', { name: 'Carrito' });
    expect(panel().getByRole('link', { name: 'Carrito' })).not.toHaveTextContent(/\d/);

    act(() => useCartStore.getState().agregar({ productoId: 1, nombre: 'Flan', precioUnitario: '900.00', imagenUrl: null }, 2));

    expect(await panel().findByRole('link', { name: 'Carrito, 2 productos' })).toHaveTextContent('2');
  });

  it('con 1 unidad el nombre accesible está en singular', async () => {
    act(() => useCartStore.setState({ lineas: [linea(1, 1)] }));
    await montar();

    expect(await panel().findByRole('link', { name: 'Carrito, 1 producto' })).toHaveTextContent('1');
  });

  it('cuenta unidades, no líneas: 2 + 1 = 3', async () => {
    act(() => useCartStore.setState({ lineas: [linea(1, 2), linea(2, 1)] }));
    await montar();

    expect(await panel().findByRole('link', { name: 'Carrito, 3 productos' })).toHaveTextContent('3');
  });

  it('con el carrito vacío el enlace «Carrito» no muestra ningún número', async () => {
    await montar();

    const enlace = await panel().findByRole('link', { name: 'Carrito' });
    expect(enlace).not.toHaveTextContent(/\d/);
  });

  it('con el panel colapsado el badge sigue visible y el nombre accesible es «Carrito, N productos»', async () => {
    act(() => useCartStore.setState({ lineas: [linea(1, 3)] }));
    act(() => useUiStore.setState({ sidebarCollapsed: true }));
    await montar();

    const enlace = await panel().findByRole('link', { name: 'Carrito, 3 productos' });
    expect(enlace).toHaveTextContent('3');
    expect(enlace.closest('.sidebar')).toHaveClass('is-collapsed');
  });

  it('con el panel colapsado y el carrito vacío el nombre accesible es «Carrito»', async () => {
    act(() => useUiStore.setState({ sidebarCollapsed: true }));
    await montar();

    expect(await panel().findByRole('link', { name: 'Carrito' })).toBeInTheDocument();
  });

  it('se actualiza al cambiar las cantidades en /carrito', async () => {
    act(() => useCartStore.setState({ lineas: [linea(1, 2)] }));
    const { usuario } = await montar('/carrito');
    await panel().findByRole('link', { name: 'Carrito, 2 productos' });

    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad de Producto 1' }));

    expect(await panel().findByRole('link', { name: 'Carrito, 3 productos' })).toHaveTextContent('3');
  });
});

describe('botón del carrito en la barra superior mobile', () => {
  it('con 3 unidades hay un enlace «Carrito, 3 productos» que lleva a /carrito', async () => {
    act(() => setViewport(390));
    act(() => useCartStore.setState({ lineas: [linea(1, 3)] }));
    const { router, usuario } = await montar();

    await usuario.click(await barraSuperior().findByRole('link', { name: 'Carrito, 3 productos' }));

    expect(router.state.location.pathname).toBe('/carrito');
  });

  it('con el carrito vacío el botón existe sin número', async () => {
    act(() => setViewport(390));
    await montar();

    const enlace = await barraSuperior().findByRole('link', { name: 'Carrito' });
    expect(enlace).not.toHaveTextContent(/\d/);
  });

  it('sin sesión no hay botón de carrito en la barra superior', async () => {
    act(() => setViewport(390));
    renderApp('/catalogo');

    await screen.findByRole('heading', { name: 'Catálogo', level: 1 });
    await screen.findByRole('navigation', { name: 'Principal' });
    expect(barraSuperior().queryByRole('link', { name: /Carrito/ })).not.toBeInTheDocument();
  });

  it('en desktop no se dibuja el botón de la barra superior', async () => {
    act(() => useCartStore.setState({ lineas: [linea(1, 3)] }));
    await montar();

    await panel().findByRole('link', { name: 'Carrito, 3 productos' });
    expect(barraSuperior().queryByRole('link', { name: /Carrito/ })).not.toBeInTheDocument();
  });
});
