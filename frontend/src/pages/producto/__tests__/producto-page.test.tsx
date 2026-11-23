import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { abrirSesion } from '@/entities/session';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { handlerMe } from '@/test/msw/auth';
import { handlersCatalogo, pedidosDeProductos, productoDto, productosSeed } from '@/test/msw/catalogo';
import { API, server } from '@/test/msw/server';
import { montarCatalogo } from '@/test/render-catalogo';
import { setViewport } from '@/test/viewport';

const ubicacion = (router: { state: { location: { pathname: string; search: string } } }) => `${router.state.location.pathname}${router.state.location.search}`;
const titulo = (nombre: string) => screen.findByRole('heading', { name: nombre, level: 1 });

const BEBIDAS = { id: 2, nombre: 'Bebidas', es_principal: true };
const productoConStock = (stock: number) =>
  productoDto({ id: 7, nombre: 'Burger Doble Cheddar', precio_base: '2300.00', stock_cantidad: stock, categorias: [{ id: 1, nombre: 'Hamburguesas', es_principal: true }] });

describe('página Detalle de producto', () => {
  it('muestra nombre, precio, categoría, descripción e ingredientes con la marca «Alérgeno» y el resumen de alérgenos', async () => {
    montarCatalogo('/catalogo/1');

    expect(await titulo('Hamburguesa Clásica')).toBeInTheDocument();
    expect(document.querySelector('.pd-price .price')).toHaveTextContent('$ 1.500');
    expect(screen.getByText('Hamburguesas', { selector: '.tagline' })).toBeInTheDocument();
    expect(screen.getByText('La de siempre, perfecta de siempre.')).toBeInTheDocument();

    const ingredientes = within(screen.getByRole('region', { name: 'Ingredientes' })).getAllByRole('listitem');
    expect(ingredientes.map((item) => item.textContent)).toEqual(['Pan BriocheAlérgeno', 'Lechuga', 'MayonesaAlérgeno']);
    expect(screen.getByText('Contiene alérgenos')).toBeInTheDocument();
    expect(screen.getByText('Pan Brioche, Mayonesa')).toBeInTheDocument();
  });

  it('muestra la categoría principal primero y todas las demás', async () => {
    montarCatalogo('/catalogo/3');

    await titulo('Burger Vegana');

    expect(screen.getByText('Hamburguesas · Veganas', { selector: '.tagline' })).toBeInTheDocument();
  });

  it('un producto sin ingredientes no muestra la sección ni el resumen de alérgenos', async () => {
    montarCatalogo('/catalogo/5');

    await titulo('Coca-Cola 500ml');

    expect(screen.queryByRole('region', { name: 'Ingredientes' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Contiene alérgenos/)).not.toBeInTheDocument();
  });

  it('un producto con ingredientes pero ninguno alérgeno no muestra el resumen', async () => {
    const sinAlergenos = productoDto({
      id: 8,
      nombre: 'Ensalada',
      ingredientes: [{ id: 9, nombre: 'Lechuga', es_alergeno: false, es_removible: true, cantidad: '1.000', unidad_medida_id: 1 }],
    });
    montarCatalogo('/catalogo/8', { productos: [...productosSeed, sinAlergenos] });

    await titulo('Ensalada');

    expect(screen.getByRole('region', { name: 'Ingredientes' })).toBeInTheDocument();
    expect(screen.queryByText(/Contiene alérgenos/)).not.toBeInTheDocument();
    expect(screen.queryByText('Alérgeno')).not.toBeInTheDocument();
  });

  it('muestra la imagen con el nombre como alt, o el marcador si no tiene', async () => {
    const conImagen = productoDto({ id: 8, nombre: 'Flan', imagenes_url: ['https://img.test/flan.png'] });
    montarCatalogo('/catalogo/8', { productos: [conImagen] });

    expect(await screen.findByRole('img', { name: 'Flan' })).toHaveAttribute('src', 'https://img.test/flan.png');
  });

  it('no tiene violaciones de accesibilidad', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});

describe('página Detalle: producto inexistente o no disponible', () => {
  it('un 404 muestra «Este producto no está disponible» con el enlace «Ver el catálogo»', async () => {
    montarCatalogo('/catalogo/99');

    expect(await titulo('Este producto no está disponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/catalogo');
  });

  it.each([['abc'], ['0'], ['-3'], ['1.5']])('el id inválido «%s» muestra el mismo estado sin pedir nada al servidor', async (id) => {
    const { estado } = montarCatalogo(`/catalogo/${id}`);

    expect(await titulo('Este producto no está disponible')).toBeInTheDocument();
    expect(pedidosDeProductos(estado)).toEqual([]);
  });

  it('un 503 muestra un error con «Reintentar» y, con la respuesta siguiente en 200, el producto', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo/1');
    server.use(http.get(`${API}/productos/:id`, () => new HttpResponse(null, { status: 503 })));

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar el producto' })).toBeInTheDocument();
    server.use(...handlersCatalogo(estado));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await titulo('Hamburguesa Clásica')).toBeInTheDocument();
  });

  it('mientras carga muestra un esqueleto con aria-busy', async () => {
    const { estado } = montarCatalogo('/catalogo/1');
    estado.demoras.detalle = 150;

    expect(await screen.findByRole('status', { name: 'Cargando producto' })).toHaveAttribute('aria-busy', 'true');
    expect(await titulo('Hamburguesa Clásica')).toBeInTheDocument();
  });
});

describe('página Detalle: stock y cantidad', () => {
  it('con stock 3: «Quedan 3», el selector llega a 3 y ahí «Sumar una unidad» queda deshabilitado', async () => {
    const { usuario } = montarCatalogo('/catalogo/7', { productos: [productoConStock(3)] });
    await titulo('Burger Doble Cheddar');
    const sumar = screen.getByRole('button', { name: 'Sumar una unidad' });
    const restar = screen.getByRole('button', { name: 'Restar una unidad' });

    expect(screen.getByText('Quedan 3')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Cantidad' })).toHaveTextContent('1');
    expect(restar).toBeDisabled();
    await usuario.click(sumar);
    await usuario.click(sumar);

    expect(screen.getByRole('group', { name: 'Cantidad' })).toHaveTextContent('3');
    expect(sumar).toBeDisabled();
    await usuario.click(restar);
    expect(screen.getByRole('group', { name: 'Cantidad' })).toHaveTextContent('2');
    expect(sumar).toBeEnabled();
  });

  it('un CLIENT sube la cantidad a 3 y «Agregar al carrito» suma 3 unidades y avisa «Agregado al carrito»', async () => {
    const { usuario } = montarCatalogo('/catalogo/7', { productos: [productoConStock(3)], sesion: { roles: ['CLIENT'] } });
    await titulo('Burger Doble Cheddar');
    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad' }));
    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad' }));

    await usuario.click(screen.getByRole('button', { name: 'Agregar Burger Doble Cheddar al carrito' }));

    expect(useCartStore.getState().lineas).toEqual([
      { productoId: 7, nombre: 'Burger Doble Cheddar', precioUnitario: '2300.00', imagenUrl: null, cantidad: 3, personalizacion: [], personalizacionNombres: [] },
    ]);
    expect(await screen.findByText('Agregado al carrito')).toBeInTheDocument();
    expect(screen.getByText('3 × Burger Doble Cheddar')).toBeInTheDocument();
  });

  it('un producto sin imágenes muestra el respaldo tipográfico grande con su inicial y «Sin imagen de …»', async () => {
    montarCatalogo('/catalogo/7', { productos: [productoConStock(5)] });
    await titulo('Burger Doble Cheddar');

    const respaldo = screen.getByRole('img', { name: 'Sin imagen de Burger Doble Cheddar' });
    expect(respaldo).toHaveClass('ph', 'lg');
    expect(respaldo).toHaveTextContent('B');
  });

  it('con stock 0: «Agotado», sin selector de cantidad y con el botón de agregar deshabilitado', async () => {
    montarCatalogo('/catalogo/7', { productos: [productoConStock(0)] });
    await titulo('Burger Doble Cheddar');

    expect(screen.getByText('Agotado', { selector: '.stock' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Cantidad' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agotado' })).toBeDisabled();
  });

  it('con mucho stock no muestra aviso de stock', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    expect(screen.queryByText(/Quedan|Agotado/)).not.toBeInTheDocument();
  });

  it('en mobile hay un solo botón «Agregar al carrito» (la barra fija reemplaza al bloque en línea)', async () => {
    act(() => setViewport(390));
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    expect(screen.getAllByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toHaveLength(1);
  });
});

describe('página Detalle: volver al catálogo', () => {
  const productos = Array.from({ length: 14 }, (_, i) => productoDto({ id: i + 1, nombre: `Bebida ${String(i + 1).padStart(2, '0')}`, categorias: [BEBIDAS] }));

  it('desde una tarjeta de /catalogo?categoria=2&page=2 vuelve a esa URL', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&page=2', { productos });
    await usuario.click(await screen.findByRole('link', { name: 'Bebida 13' }));
    await titulo('Bebida 13');
    expect(ubicacion(router)).toBe('/catalogo/13');

    await usuario.click(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('link', { name: 'Catálogo' }));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?categoria=2&page=2'));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('abierto directo, vuelve a /catalogo', async () => {
    montarCatalogo('/catalogo/1');
    await titulo('Hamburguesa Clásica');

    expect(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/catalogo');
  });
});

describe('página Detalle: agregar sin sesión', () => {
  it('un visitante en /catalogo/7 con cantidad 2 pulsa «Agregar al carrito», pasa por /ingresar, vuelve a /catalogo/7 y el carrito sigue vacío', async () => {
    const { router, usuario } = montarCatalogo('/catalogo/7', { productos: [productoConStock(5)] });
    await titulo('Burger Doble Cheddar');
    await usuario.click(screen.getByRole('button', { name: 'Sumar una unidad' }));

    await usuario.click(screen.getByRole('button', { name: 'Agregar Burger Doble Cheddar al carrito' }));

    expect(await titulo('Ingresar')).toBeInTheDocument();
    expect(ubicacion(router)).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: '/catalogo/7', search: '', hash: '' } });
    server.use(handlerMe(['CLIENT']));
    await act(() => abrirSesion('A9'));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo/7'));
    expect(await titulo('Burger Doble Cheddar')).toBeInTheDocument();
    expect(useCartStore.getState().lineas).toEqual([]);
  });
});

describe('integración catálogo → carrito', () => {
  it('un CLIENT agrega desde /catalogo y el carrito local tiene la línea', async () => {
    const { usuario } = montarCatalogo('/catalogo', { sesion: { roles: ['CLIENT'] } });

    await usuario.click(await screen.findByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' }));

    expect(await screen.findByText('Agregado al carrito')).toBeInTheDocument();
    expect(useCartStore.getState().lineas.map((linea) => [linea.productoId, linea.cantidad])).toEqual([[1, 1]]);
    expect(useCartStore.getState().lineas[0]?.personalizacion).toEqual([]);
    expect(useCartStore.getState().lineas[0]?.personalizacionNombres).toEqual([]);
  });
});
