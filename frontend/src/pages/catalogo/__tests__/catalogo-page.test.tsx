import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/shared/auth';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { busquedasDeLista, handlersCatalogo, productoDto } from '@/test/msw/catalogo';
import { API, server } from '@/test/msw/server';
import { esperarCatalogo, montarCatalogo, nombresVisibles } from '@/test/render-catalogo';

const veinte = Array.from({ length: 20 }, (_, i) => productoDto({ id: i + 1, nombre: `Producto ${String(i + 1).padStart(2, '0')}` }));

describe('página Catálogo: listado', () => {
  it('un visitante anónimo ve las tarjetas en el orden del servidor y el primer pedido pide page=1&size=12&disponible=true', async () => {
    const { estado } = montarCatalogo('/catalogo');

    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(nombresVisibles()).toEqual([
      'Hamburguesa Clásica',
      'Burger BBQ Bacon',
      'Burger Vegana',
      'Burger Sin TACC',
      'Coca-Cola 500ml',
      'Limonada Natural',
    ]);
    expect(busquedasDeLista(estado)[0]).toBe('?page=1&size=12&disponible=true');
  });

  it('la primera tarjeta muestra nombre, categoría principal y precio, y enlaza al detalle', async () => {
    montarCatalogo('/catalogo');

    const primera = (await screen.findAllByRole('article'))[0] as HTMLElement;

    expect(within(primera).getByRole('link', { name: 'Hamburguesa Clásica' })).toHaveAttribute('href', '/catalogo/1');
    expect(within(primera).getByText('Hamburguesas')).toBeInTheDocument();
    expect(within(primera).getByText('$ 1.500')).toBeInTheDocument();
  });

  it('filtrado por «Hamburguesas» (categoria=1), su tarjeta no repite el texto de la categoría; sin filtro sí lo repite', async () => {
    montarCatalogo('/catalogo?categoria=1');

    const filtrada = (await screen.findAllByRole('article'))[0] as HTMLElement;
    expect(within(filtrada).getByRole('link', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(within(filtrada).queryByText('Hamburguesas')).not.toBeInTheDocument();
  });

  it('la tarjeta de un producto con alérgenos muestra «Contiene alérgenos» y la que no los tiene, no', async () => {
    montarCatalogo('/catalogo');

    const tarjetas = await screen.findAllByRole('article');
    expect(within(tarjetas[0] as HTMLElement).getByRole('img', { name: 'Contiene alérgenos' })).toBeInTheDocument();
    expect(within(tarjetas[1] as HTMLElement).queryByRole('img', { name: 'Contiene alérgenos' })).not.toBeInTheDocument();
  });

  it('un ADMIN ve lo mismo que un visitante y el pedido sigue con disponible=true', async () => {
    const { estado } = montarCatalogo('/catalogo', { sesion: { roles: ['ADMIN'] } });

    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(busquedasDeLista(estado)[0]).toBe('?page=1&size=12&disponible=true');
    expect(nombresVisibles()).toHaveLength(6);
  });

  it('anuncia el total en una región de estado («6 productos»)', async () => {
    montarCatalogo('/catalogo');

    const total = await screen.findByText('6 productos');

    expect(total).toHaveAttribute('role', 'status');
  });

  it('con un solo resultado dice «1 producto»', async () => {
    montarCatalogo('/catalogo', { productos: [productoDto({ id: 1, nombre: 'Único' })] });

    expect(await screen.findByText('1 producto')).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad con datos', async () => {
    montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});

describe('página Catálogo: carga, vacío y error', () => {
  it('mientras carga por primera vez muestra un esqueleto con aria-busy y luego las tarjetas', async () => {
    const { estado } = montarCatalogo('/catalogo');
    estado.demoras.lista = 150;

    const esqueleto = await screen.findByRole('list', { name: 'Cargando productos' });
    expect(esqueleto).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByRole('article')).toHaveLength(0);

    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    expect(screen.queryByRole('list', { name: 'Cargando productos' })).not.toBeInTheDocument();
  });

  it('con total 0 y sin filtros dice «Todavía no hay productos» y no ofrece «Limpiar filtros»', async () => {
    montarCatalogo('/catalogo', { productos: [] });

    expect(await screen.findByRole('heading', { name: 'Todavía no hay productos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('un 503 muestra el error con «Reintentar» y, con la respuesta siguiente en 200, las tarjetas', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo');
    server.use(http.get(`${API}/productos/`, () => new HttpResponse(null, { status: 503 })));

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los productos' })).toBeInTheDocument();
    server.use(...handlersCatalogo(estado));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('link', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No pudimos cargar los productos' })).not.toBeInTheDocument();
  });
});

describe('página Catálogo: paginación', () => {
  it('con 20 productos «Siguiente» pide page=2&size=12, la URL pasa a page=2 y se ve «Página 2 de 2»', async () => {
    const { estado, router, usuario } = montarCatalogo('/catalogo', { productos: veinte });
    await screen.findByRole('link', { name: 'Producto 01' });
    expect(nombresVisibles()).toHaveLength(12);

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(busquedasDeLista(estado)).toContain('?page=2&size=12&disponible=true');
    expect(router.state.location.search).toBe('?page=2');
    expect(nombresVisibles()).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('mientras llega la página nueva la grilla anterior sigue visible y atenuada', async () => {
    const { estado, usuario } = montarCatalogo('/catalogo', { productos: veinte });
    await screen.findByRole('link', { name: 'Producto 01' });
    estado.demoras.lista = 200;

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    const grilla = screen.getByRole('list', { name: 'Productos' });
    expect(grilla).toHaveAttribute('aria-busy', 'true');
    expect(grilla).toHaveClass('grid-busy');
    expect(screen.getByRole('link', { name: 'Producto 01' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Productos' })).not.toHaveAttribute('aria-busy', 'true'));
    expect(screen.queryByRole('link', { name: 'Producto 01' })).not.toBeInTheDocument();
  });

  it('abrir /catalogo?page=2 pide la página 2 directamente', async () => {
    const { estado } = montarCatalogo('/catalogo?page=2', { productos: veinte });

    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(busquedasDeLista(estado)[0]).toBe('?page=2&size=12&disponible=true');
  });

  it('con una sola página no hay controles de paginación', async () => {
    montarCatalogo('/catalogo');
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });

    expect(screen.queryByRole('navigation', { name: 'Paginación del catálogo' })).not.toBeInTheDocument();
  });
});

describe('página Catálogo: datos públicos', () => {
  it('un CLIENT que cierra sesión sigue viendo las mismas tarjetas sin un pedido nuevo de productos', async () => {
    const { estado } = montarCatalogo('/catalogo', { sesion: { roles: ['CLIENT'] } });
    await screen.findByRole('link', { name: 'Hamburguesa Clásica' });
    const antes = busquedasDeLista(estado).length;

    await act(async () => useAuthStore.getState().cerrarLocal({ motivo: 'logout' }));
    await esperarCatalogo();

    expect(nombresVisibles()).toHaveLength(6);
    expect(busquedasDeLista(estado)).toHaveLength(antes);
  });
});
