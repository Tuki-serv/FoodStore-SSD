import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { productoDto, productosSeed } from '@/test/msw/catalogo';
import { renderConToasts } from '@/test/render-con-toasts';
import { iniciarSesionDePrueba } from '@/test/sesion';
import { BotonAgregarAlCarrito } from '../index';

const clasica = productosSeed[0] ?? productoDto({ id: 1 });

describe('BotonAgregarAlCarrito con sesión', () => {
  it('suma 1 unidad con el precio decimal y sin personalización, y avisa «Agregado al carrito»', async () => {
    iniciarSesionDePrueba();
    const { usuario } = renderConToasts(<BotonAgregarAlCarrito producto={clasica} />);

    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));

    expect(useCartStore.getState().lineas).toEqual([
      { productoId: 1, nombre: 'Hamburguesa Clásica', precioUnitario: '1500.00', imagenUrl: null, cantidad: 1, personalizacion: [] },
    ]);
    expect(screen.getByText('Agregado al carrito')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 × Hamburguesa Clásica');
  });

  it('con cantidad 3 suma 3 unidades y lo dice en el aviso', async () => {
    iniciarSesionDePrueba();
    const { usuario } = renderConToasts(<BotonAgregarAlCarrito producto={clasica} cantidad={3} variante="detalle" />);

    await usuario.click(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));

    expect(useCartStore.getState().lineas[0]?.cantidad).toBe(3);
    expect(screen.getByRole('status')).toHaveTextContent('3 × Hamburguesa Clásica');
  });

  it('dos clics suman en una sola línea (cantidad 2)', async () => {
    iniciarSesionDePrueba();
    const { usuario } = renderConToasts(<BotonAgregarAlCarrito producto={clasica} />);
    const boton = screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' });

    await usuario.click(boton);
    await usuario.click(boton);

    expect(useCartStore.getState().lineas).toHaveLength(1);
    expect(useCartStore.getState().lineas[0]?.cantidad).toBe(2);
  });

  it('la imagen principal viaja a la línea del carrito', async () => {
    iniciarSesionDePrueba();
    const conImagen = productoDto({ id: 8, nombre: 'Flan', precio_base: '900.00', imagenes_url: ['https://img.test/flan.png'] });
    const { usuario } = renderConToasts(<BotonAgregarAlCarrito producto={conImagen} />);

    await usuario.click(screen.getByRole('button', { name: 'Agregar Flan al carrito' }));

    expect(useCartStore.getState().lineas[0]?.imagenUrl).toBe('https://img.test/flan.png');
  });

  it('sin stock: botón deshabilitado con el texto «Agotado» y el carrito no cambia', async () => {
    iniciarSesionDePrueba();
    const { usuario } = renderConToasts(<BotonAgregarAlCarrito producto={productoDto({ id: 9, nombre: 'Brownie', stock_cantidad: 0 })} />);

    const boton = screen.getByRole('button', { name: 'Agotado' });
    expect(boton).toBeDisabled();
    await usuario.click(boton);

    expect(useCartStore.getState().lineas).toEqual([]);
    expect(screen.queryByText('Agregado al carrito')).not.toBeInTheDocument();
  });

  it('el texto visible es «Agregar» en la tarjeta y «Agregar al carrito» en el detalle', () => {
    iniciarSesionDePrueba();
    const tarjeta = renderConToasts(<BotonAgregarAlCarrito producto={clasica} />);
    expect(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toHaveTextContent(/^Agregar$/);
    tarjeta.unmount();

    renderConToasts(<BotonAgregarAlCarrito producto={clasica} variante="detalle" />);
    expect(screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toHaveTextContent('Agregar al carrito');
  });
});
