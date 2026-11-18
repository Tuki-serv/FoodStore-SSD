import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { busquedasDeLista, handlersCatalogo, productoDto, type EstadoCatalogo } from '@/test/msw/catalogo';
import { API, server } from '@/test/msw/server';
import { montarCatalogo, nombresVisibles } from '@/test/render-catalogo';

const ultima = (estado: EstadoCatalogo): string | undefined => busquedasDeLista(estado).at(-1);
const esperarPedido = (estado: EstadoCatalogo, esperado: string) => waitFor(() => expect(busquedasDeLista(estado)).toContain(esperado));
const ubicacion = (router: { state: { location: { pathname: string; search: string } } }) => `${router.state.location.pathname}${router.state.location.search}`;
const BASE = '?page=1&size=12&disponible=true';

const BEBIDAS = { id: 2, nombre: 'Bebidas', es_principal: true };
const limonadas = Array.from({ length: 14 }, (_, i) => productoDto({ id: i + 1, nombre: `Limonada ${String(i + 1).padStart(2, '0')}`, categorias: [BEBIDAS] }));
const cuarenta = Array.from({ length: 40 }, (_, i) => productoDto({ id: i + 1, nombre: `Producto ${String(i + 1).padStart(2, '0')}` }));

afterEach(() => vi.useRealTimers());

describe('árbol de categorías', () => {
  it('elegir «Hamburguesas» pide la categoría y sus descendientes, marca la actual y escribe categoria=1 en la URL', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo');
    const nav = await screen.findByRole('navigation', { name: 'Categorías' });

    await usuario.click(within(nav).getByRole('button', { name: 'Hamburguesas' }));

    await esperarPedido(estado, `${BASE}&categoria_ids=1&categoria_ids=4&categoria_ids=5`);
    expect(ubicacion(router)).toBe('/catalogo?categoria=1');
    expect(within(nav).getByRole('button', { name: 'Hamburguesas' })).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByText('4 productos')).toBeInTheDocument();
    expect(nombresVisibles()).toEqual(['Hamburguesa Clásica', 'Burger BBQ Bacon', 'Burger Vegana', 'Burger Sin TACC']);
  });

  it('elegir una subcategoría («Veganas») pide solo la suya', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    const nav = await screen.findByRole('navigation', { name: 'Categorías' });

    await usuario.click(within(nav).getByRole('button', { name: 'Veganas' }));

    await esperarPedido(estado, `${BASE}&categoria_ids=4`);
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
  });

  it('volver a «Todas» quita categoria_ids del pedido y categoria de la URL', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo?categoria=1');
    const nav = await screen.findByRole('navigation', { name: 'Categorías' });
    await screen.findByText('4 productos');

    await usuario.click(within(nav).getByRole('button', { name: 'Todas' }));

    await waitFor(() => expect(ultima(estado)).toBe(BASE));
    expect(ubicacion(router)).toBe('/catalogo');
    expect(within(nav).getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-current', 'true');
  });

  it('si el árbol responde 503 el listado se sigue mostrando y en su lugar hay un aviso con «Reintentar»', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    server.use(http.get(`${API}/categorias/arbol`, () => new HttpResponse(null, { status: 503 })));

    expect(await screen.findByText('No pudimos cargar las categorías')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Categorías' })).not.toBeInTheDocument();

    server.use(...handlersCatalogo(estado));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('navigation', { name: 'Categorías' })).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar las categorías')).not.toBeInTheDocument();
  });
});

