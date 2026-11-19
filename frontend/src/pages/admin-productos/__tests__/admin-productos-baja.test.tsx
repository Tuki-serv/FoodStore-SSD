import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminProductos, escriturasProductos, pedidosProductos } from '@/test/msw/admin-productos';
import { API, server } from '@/test/msw/server';
import { montarAdminProductos } from '@/test/render-admin';

async function abrirBaja(nombre = 'Limonada Natural', estado = crearEstadoAdminProductos()) {
  const app = montarAdminProductos('/admin/productos', { estado });
  await app.usuario.click(await screen.findByRole('button', { name: `Eliminar ${nombre}` }));
  return { ...app, dialogo: await screen.findByRole('dialog') };
}

describe('baja de producto', () => {
  it('«Eliminar Limonada Natural» abre el diálogo con el nombre y la explicación; «Cancelar» no envía nada', async () => {
    const { estado, usuario, dialogo } = await abrirBaja();

    expect(within(dialogo).getByRole('heading', { name: '¿Eliminar «Limonada Natural»?' })).toBeInTheDocument();
    expect(within(dialogo).getByText(/Deja de verse en el catálogo/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Limonada Natural' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Limonada Natural' })).toHaveFocus();
    expect(escriturasProductos(estado)).toEqual([]);
  });

  it('confirmar responde 204, avisa «Producto eliminado», cierra el diálogo y quita la fila', async () => {
    const { estado, usuario, dialogo } = await abrirBaja();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await screen.findByText('Producto eliminado')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'DELETE', '/productos/6')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Limonada Natural' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Hamburguesa Clásica' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Productos y stock', level: 1 })).toHaveFocus();
  });

  it('eliminar otro producto envía el DELETE de ese id', async () => {
    const { estado, usuario, dialogo } = await abrirBaja('Coca-Cola 500ml');

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(pedidosProductos(estado, 'DELETE', '/productos/5')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Coca-Cola 500ml' })).not.toBeInTheDocument());
    expect(screen.getByRole('group', { name: 'Limonada Natural' })).toBeInTheDocument();
  });

  it('con la red caída el error aparece dentro del diálogo, que sigue abierto, y la fila sigue', async () => {
    const { usuario, dialogo } = await abrirBaja();
    server.use(http.delete(`${API}/productos/:id`, () => HttpResponse.error()));

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    const alerta = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos eliminar el producto');
    expect(alerta).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(screen.getByRole('group', { name: 'Limonada Natural' })).toBeInTheDocument();
    expect(screen.queryByText('Producto eliminado')).not.toBeInTheDocument();
  });

  it('durante el pedido el botón dice «Eliminando…» y está deshabilitado', async () => {
    const estado = crearEstadoAdminProductos();
    estado.demoras.DELETE = 150;
    const { usuario, dialogo } = await abrirBaja('Limonada Natural', estado);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminando…' })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('un 404 (ya eliminado por otro usuario) se muestra dentro del diálogo', async () => {
    const { usuario, dialogo } = await abrirBaja();
    server.use(http.delete(`${API}/productos/:id`, () => HttpResponse.json({ detail: 'Producto no encontrado', code: 'HTTP_404', field: null }, { status: 404 })));

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

    expect(await within(screen.getByRole('dialog')).findByText('Producto no encontrado')).toBeInTheDocument();
  });

  it('el diálogo no tiene violaciones de accesibilidad', async () => {
    const { dialogo } = await abrirBaja();

    await esperarSinViolacionesA11y(dialogo);
  });
});
