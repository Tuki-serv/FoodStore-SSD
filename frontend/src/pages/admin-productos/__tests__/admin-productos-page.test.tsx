import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { busquedasProductos, crearEstadoAdminProductos, escriturasProductos } from '@/test/msw/admin-productos';
import { API, server } from '@/test/msw/server';
import { esperarTitulo, montarAdminProductos } from '@/test/render-admin';

describe('AdminProductosPage: listado', () => {
  it('con sesión ADMIN muestra el título, «Nuevo producto» y los productos con categoría y precio', async () => {
    montarAdminProductos('/admin/productos');

    expect(await esperarTitulo('Productos y stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeInTheDocument();
    const clasica = await screen.findByRole('group', { name: 'Hamburguesa Clásica' });
    expect(clasica).toHaveTextContent('Hamburguesas');
    expect(clasica).toHaveTextContent('$ 1.500');
    expect(within(clasica).getByRole('spinbutton', { name: 'Stock de Hamburguesa Clásica' })).toHaveValue(50);
    expect(screen.getByRole('status')).toHaveTextContent('6 productos');
  });

  it('un producto no disponible muestra «Agotado» y el interruptor apagado; los disponibles lo muestran encendido', async () => {
    montarAdminProductos('/admin/productos');

    const limonada = await screen.findByRole('group', { name: 'Limonada Natural' });

    expect(within(limonada).getByText('Agotado')).toBeInTheDocument();
    expect(within(limonada).getByRole('switch', { name: 'Disponible: Limonada Natural' })).not.toBeChecked();
    expect(within(screen.getByRole('group', { name: 'Hamburguesa Clásica' })).getByRole('switch')).toBeChecked();
  });

  it('con pocas unidades avisa «Quedan N» y una fila con varias categorías las nombra', async () => {
    const estado = crearEstadoAdminProductos();
    estado.productos[3] = { ...(estado.productos[3] as (typeof estado.productos)[number]), stock_cantidad: 4 };
    montarAdminProductos('/admin/productos', { estado });

    const tacc = await screen.findByRole('group', { name: 'Burger Sin TACC' });

    expect(tacc).toHaveTextContent('Quedan 4');
    expect(tacc).toHaveTextContent('Hamburguesas · Sin TACC');
  });
});

describe('AdminProductosPage: permisos por rol', () => {
  it('STOCK ve stock e interruptor en cada fila y ninguna acción de gestión', async () => {
    const { estado } = montarAdminProductos('/admin/productos', { roles: ['STOCK'] });

    const fila = await screen.findByRole('group', { name: 'Burger Vegana' });

    expect(within(fila).getByRole('spinbutton', { name: 'Stock de Burger Vegana' })).toBeInTheDocument();
    expect(within(fila).getByRole('switch', { name: 'Disponible: Burger Vegana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo producto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Eliminar / })).not.toBeInTheDocument();
    expect(escriturasProductos(estado)).toEqual([]);
  });

  it('ADMIN con STOCK ve todo: «Nuevo producto», «Editar» y «Eliminar» además del stock', async () => {
    montarAdminProductos('/admin/productos', { roles: ['ADMIN', 'STOCK'] });

    const fila = await screen.findByRole('group', { name: 'Burger Vegana' });

    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeInTheDocument();
    expect(within(fila).getByRole('button', { name: 'Editar Burger Vegana' })).toBeInTheDocument();
    expect(within(fila).getByRole('button', { name: 'Eliminar Burger Vegana' })).toBeInTheDocument();
    expect(within(fila).getByRole('spinbutton')).toBeInTheDocument();
  });

  it('CLIENT ve el acceso denegado y no se envía ningún pedido de escritura', async () => {
    const { estado } = montarAdminProductos('/admin/productos', { roles: ['CLIENT'] });

    expect(await screen.findByRole('heading', { name: /acceso/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Burger Vegana' })).not.toBeInTheDocument();
    expect(escriturasProductos(estado)).toEqual([]);
  });
});

describe('AdminProductosPage: filtros y URL', () => {
  it('«No disponibles» pide disponible=false desde la página 1, guarda el filtro en la URL y muestra solo Limonada', async () => {
    const { estado, usuario, router } = montarAdminProductos('/admin/productos');
    await screen.findByRole('group', { name: 'Hamburguesa Clásica' });

    await usuario.click(screen.getByRole('button', { name: 'No disponibles' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Hamburguesa Clásica' })).not.toBeInTheDocument());
    expect(busquedasProductos(estado).at(-1)).toBe('?page=1&size=20&disponible=false');
    expect(router.state.location.search).toBe('?disponible=no');
    expect(screen.getByRole('button', { name: 'No disponibles' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Limonada Natural' })).toBeInTheDocument();
  });

  it('abrir con ?q=burger&page=2 respeta ambos en el pedido y en los controles', async () => {
    const { estado } = montarAdminProductos('/admin/productos?q=burger&page=2');

    await screen.findByRole('status');

    expect(busquedasProductos(estado)[0]).toBe('?page=2&size=20&q=burger');
    expect(screen.getByRole('searchbox', { name: 'Buscar productos por nombre' })).toHaveValue('burger');
  });

  it('la búsqueda se aplica al enviar (Enter), no por tecla, y vuelve a la página 1', async () => {
    const { estado, usuario, router } = montarAdminProductos('/admin/productos');
    await screen.findByRole('group', { name: 'Hamburguesa Clásica' });
    const pedidosAntes = busquedasProductos(estado).length;

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar productos por nombre' }), 'vegana');
    expect(busquedasProductos(estado)).toHaveLength(pedidosAntes);
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar productos por nombre' }), '{Enter}');

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Hamburguesa Clásica' })).not.toBeInTheDocument());
    expect(busquedasProductos(estado).at(-1)).toBe('?page=1&size=20&q=vegana');
    expect(router.state.location.search).toBe('?q=vegana');
    expect(screen.getByRole('group', { name: 'Burger Vegana' })).toBeInTheDocument();
  });

  it('el filtro de categoría ofrece el árbol indentado y pide categoria_ids', async () => {
    const { estado, usuario, router } = montarAdminProductos('/admin/productos');
    await screen.findByRole('group', { name: 'Hamburguesa Clásica' });
    const selector = screen.getByRole('combobox', { name: 'Categoría' });
    await within(selector).findByRole('option', { name: '— Veganas' });

    await usuario.selectOptions(selector, '— Veganas');

    await waitFor(() => expect(busquedasProductos(estado).at(-1)).toBe('?page=1&size=20&categoria_ids=4'));
    expect(router.state.location.search).toBe('?categoria=4');
    expect(await screen.findByRole('group', { name: 'Burger Vegana' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Coca-Cola 500ml' })).not.toBeInTheDocument();
  });
});

describe('AdminProductosPage: estados', () => {
  it('una búsqueda sin resultados muestra «No encontramos productos con esos filtros» y «Limpiar filtros» los quita', async () => {
    const { usuario, router } = montarAdminProductos('/admin/productos?q=pizza');

    expect(await screen.findByText('No encontramos productos con esos filtros')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('sin productos ni filtros invita a crear el primero (ADMIN)', async () => {
    const vacio = crearEstadoAdminProductos([]);
    montarAdminProductos('/admin/productos', { estado: vacio });
    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo producto' })).toBeInTheDocument();
  });

  it('mientras carga muestra el esqueleto con aria-busy', async () => {
    const estado = crearEstadoAdminProductos();
    estado.demoras.GET = 200;
    montarAdminProductos('/admin/productos', { estado });

    expect(await screen.findByRole('status', { name: 'Cargando productos' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
  });

  it('si falla la carga muestra el error y «Reintentar» vuelve a pedir el listado', async () => {
    const { usuario } = montarAdminProductos('/admin/productos');
    server.use(http.get(`${API}/productos/`, () => HttpResponse.json({ detail: 'Falla interna', code: 'HTTP_500', field: null }, { status: 500 }), { once: true }));

    expect(await screen.findByText('No pudimos cargar los productos')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad (ADMIN)', async () => {
    montarAdminProductos('/admin/productos');
    await screen.findByRole('group', { name: 'Hamburguesa Clásica' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });

  it('no tiene violaciones de accesibilidad (STOCK)', async () => {
    montarAdminProductos('/admin/productos', { roles: ['STOCK'] });
    await screen.findByRole('group', { name: 'Hamburguesa Clásica' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