describe('búsqueda por nombre', () => {
  const montarConTemporizadores = (ruta = '/catalogo') => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    return { ...montarCatalogo(ruta), usuario };
  };

  it('escribir «burger» de corrido hace un solo pedido con q=burger a los 300 ms y escribe q=burger en la URL', async () => {
    const { estado, router, usuario } = montarConTemporizadores();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), 'burger');
    act(() => vi.advanceTimersByTime(200));
    expect(busquedasDeLista(estado).filter((busqueda) => busqueda.includes('q='))).toEqual([]);

    act(() => vi.advanceTimersByTime(150));
    await esperarPedido(estado, `${BASE}&q=burger`);

    expect(busquedasDeLista(estado).filter((busqueda) => busqueda.includes('q='))).toEqual([`${BASE}&q=burger`]);
    expect(ubicacion(router)).toBe('/catalogo?q=burger');
    expect(await screen.findByText('3 productos')).toBeInTheDocument();
  });

  it('vaciar el campo quita q del pedido siguiente y de la URL', async () => {
    const { estado, router, usuario } = montarConTemporizadores('/catalogo?q=burger');
    const campo = await screen.findByRole('searchbox', { name: 'Buscar productos' });
    await screen.findByText('3 productos');

    await usuario.clear(campo);
    act(() => vi.advanceTimersByTime(350));

    await waitFor(() => expect(ultima(estado)).toBe(BASE));
    expect(ubicacion(router)).toBe('/catalogo');
  });

  it('«Borrar búsqueda» limpia el campo sin esperar los 300 ms', async () => {
    const { estado, router, usuario } = montarConTemporizadores('/catalogo?q=burger');
    await screen.findByText('3 productos');

    await usuario.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));

    expect(screen.getByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('');
    await waitFor(() => expect(ultima(estado)).toBe(BASE));
    expect(ubicacion(router)).toBe('/catalogo');
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).not.toBeInTheDocument();
  });

  it('«Atrás» del router restaura el texto del campo', async () => {
    const { router } = montarCatalogo('/catalogo?q=lim');
    const campo = await screen.findByRole('searchbox', { name: 'Buscar productos' });
    expect(campo).toHaveValue('lim');
    await act(() => router.navigate('/catalogo?q=burger'));
    await waitFor(() => expect(campo).toHaveValue('burger'));

    await act(() => router.navigate(-1));

    await waitFor(() => expect(campo).toHaveValue('lim'));
  });

  it('los espacios sobrantes no viajan al backend', async () => {
    const { estado, usuario } = montarConTemporizadores();
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), '  vegana  ');
    act(() => vi.advanceTimersByTime(350));

    await esperarPedido(estado, `${BASE}&q=vegana`);
  });
});

describe('rango de precio', () => {
  it('mínimo 1000 y máximo 2000 con «Aplicar» pide precio_min=1000&precio_max=2000 y escribe min y max en la URL', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.type(screen.getByRole('textbox', { name: 'Precio mínimo' }), '1000');
    await usuario.type(screen.getByRole('textbox', { name: 'Precio máximo' }), '2000');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    await esperarPedido(estado, `${BASE}&precio_min=1000&precio_max=2000`);
    expect(ubicacion(router)).toBe('/catalogo?min=1000&max=2000');
    expect(await screen.findByText('4 productos')).toBeInTheDocument();
  });

  it('Enter en un campo también aplica el rango', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.type(screen.getByRole('textbox', { name: 'Precio máximo' }), '800{Enter}');

    await esperarPedido(estado, `${BASE}&precio_max=800`);
  });

  it('mínimo 3000 y máximo 1000: muestra «El mínimo no puede superar al máximo» junto al máximo y no hace ningún pedido nuevo', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    const pedidosAntes = busquedasDeLista(estado).length;

    await usuario.type(screen.getByRole('textbox', { name: 'Precio mínimo' }), '3000');
    await usuario.type(screen.getByRole('textbox', { name: 'Precio máximo' }), '1000');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByText('El mínimo no puede superar al máximo')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Precio máximo' })).toHaveAccessibleDescription('El mínimo no puede superar al máximo');
    expect(screen.getByRole('textbox', { name: 'Precio máximo' })).toBeInvalid();
    expect(busquedasDeLista(estado)).toHaveLength(pedidosAntes);
    expect(ubicacion(router)).toBe('/catalogo');
  });

  it('un valor con coma («1,5») muestra «Ingresá un número entero» y no se aplica', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    const pedidosAntes = busquedasDeLista(estado).length;

    await usuario.type(screen.getByRole('textbox', { name: 'Precio mínimo' }), '1,5');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByText('Ingresá un número entero')).toBeInTheDocument();
    expect(busquedasDeLista(estado)).toHaveLength(pedidosAntes);
  });

  it('corregir el valor y aplicar de nuevo quita el error', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    const minimo = screen.getByRole('textbox', { name: 'Precio mínimo' });
    await usuario.type(minimo, 'abc');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByText('Ingresá un número entero')).toBeInTheDocument();

    await usuario.clear(minimo);
    await usuario.type(minimo, '1700');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.queryByText('Ingresá un número entero')).not.toBeInTheDocument();
    await esperarPedido(estado, `${BASE}&precio_min=1700`);
  });
});

describe('disponibilidad', () => {
  it('«Solo con stock» pide con_stock=true y escribe stock=1 en la URL', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('switch', { name: 'Solo con stock' }));

    await esperarPedido(estado, `${BASE}&con_stock=true`);
    expect(ubicacion(router)).toBe('/catalogo?stock=1');
    expect(screen.getByRole('switch', { name: 'Solo con stock' })).toBeChecked();
  });

  it('desactivarlo quita con_stock', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo?stock=1');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('switch', { name: 'Solo con stock' }));

    await waitFor(() => expect(ultima(estado)).toBe(BASE));
    expect(ubicacion(router)).toBe('/catalogo');
  });

  it('estando en la página 3, cualquier filtro vuelve a la página 1', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo?page=3', { productos: cuarenta });
    await screen.findByText('Página 3 de 4');

    await usuario.click(screen.getByRole('switch', { name: 'Solo con stock' }));

    await esperarPedido(estado, `${BASE}&con_stock=true`);
    expect(ubicacion(router)).toBe('/catalogo?stock=1');
  });
});

