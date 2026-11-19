import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore, type LineaCarrito } from '@/entities/cart';
import { esperarSinViolacionesA11y } from '@/test/axe';
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
const coca: LineaCarrito = {
  productoId: 5,
  nombre: 'Coca-Cola 500ml',
  precioUnitario: '800.00',
  imagenUrl: 'https://img.test/coca.png',
  cantidad: 1,
  personalizacion: [],
  personalizacionNombres: [],
};
const sinCebollaNiTomate: LineaCarrito = { ...hamburguesa, cantidad: 1, personalizacion: [11, 12], personalizacionNombres: ['Cebolla', 'Tomate'] };

const precargar = (...lineas: LineaCarrito[]): void => {
  act(() => useCartStore.setState({ lineas }));
};
const montar = () => renderApp('/carrito', { sesion: { roles: ['CLIENT'] } });
const titulo = () => screen.findByRole('heading', { name: 'Carrito', level: 1 });
const entradas = () => within(screen.getByRole('list', { name: 'Productos del carrito' })).getAllByRole('listitem');
const entrada = (indice: number) => within(entradas()[indice] as HTMLElement);
const resumen = () => screen.getByRole('region', { name: 'Resumen' });

describe('página Carrito', () => {
  it('con dos líneas muestra las entradas en orden con sus subtotales y el resumen', async () => {
    precargar(hamburguesa, coca);
    montar();
    await titulo();

    expect(entradas()).toHaveLength(2);
    expect(entradas()[0]).toHaveTextContent('Hamburguesa Clásica');
    expect(entrada(0).getByText('$ 3.000')).toBeInTheDocument();
    expect(entradas()[1]).toHaveTextContent('Coca-Cola 500ml');
    expect(entrada(1).getByText('$ 800')).toBeInTheDocument();
    expect(within(resumen()).getByText('Unidades').nextSibling).toHaveTextContent('3');
    expect(within(resumen()).getByText('Total').nextSibling).toHaveTextContent('$ 3.800');
  });

  it('con una sola unidad el encabezado dice «1 unidad en 1 línea»', async () => {
    precargar({ ...hamburguesa, cantidad: 1 });
    montar();
    await titulo();

    expect(screen.getByText('1 unidad en 1 línea')).toBeInTheDocument();
  });

  it('muestra el precio unitario y la imagen o su respaldo', async () => {
    precargar(hamburguesa, coca);
    montar();
    await titulo();

    expect(entrada(0).getByText('$ 1.500 c/u')).toBeInTheDocument();
    expect(entrada(0).getByRole('img', { name: 'Sin imagen de Hamburguesa Clásica' })).toBeInTheDocument();
    expect(entrada(1).getByRole('img', { name: 'Coca-Cola 500ml' })).toHaveAttribute('src', 'https://img.test/coca.png');
  });

  it('el nombre enlaza al detalle del producto', async () => {
    precargar(hamburguesa);
    montar();
    await titulo();

    expect(screen.getByRole('link', { name: 'Hamburguesa Clásica' })).toHaveAttribute('href', '/catalogo/1');
  });

  it('la nota de envío y precios finales es visible', async () => {
    precargar(hamburguesa);
    montar();
    await titulo();

    expect(screen.getByText('Se suma un costo de envío de $ 50. Los precios finales se confirman al crear el pedido.')).toBeInTheDocument();
  });
});

describe('personalización visible', () => {
  it('el mismo producto con y sin exclusiones son dos entradas, solo una con subtítulo', async () => {
    precargar(sinCebollaNiTomate, { ...hamburguesa, cantidad: 2 });
    montar();
    await titulo();

    expect(entradas()).toHaveLength(2);
    expect(entradas()[0]).toHaveTextContent('Sin cebolla, sin tomate');
    expect(entradas()[1]).not.toHaveTextContent(/Sin /);
    expect(entrada(0).getByRole('group', { name: 'Cantidad de Hamburguesa Clásica sin cebolla, sin tomate' })).toHaveTextContent('1');
    expect(entrada(1).getByRole('group', { name: 'Cantidad de Hamburguesa Clásica' })).toHaveTextContent('2');
  });

  it('las acciones de dos entradas del mismo producto tienen nombres distintos', async () => {
    precargar(sinCebollaNiTomate, hamburguesa);
    montar();
    await titulo();

    expect(screen.getByRole('button', { name: 'Quitar Hamburguesa Clásica sin cebolla, sin tomate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar Hamburguesa Clásica' })).toBeInTheDocument();
  });

  it('una línea con 2 ids sin nombres muestra «Sin 2 ingredientes»', async () => {
    precargar({ ...hamburguesa, personalizacion: [1, 2], personalizacionNombres: [] });
    montar();
    await titulo();

    expect(entradas()[0]).toHaveTextContent('Sin 2 ingredientes');
  });
});

