import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminCatalogo, pedidosAdmin, pedidosDeEscritura, respuestaError } from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { montarAdmin } from '@/test/render-admin';

describe('baja de categoría', () => {
  it('«Eliminar Postres» abre el diálogo de confirmación; confirmar envía el DELETE, avisa y Postres desaparece del árbol', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Postres' }));

    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar «Postres»?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'DELETE', '/categorias/3')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Postres' })).not.toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Bebidas' })).toBeInTheDocument();
  });

  it('«Cancelar» y Escape cierran sin enviar nada y el foco vuelve al botón de la fila', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    const boton = await screen.findByRole('button', { name: 'Eliminar Postres' });

    await usuario.click(boton);
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    await usuario.click(boton);
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('el diálogo de confirmación no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarAdmin('/admin/categorias');
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Postres' }));

    await esperarSinViolacionesA11y(screen.getByRole('dialog'));
  });
});

describe('baja de categoría: subcategorías activas', () => {
  it('«Eliminar Hamburguesas» explica que tiene 2 subcategorías y ofrece solo «Entendido», sin enviar ningún pedido', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Hamburguesas' }));

    const dialogo = screen.getByRole('dialog', { name: 'No podés eliminar «Hamburguesas» todavía' });
    expect(dialogo).toHaveTextContent('Tiene 2 subcategorías activas');
    expect(dialogo).toHaveTextContent('Movelas a otra categoría');
    expect(within(dialogo).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Sin TACC', 'Veganas']);
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
  });

  it('con una sola subcategoría usa el singular', async () => {
    const { usuario } = montarAdmin('/admin/categorias');

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Bebidas' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Tiene 1 subcategoría activa');
  });
});

describe('baja de categoría: rechazos del servidor', () => {
  it('un 409 CATEGORY_HAS_PRODUCTS deja el diálogo abierto con el motivo, «Cerrar» e «Ir a Productos y stock», y el árbol intacto', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.categoriasConProductos.add(6);
    const { usuario } = montarAdmin('/admin/categorias', { estado });

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Gaseosas' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se puede eliminar: tiene productos activos');
    expect(alerta).toHaveTextContent('Quitalos de la categoría desde Productos y stock');
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('link', { name: 'Ir a Productos y stock' })).toHaveAttribute('href', '/admin/productos');
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Gaseosas' })).toBeInTheDocument();
    expect(screen.queryByText('Categoría eliminada')).not.toBeInTheDocument();
    await esperarSinViolacionesA11y(dialogo);
  });

  it('un 409 CATEGORY_HAS_CHILDREN (árbol desactualizado) muestra el motivo y vuelve a pedir el árbol', async () => {
    const estado = crearEstadoAdminCatalogo();
    const { usuario } = montarAdmin('/admin/categorias', { estado });
    // Otro usuario agregó una subcategoría a «Postres» después de que se cargó el árbol.
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Postres' }));
    estado.categorias.push({ id: 7, parent_id: 3, nombre: 'Helados', descripcion: null, imagen_url: null, imagen_public_id: null });
    const antes = pedidosAdmin(estado, 'GET', '/categorias/arbol').length;

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede eliminar: tiene subcategorías activas');
    await waitFor(() => expect(pedidosAdmin(estado, 'GET', '/categorias/arbol').length).toBe(antes + 1));
    expect(await screen.findByRole('group', { name: 'Helados' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Postres' })).toBeInTheDocument();
  });

  it('un error genérico se muestra dentro del diálogo y permite reintentar', async () => {
    const { estado, usuario } = montarAdmin('/admin/categorias');
    server.use(http.delete(`${API}/categorias/3`, () => respuestaError(500, 'HTTP_500', 'Error del servidor'), { once: true }));

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Postres' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Error del servidor');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument();
    expect(pedidosAdmin(estado, 'DELETE', '/categorias/3')).toHaveLength(1);
  });

  it('mientras la baja está en curso el botón dice «Eliminando…» y queda deshabilitado, y el diálogo no se cierra con Escape', async () => {
    const estado = crearEstadoAdminCatalogo();
    const { usuario } = montarAdmin('/admin/categorias', { estado });
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Postres' }));
    estado.demoras.DELETE = 200;

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const enCurso = await screen.findByRole('button', { name: 'Eliminando…' });
    expect(enCurso).toBeDisabled();
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('Categoría eliminada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Categorías', level: 1 })).toHaveFocus();
  });
});