describe('filtros en la dirección de la página', () => {
  it('abrir /catalogo?categoria=2&q=lim&page=2 pide el subárbol de «Bebidas», q=lim y page=2, y el campo muestra «lim»', async () => {
    const { estado } = montarCatalogo('/catalogo?categoria=2&q=lim&page=2', { productos: limonadas });

    expect(await screen.findByRole('searchbox', { name: 'Buscar productos' })).toHaveValue('lim');
    await esperarPedido(estado, '?page=2&size=12&disponible=true&q=lim&categoria_ids=2&categoria_ids=6');
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(nombresVisibles()).toEqual(['Limonada 13', 'Limonada 14']);
  });

  it('con valores inválidos (page=-4&min=abc) el pedido usa page=1 y no incluye precio_min', async () => {
    const { estado } = montarCatalogo('/catalogo?page=-4&min=abc');

    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(busquedasDeLista(estado)[0]).toBe(BASE);
  });

  it('una categoría que no existe en el árbol se quita de la URL y el listado queda sin filtrar', async () => {
    const { router } = montarCatalogo('/catalogo?categoria=99&q=vegana');

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?q=vegana'));
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
  });

  it('una página fuera de rango vuelve a la última que existe', async () => {
    const { router } = montarCatalogo('/catalogo?page=9');

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
    expect(await screen.findByRole('link', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
  });
});

describe('filtros activos', () => {
  it('muestra un chip por filtro y «Quitar filtro Bebidas» quita solo ese', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?categoria=2&q=lim', { productos: limonadas });
    await screen.findByText('14 productos');

    expect(screen.getByRole('button', { name: 'Quitar filtro Bebidas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtro lim' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Quitar filtro Bebidas' }));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo?q=lim'));
    expect(screen.queryByRole('button', { name: 'Quitar filtro Bebidas' })).not.toBeInTheDocument();
  });

  it('el rango y el stock tienen su chip («$ 1.000 – $ 2.000», «Solo con stock»)', async () => {
    montarCatalogo('/catalogo?min=1000&max=2000&stock=1');
    await screen.findByText('4 productos');

    expect(screen.getByRole('button', { name: 'Quitar filtro $ 1.000 – $ 2.000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar filtro Solo con stock' })).toBeInTheDocument();
  });

  it('un solo extremo se lee «Desde $ 1.000» o «Hasta $ 2.000»', async () => {
    const { usuario, router } = montarCatalogo('/catalogo?min=1000');
    await screen.findByText('4 productos');

    expect(screen.getByRole('button', { name: 'Quitar filtro Desde $ 1.000' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Quitar filtro Desde $ 1.000' }));
    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
    await act(() => router.navigate('/catalogo?max=2000'));
    expect(await screen.findByRole('button', { name: 'Quitar filtro Hasta $ 2.000' })).toBeInTheDocument();
  });

  it('con un solo filtro no se ofrece «Limpiar filtros»; con dos o más sí, y lo deja todo en /catalogo', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?stock=1');
    await screen.findByText('6 productos');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    await act(() => router.navigate('/catalogo?stock=1&categoria=1&min=1000'));
    await usuario.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
    expect(screen.queryByRole('button', { name: /^Quitar filtro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });
});

describe('sin resultados', () => {
  it('con q=sushi muestra «No encontramos productos», menciona «sushi» y «Limpiar filtros» vuelve a /catalogo', async () => {
    const { router, usuario } = montarCatalogo('/catalogo?q=sushi');

    expect(await screen.findByRole('heading', { name: 'No encontramos productos' })).toBeInTheDocument();
    expect(screen.getByText(/Nada coincide con «sushi»/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(ubicacion(router)).toBe('/catalogo'));
    expect(await screen.findByRole('link', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
  });

  it('con varios filtros muestra sus chips dentro del estado y un único «Limpiar filtros»', async () => {
    montarCatalogo('/catalogo?q=sushi&stock=1');

    await screen.findByRole('heading', { name: 'No encontramos productos' });

    expect(screen.getAllByRole('button', { name: 'Limpiar filtros' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Quitar filtro Solo con stock' })).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad', async () => {
    montarCatalogo('/catalogo?q=sushi&stock=1');
    await screen.findByRole('heading', { name: 'No encontramos productos' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
