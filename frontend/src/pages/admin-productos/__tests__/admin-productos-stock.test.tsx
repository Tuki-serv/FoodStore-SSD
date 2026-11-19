import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { crearEstadoAdminProductos, escriturasProductos, pedidosProductos } from '@/test/msw/admin-productos';
import { API, server } from '@/test/msw/server';
import { montarAdminProductos } from '@/test/render-admin';

async function abrirComoStock(estado = crearEstadoAdminProductos()) {
  const app = montarAdminProductos('/admin/productos', { roles: ['STOCK'], estado });
  await screen.findByRole('group', { name: 'Burger Vegana' });
  return app;
}

const campoStock = (nombre: string) => screen.getByRole('spinbutton', { name: `Stock de ${nombre}` });

describe('stock desde la lista', () => {
  it('STOCK escribe 12 y guarda: envía {"stock_cantidad":12}, la fila muestra 12, avisa y no toca el interruptor', async () => {
    const { estado, usuario } = await abrirComoStock();
    const interruptor = screen.getByRole('switch', { name: 'Disponible: Burger Vegana' });

    await usuario.clear(campoStock('Burger Vegana'));
    await usuario.type(campoStock('Burger Vegana'), '12');
    await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Burger Vegana' }));

    expect(await screen.findByText('Stock actualizado')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'PATCH', '/productos/3/stock')[0]?.cuerpo).toEqual({ stock_cantidad: 12 });
    expect(pedidosProductos(estado, 'PATCH', '/productos/3/disponibilidad')).toEqual([]);
    expect(campoStock('Burger Vegana')).toHaveValue(12);
    expect(screen.getByRole('switch', { name: 'Disponible: Burger Vegana' })).toBeChecked();
    expect(interruptor).toBeChecked();
  });

  it('el botón «Guardar» está deshabilitado mientras el valor no cambió y Enter en el campo guarda', async () => {
    const { estado, usuario } = await abrirComoStock();
    expect(screen.getByRole('button', { name: 'Guardar stock de Coca-Cola 500ml' })).toBeDisabled();

    await usuario.clear(campoStock('Coca-Cola 500ml'));
    await usuario.type(campoStock('Coca-Cola 500ml'), '90{Enter}');

    await waitFor(() => expect(pedidosProductos(estado, 'PATCH', '/productos/5/stock')[0]?.cuerpo).toEqual({ stock_cantidad: 90 }));
    expect(await screen.findByText('Stock actualizado')).toBeInTheDocument();
  });

  it('un valor inválido (-1, 2.5, vacío) no envía nada y muestra el error en la fila con aria-invalid', async () => {
    const { estado, usuario } = await abrirComoStock();

    for (const texto of ['-1', '2.5']) {
      await usuario.clear(campoStock('Burger Sin TACC'));
      await usuario.type(campoStock('Burger Sin TACC'), texto);
      await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Burger Sin TACC' }));
      expect(await within(screen.getByRole('group', { name: 'Burger Sin TACC' })).findByText('Ingresá un número entero desde 0.')).toBeInTheDocument();
      expect(campoStock('Burger Sin TACC')).toHaveAttribute('aria-invalid', 'true');
    }
    await usuario.clear(campoStock('Burger Sin TACC'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Burger Sin TACC' }));

    expect(within(screen.getByRole('group', { name: 'Burger Sin TACC' })).getByText('Ingresá un número entero desde 0.')).toBeInTheDocument();
    expect(escriturasProductos(estado)).toEqual([]);
  });

  it('guardar 0 es válido y deja el producto en «Agotado»', async () => {
    const { usuario } = await abrirComoStock();

    await usuario.clear(campoStock('Coca-Cola 500ml'));
    await usuario.type(campoStock('Coca-Cola 500ml'), '0');
    await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Coca-Cola 500ml' }));

    expect(await within(screen.getByRole('group', { name: 'Coca-Cola 500ml' })).findByText('Agotado')).toBeInTheDocument();
  });

  it('si el servidor responde 404 la fila muestra el error y conserva el valor escrito', async () => {
    const { usuario } = await abrirComoStock();
    server.use(http.patch(`${API}/productos/:id/stock`, () => HttpResponse.json({ detail: 'Producto no encontrado', code: 'HTTP_404', field: null }, { status: 404 })));

    await usuario.clear(campoStock('Burger Vegana'));
    await usuario.type(campoStock('Burger Vegana'), '7');
    await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Burger Vegana' }));

    expect(await within(screen.getByRole('group', { name: 'Burger Vegana' })).findByText('Producto no encontrado')).toBeInTheDocument();
    expect(campoStock('Burger Vegana')).toHaveValue(7);
    expect(screen.queryByText('Stock actualizado')).not.toBeInTheDocument();
  });
});

describe('disponibilidad desde la lista', () => {
  it('apagar «Coca-Cola 500ml» envía {"disponible":false}, queda apagado, no cambia el stock y avisa', async () => {
    const { estado, usuario } = await abrirComoStock();

    await usuario.click(screen.getByRole('switch', { name: 'Disponible: Coca-Cola 500ml' }));

    expect(await screen.findByText('Coca-Cola 500ml ya no se ofrece en el catálogo')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'PATCH', '/productos/5/disponibilidad')[0]?.cuerpo).toEqual({ disponible: false });
    expect(screen.getByRole('switch', { name: 'Disponible: Coca-Cola 500ml' })).not.toBeChecked();
    expect(campoStock('Coca-Cola 500ml')).toHaveValue(100);
    expect(pedidosProductos(estado, 'PATCH', '/productos/5/stock')).toEqual([]);
  });

  it('prender «Limonada Natural» envía {"disponible":true} y avisa que vuelve a ofrecerse, sin cambiar su stock en 0', async () => {
    const { estado, usuario } = await abrirComoStock();

    await usuario.click(screen.getByRole('switch', { name: 'Disponible: Limonada Natural' }));

    expect(await screen.findByText('Limonada Natural vuelve a ofrecerse en el catálogo')).toBeInTheDocument();
    expect(pedidosProductos(estado, 'PATCH', '/productos/6/disponibilidad')[0]?.cuerpo).toEqual({ disponible: true });
    expect(campoStock('Limonada Natural')).toHaveValue(0);
  });

  it('mientras espera la respuesta queda deshabilitado con «Guardando…» y muestra el valor del servidor, no el pedido', async () => {
    const estado = crearEstadoAdminProductos();
    estado.demoras.PATCH = 150;
    const { usuario } = await abrirComoStock(estado);
    const fila = screen.getByRole('group', { name: 'Coca-Cola 500ml' });

    await usuario.click(within(fila).getByRole('switch'));

    expect(within(fila).getByRole('switch')).toBeDisabled();
    expect(within(fila).getByRole('switch')).toBeChecked();
    expect(within(fila).getByText('Guardando…')).toBeInTheDocument();
    await waitFor(() => expect(within(fila).getByRole('switch')).not.toBeChecked());
    expect(within(fila).getByRole('switch')).toBeEnabled();
  });

  it('con la red caída vuelve al valor anterior y avisa el error', async () => {
    const { usuario } = await abrirComoStock();
    server.use(http.patch(`${API}/productos/:id/disponibilidad`, () => HttpResponse.error()));

    await usuario.click(screen.getByRole('switch', { name: 'Disponible: Coca-Cola 500ml' }));

    expect(await screen.findByText('No pudimos cambiar la disponibilidad')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Disponible: Coca-Cola 500ml' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Disponible: Coca-Cola 500ml' })).toBeEnabled();
  });

  it('no tiene violaciones de accesibilidad con un error en la fila', async () => {
    const { usuario } = await abrirComoStock();
    await usuario.clear(campoStock('Burger Vegana'));
    await usuario.type(campoStock('Burger Vegana'), '-1');
    await usuario.click(screen.getByRole('button', { name: 'Guardar stock de Burger Vegana' }));
    await screen.findByText('Ingresá un número entero desde 0.');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
