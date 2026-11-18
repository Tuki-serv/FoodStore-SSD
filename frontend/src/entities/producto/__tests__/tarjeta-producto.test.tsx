import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { productoDto, productosSeed } from '@/test/msw/catalogo';
import type { Producto } from '../index';
import { TarjetaProducto } from '../index';

const clasica = productosSeed[0] as Producto;

function Destino() {
  const { pathname, state } = useLocation();
  return <p data-testid="destino">{`${pathname}|${JSON.stringify(state)}`}</p>;
}

const montar = (producto: Producto, props: { accion?: React.ReactNode } = {}, ruta = '/catalogo') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ul>
        <li>
          <TarjetaProducto producto={producto} {...props} />
        </li>
      </ul>
      <Destino />
    </MemoryRouter>,
  );

describe('TarjetaProducto', () => {
  it('muestra el nombre como enlace al detalle, la categoría principal y el precio', () => {
    montar(clasica);

    expect(screen.getByRole('link', { name: 'Hamburguesa Clásica' })).toHaveAttribute('href', '/catalogo/1');
    expect(screen.getByText('Hamburguesas')).toBeInTheDocument();
    expect(screen.getByText('$ 1.500')).toBeInTheDocument();
  });

  it('el precio con centavos se muestra con coma', () => {
    montar(productoDto({ id: 9, nombre: 'Volcán', precio_base: '1250.50' }));

    expect(screen.getByText('$ 1.250,50')).toBeInTheDocument();
  });

  it('un producto sin categorías no muestra categoría', () => {
    const { container } = montar(productoDto({ id: 9, nombre: 'Volcán' }));

    expect(container.querySelector('.cat')).toBeNull();
  });

  it('stock 0: marca «Agotado» y la tarjeta queda atenuada', () => {
    montar(productoDto({ id: 3, nombre: 'Brownie', stock_cantidad: 0 }));

    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveClass('unavailable');
  });

  it('stock 2: «Quedan 2» y la tarjeta no queda atenuada', () => {
    montar(productoDto({ id: 3, nombre: 'Flan', stock_cantidad: 2 }));

    expect(screen.getByText('Quedan 2')).toBeInTheDocument();
    expect(screen.getByRole('article')).not.toHaveClass('unavailable');
  });

  it('stock 30: sin aviso de stock', () => {
    montar(productoDto({ id: 3, nombre: 'Flan', stock_cantidad: 30 }));

    expect(screen.queryByText(/Quedan|Agotado/)).not.toBeInTheDocument();
  });

  it('con imagen la muestra con el nombre como texto alternativo', () => {
    montar(productoDto({ id: 3, nombre: 'Flan', imagenes_url: ['https://img.test/flan.png'] }));

    expect(screen.getByRole('img', { name: 'Flan' })).toHaveAttribute('src', 'https://img.test/flan.png');
  });

  it('con imagenes_url null muestra el marcador «Sin imagen de …» y ninguna imagen', () => {
    const { container } = montar(productoDto({ id: 3, nombre: 'Flan', imagenes_url: null }));

    expect(screen.getByRole('img', { name: 'Sin imagen de Flan' })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('una imagen que falla se reemplaza por el marcador', () => {
    const { container } = montar(productoDto({ id: 3, nombre: 'Flan', imagenes_url: ['https://img.test/rota.png'] }));

    fireEvent.error(screen.getByRole('img', { name: 'Flan' }));

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Sin imagen de Flan' })).toBeInTheDocument();
  });

  it('dibuja el slot de acción dentro de la tarjeta', () => {
    montar(clasica, { accion: <button type="button">Agregar Hamburguesa Clásica al carrito</button> });

    expect(within(screen.getByRole('article')).getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toBeInTheDocument();
  });

  it('el enlace lleva la búsqueda actual en state.volverA', () => {
    montar(clasica, {}, '/catalogo?categoria=2&page=2');

    fireEvent.click(screen.getByRole('link', { name: 'Hamburguesa Clásica' }));

    expect(screen.getByTestId('destino')).toHaveTextContent('/catalogo/1|{"volverA":"?categoria=2&page=2"}');
  });

  it('no tiene violaciones de accesibilidad (con y sin imagen)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ul>
          <li>
            <TarjetaProducto producto={clasica} />
          </li>
          <li>
            <TarjetaProducto producto={productoDto({ id: 3, nombre: 'Flan', imagenes_url: ['https://img.test/flan.png'], stock_cantidad: 0 })} />
          </li>
        </ul>
      </MemoryRouter>,
    );

    await esperarSinViolacionesA11y(container);
  });
});