describe('cantidades', () => {
  it('«Sumar una unidad de Hamburguesa Clásica» pasa de 2 a 3 y actualiza subtotal y total', async () => {
    precargar(hamburguesa);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad de Hamburguesa Clásica' }));

    expect(useCartStore.getState().lineas[0]?.cantidad).toBe(3);
    expect(entrada(0).getByRole('group', { name: 'Cantidad de Hamburguesa Clásica' })).toHaveTextContent('3');
    expect(entrada(0).getByText('$ 4.500')).toBeInTheDocument();
    expect(within(resumen()).getByText('Total').nextSibling).toHaveTextContent('$ 4.500');
  });

  it('«Restar una unidad» baja la cantidad y recalcula', async () => {
    precargar(hamburguesa);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Restar una unidad de Hamburguesa Clásica' }));

    expect(useCartStore.getState().lineas[0]?.cantidad).toBe(1);
    expect(within(resumen()).getByText('Total').nextSibling).toHaveTextContent('$ 1.500');
  });

  it('con cantidad 1 «Restar» está deshabilitado y la línea no se quita', async () => {
    precargar({ ...hamburguesa, cantidad: 1 });
    montar();
    await titulo();

    expect(screen.getByRole('button', { name: 'Restar una unidad de Hamburguesa Clásica' })).toBeDisabled();
    expect(useCartStore.getState().lineas).toHaveLength(1);
  });

  it('con cantidad 99 «Sumar» está deshabilitado', async () => {
    precargar({ ...hamburguesa, cantidad: 99 });
    montar();
    await titulo();

    expect(screen.getByRole('button', { name: 'Sumar una unidad de Hamburguesa Clásica' })).toBeDisabled();
  });

  it('la cantidad se anuncia en un output', async () => {
    precargar(hamburguesa);
    montar();
    await titulo();

    expect(entrada(0).getByRole('status')).toHaveTextContent('2');
  });
});

describe('quitar', () => {
  it('quita solo la línea elegida del mismo producto y avisa «Quitado del carrito»', async () => {
    precargar(sinCebollaNiTomate, hamburguesa);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Quitar Hamburguesa Clásica sin cebolla, sin tomate' }));

    expect(useCartStore.getState().lineas.map((linea) => linea.personalizacion)).toEqual([[]]);
    expect(entradas()).toHaveLength(1);
    expect(await screen.findByText('Quitado del carrito')).toBeInTheDocument();
  });

  it('quitar la última línea muestra el estado vacío', async () => {
    precargar(coca);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Quitar Coca-Cola 500ml' }));

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
  });
});

describe('vaciar', () => {
  it('«Vaciar carrito» pide confirmación y «Vaciar» deja el carrito vacío', async () => {
    precargar(hamburguesa, coca, sinCebollaNiTomate);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Vaciar carrito' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Vaciar el carrito?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Vaciar' }));

    await waitFor(() => expect(useCartStore.getState().lineas).toEqual([]));
    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
  });

  it('«Cancelar» conserva las líneas', async () => {
    precargar(hamburguesa, coca, sinCebollaNiTomate);
    const { usuario } = montar();
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Vaciar carrito' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Vaciar el carrito?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(useCartStore.getState().lineas).toHaveLength(3);
    expect(entradas()).toHaveLength(3);
  });
});

describe('carrito vacío y sin sesión', () => {
  it('muestra «Tu carrito está vacío» con «Ver catálogo» y sin «Vaciar carrito» ni resumen', async () => {
    montar();
    await titulo();

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver catálogo' })).toHaveAttribute('href', '/catalogo');
    expect(screen.queryByRole('button', { name: 'Vaciar carrito' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumen' })).not.toBeInTheDocument();
  });

  it('sin sesión lleva a /ingresar recordando /carrito', async () => {
    const { router } = renderApp('/carrito');

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/carrito', search: '', hash: '' } });
  });
});

describe('accesibilidad', () => {
  it('el carrito con dos líneas (una personalizada) no tiene violaciones', async () => {
    precargar(sinCebollaNiTomate, coca);
    montar();
    await titulo();

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });

  it('el carrito vacío no tiene violaciones', async () => {
    montar();
    await screen.findByRole('heading', { name: 'Tu carrito está vacío' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
