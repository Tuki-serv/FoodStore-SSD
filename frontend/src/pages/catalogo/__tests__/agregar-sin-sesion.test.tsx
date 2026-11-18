import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { abrirSesion } from '@/entities/session';
import { handlerMe } from '@/test/msw/auth';
import { productoDto } from '@/test/msw/catalogo';
import { server } from '@/test/msw/server';
import { montarCatalogo, nombresVisibles } from '@/test/render-catalogo';

const BEBIDAS = { id: 2, nombre: 'Bebidas', es_principal: true };
// 14 productos en «Bebidas»: la hamburguesa (id 13) queda en la página 2 de 12.
const productos = Array.from({ length: 14 }, (_, i) =>
  productoDto({ id: i + 1, nombre: i === 12 ? 'Hamburguesa Clásica' : `Bebida ${String(i + 1).padStart(2, '0')}`, precio_base: '1500.00', categorias: [BEBIDAS] }),
);

const ubicacion = (router: { state: { location: { pathname: string; search: string } } }) => `${router.state.location.pathname}${router.state.location.search}`;

describe('BotonAgregarAlCarrito sin sesión (el visitante pasa por «Ingresar» y vuelve al mismo lugar)', () => {
  it('«Agregar» lleva a /ingresar recordando el catálogo con sus filtros y página, sin tocar el carrito', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&page=2', { productos });
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/catalogo', search: '?categoria=2&page=2', hash: '' } });
    expect(useCartStore.getState().lineas).toEqual([]);
    expect(screen.queryByText('Agregado al carrito')).not.toBeInTheDocument();
  });

  it('al iniciar sesión como CLIENT vuelve a /catalogo?categoria=2&page=2, con los mismos filtros y página, y el carrito sigue vacío', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&page=2', { productos });
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));
    await screen.findByRole('heading', { name: 'Ingresar', level: 1 });
    server.use(handlerMe(['CLIENT']));

    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2'));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(nombresVisibles()).toEqual(['Hamburguesa Clásica', 'Bebida 14']);
    expect(useCartStore.getState().lineas).toEqual([]);
  });

  it('«Atrás» desde /ingresar vuelve al catálogo (se navegó con push)', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&page=2', { productos });
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));
    await screen.findByRole('heading', { name: 'Ingresar', level: 1 });

    await act(() => router.navigate(-1));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2'));
  });

  it('con sesión CLIENT el botón sigue agregando al carrito sin salir del catálogo', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&page=2', { productos, sesion: { roles: ['CLIENT'] } });
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));

    expect(await screen.findByText('Agregado al carrito')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2');
    expect(useCartStore.getState().lineas.map((l) => [l.productoId, l.cantidad])).toEqual([[13, 1]]);
  });
});
