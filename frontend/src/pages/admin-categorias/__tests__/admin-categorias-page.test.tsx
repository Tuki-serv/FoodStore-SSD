import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminCatalogo, pedidosAdmin, pedidosDeEscritura, respuestaError } from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { esperarTitulo, montarAdmin } from '@/test/render-admin';

describe('AdminCategoriasPage: árbol del seed', () => {
  it('un ADMIN ve el título, las tres raíces, Gaseosas dentro de Bebidas y «2 subcategorías» en Hamburguesas', async () => {
    montarAdmin('/admin/categorias');

    await esperarTitulo('Categorías');
    expect(await screen.findByRole('button', { name: 'Nueva categoría' })).toBeInTheDocument();
    const arbol = await screen.findByRole('list', { name: 'Árbol de categorías' });
    for (const raiz of ['Bebidas', 'Hamburguesas', 'Postres']) {
      expect(within(arbol).getByRole('group', { name: raiz })).toBeInTheDocument();
    }
    expect(within(screen.getByRole('list', { name: 'Subcategorías de Bebidas' })).getByRole('group', { name: 'Gaseosas' })).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Hamburguesas' })).getByText('2 subcategorías')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Hamburguesas' })).toBeInTheDocument();
  });

  it('cada fila ofrece las tres acciones nombradas con la categoría y el resumen cuenta 6 categorías y 3 principales', async () => {
    montarAdmin('/admin/categorias');

    const postres = await screen.findByRole('group', { name: 'Postres' });

    expect(within(postres).getByText('Para cerrar con dulzura')).toBeInTheDocument();
    expect(within(postres).queryByText(/subcategoría/)).not.toBeInTheDocument();
    for (const accion of ['Agregar subcategoría a Postres', 'Editar Postres', 'Eliminar Postres']) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
    }
    expect(screen.getByRole('status')).toHaveTextContent('6 categorías · 3 principales');
  });

  it('un árbol de una sola raíz con una hija usa el singular', async () => {
    const estado = crearEstadoAdminCatalogo({
      categorias: [
        { id: 1, parent_id: null, nombre: 'Postres', descripcion: null, imagen_url: null, imagen_public_id: null },
        { id: 2, parent_id: 1, nombre: 'Helados', descripcion: null, imagen_url: null, imagen_public_id: null },
      ],
    });
    montarAdmin('/admin/categorias', { estado });

    expect(await screen.findByText('1 subcategoría')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 categorías · 1 principal');
  });
});

describe('AdminCategoriasPage: carga, vacío y error', () => {
  it('mientras carga muestra el esqueleto con aria-busy y luego el árbol', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.demoras.GET = 150;
    montarAdmin('/admin/categorias', { estado });

    const carga = await screen.findByRole('status', { name: 'Cargando categorías' });
    expect(carga).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Cargando categorías' })).not.toBeInTheDocument();
  });

  it('sin categorías muestra «Todavía no hay categorías» con un único «Nueva categoría»', async () => {
    montarAdmin('/admin/categorias', { estado: crearEstadoAdminCatalogo({ categorias: [] }) });

    expect(await screen.findByRole('heading', { name: 'Todavía no hay categorías' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nueva categoría' })).toHaveLength(1);
  });

  it('si el pedido falla muestra el error y «Reintentar» vuelve a pedir el árbol', async () => {
    const estado = crearEstadoAdminCatalogo();
    const { usuario } = montarAdmin('/admin/categorias', { estado });
    server.use(http.get(`${API}/categorias/arbol`, () => respuestaError(500, 'HTTP_500', 'Error del servidor'), { once: true }));

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar las categorías' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Error del servidor');
    const antes = pedidosAdmin(estado, 'GET', '/categorias/arbol').length;

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'GET', '/categorias/arbol').length).toBe(antes + 1);
  });

  it('con la red caída muestra el detalle de falta de conexión', async () => {
    montarAdmin('/admin/categorias');
    server.use(http.get(`${API}/categorias/arbol`, () => HttpResponse.error()));

    expect(await screen.findByText('No pudimos conectar con el servidor.')).toBeInTheDocument();
  });
});

describe('AdminCategoriasPage: permisos y accesibilidad', () => {
  it.each([['STOCK'], ['CLIENT']])('un usuario %s ve la página de acceso denegado y no se envía ningún pedido', async (rol) => {
    const { estado } = montarAdmin('/admin/categorias', { roles: [rol] });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).not.toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
    expect(estado.pedidos).toEqual([]);
  });

  it('un usuario con ADMIN entre varios roles accede', async () => {
    montarAdmin('/admin/categorias', { roles: ['CLIENT', 'ADMIN'] });

    expect(await screen.findByRole('group', { name: 'Postres' })).toBeInTheDocument();
  });

  it('la página con datos no tiene violaciones de accesibilidad', async () => {
    montarAdmin('/admin/categorias');
    await screen.findByRole('group', { name: 'Postres' });

    await waitFor(() => esperarSinViolacionesA11y(document.body));
  });
});
