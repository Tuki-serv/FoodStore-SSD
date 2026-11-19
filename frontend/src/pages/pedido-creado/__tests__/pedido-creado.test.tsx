import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { detalleDto, pedidoDto } from '@/test/msw/pedidos';
import { esperarCheckout, montarCheckout } from '@/test/render-checkout';

const itemsPrueba = (pedidoId: number) => [
  detalleDto({
    pedido_id: pedidoId,
    producto_id: 1,
    cantidad: 2,
    nombre_snapshot: 'Hamburguesa Clásica',
    precio_snapshot: '1500.00',
    subtotal_snapshot: '3000.00',
    personalizacion: [1, 3],
    personalizacion_snapshot: ['Cebolla', 'Tomate'],
  }),
  detalleDto({ pedido_id: pedidoId, producto_id: 5, cantidad: 1, nombre_snapshot: 'Coca-Cola 500ml', precio_snapshot: '800.00', subtotal_snapshot: '800.00' }),
];

/** Abre directamente la confirmación de un pedido que el servidor ya tiene (carrito vacío, sin estado de navegación). */
function abrirPedido(parcial: Parameters<typeof pedidoDto>[0], ruta?: string) {
  const app = montarCheckout({ lineas: [], ruta: ruta ?? `/finalizar-compra/pedido/${parcial.id}` });
  app.estadoPedidos.pedidos.set(parcial.id, pedidoDto({ items: itemsPrueba(parcial.id), ...parcial }));
  return app;
}

const titulo = (id: number) => screen.findByRole('heading', { name: `Pedido #${id} recibido`, level: 1 });
const principal = () => within(screen.getByRole('main'));

describe('confirmación tras crear el pedido (efectivo)', () => {
  it('muestra el pedido 57 recibido, pendiente, con entrega, forma de pago, total y los pasos de confirmación manual', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    await titulo(57);

    expect(principal().getByText('Pendiente')).toBeInTheDocument();
    expect(principal().getByText('Casa')).toBeInTheDocument();
    expect(principal().getByText('Efectivo')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Pedido #57' })).getByText('Total').nextSibling).toHaveTextContent('$ 3.850');
    expect(principal().getByRole('heading', { name: '¿Qué sigue?' })).toBeInTheDocument();
    expect(principal().getByText('El local confirma tu pago en efectivo')).toBeInTheDocument();
    expect(principal().queryByText(/Pagar/)).not.toBeInTheDocument();
    expect(principal().queryByRole('link', { name: /Pagar/ })).not.toBeInTheDocument();
    expect(estadoPedidos.consultas).toEqual([]);
  });

  it('sin cambios de precio no avisa «Los precios se actualizaron»', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await titulo(57);

    expect(screen.queryByText('Los precios se actualizaron')).not.toBeInTheDocument();
  });

  it('con un total del servidor distinto del estimado avisa que los precios se actualizaron', async () => {
    const { usuario } = montarCheckout({ pedidos: { pedidoCreado: { total: '4050.00', subtotal: '4000.00' } } });
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await titulo(57);

    expect(screen.getByText('Los precios se actualizaron')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Pedido #57' })).getByText('Total').nextSibling).toHaveTextContent('$ 4.050');
  });
});

describe('confirmación al abrir la URL (recarga)', () => {
  it('pide GET /pedidos/57 y muestra el mismo contenido, sin aviso de precios', async () => {
    const { estadoPedidos } = abrirPedido({ id: 57, forma_pago_codigo: 'EFECTIVO' });

    await titulo(57);

    expect(estadoPedidos.consultas).toEqual([57]);
    expect(principal().getByText('Pendiente')).toBeInTheDocument();
    expect(await principal().findByText('Casa')).toBeInTheDocument();
    expect(screen.queryByText('Los precios se actualizaron')).not.toBeInTheDocument();
  });

  it('lista los ítems con sus snapshots y la personalización', async () => {
    abrirPedido({ id: 57 });
    await titulo(57);

    const lista = within(screen.getByRole('list', { name: 'Productos del pedido' }));
    const [hamburguesa, coca] = lista.getAllByRole('listitem');
    expect(hamburguesa).toHaveTextContent('2 ×');
    expect(hamburguesa).toHaveTextContent('Hamburguesa Clásica');
    expect(hamburguesa).toHaveTextContent('Sin cebolla, sin tomate');
    expect(hamburguesa).toHaveTextContent('$ 3.000');
    expect(coca).toHaveTextContent('Coca-Cola 500ml');
    expect(coca).toHaveTextContent('$ 800');
  });

  it('muestra subtotal, costo de envío y descuento del servidor', async () => {
    abrirPedido({ id: 57 });
    await titulo(57);

    const totales = within(screen.getByRole('complementary', { name: 'Pedido #57' }));
    expect(totales.getByText('Subtotal').nextSibling).toHaveTextContent('$ 3.800');
    expect(totales.getByText('Costo de envío').nextSibling).toHaveTextContent('$ 50');
    expect(totales.getByText('Descuento').nextSibling).toHaveTextContent('$ 0');
  });

  it('un pedido con direccion_id null muestra «Retiro en el local»', async () => {
    abrirPedido({ id: 57, direccion_id: null });
    await titulo(57);

    expect(principal().getByText('Retiro en el local')).toBeInTheDocument();
    expect(principal().queryByText('Casa')).not.toBeInTheDocument();
  });

  it('un pedido con otra dirección muestra su alias y su calle', async () => {
    abrirPedido({ id: 57, direccion_id: 6 });
    await titulo(57);

    expect(await principal().findByText('Trabajo')).toBeInTheDocument();
    expect(principal().getByText('Belgrano 455')).toBeInTheDocument();
  });

  it('advierte que, si un producto se agota antes de la confirmación, el pedido puede cancelarse (DD-20)', async () => {
    abrirPedido({ id: 57 });
    await titulo(57);

    expect(principal().getByText('Si algún producto se agota antes de que se confirme, el pedido puede cancelarse por falta de stock.')).toBeInTheDocument();
  });

  it('ofrece «Ver mis pedidos» y «Seguir comprando»', async () => {
    abrirPedido({ id: 57 });
    await titulo(57);

    expect(principal().getByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute('href', '/mis-pedidos');
    expect(principal().getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalogo');
  });

  it('un pedido que no existe muestra «No encontramos este pedido» con «Ver catálogo»', async () => {
    montarCheckout({ lineas: [], ruta: '/finalizar-compra/pedido/999' });

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido' })).toBeInTheDocument();
    expect(principal().getByRole('link', { name: 'Ver catálogo' })).toHaveAttribute('href', '/catalogo');
  });
});

describe('confirmación: transferencia', () => {
  it('explica que el local indica los datos para transferir y no ofrece pagar', async () => {
    abrirPedido({ id: 57, forma_pago_codigo: 'TRANSFERENCIA' });
    await titulo(57);

    expect(principal().getByText('Transferencia bancaria')).toBeInTheDocument();
    expect(principal().getByText(/El local te indica los datos para transferir/)).toBeInTheDocument();
    expect(principal().queryByText(/Pagar/)).not.toBeInTheDocument();
  });
});

describe('confirmación: Mercado Pago (traspaso al pago)', () => {
  it('muestra «Falta el pago» y «Pagar $ 2.850 con tarjeta», que lleva a la ruta de pago del pedido', async () => {
    const { usuario, router } = abrirPedido({ id: 58, forma_pago_codigo: 'MERCADOPAGO', subtotal: '2800.00', total: '2850.00' });
    await titulo(58);

    expect(principal().getByRole('heading', { name: 'Falta el pago' })).toBeInTheDocument();
    expect(principal().queryByText('¿Qué sigue?')).not.toBeInTheDocument();

    await usuario.click(principal().getByRole('link', { name: 'Pagar $ 2.850 con tarjeta' }));

    expect(router.state.location.pathname).toBe('/finalizar-compra/pedido/58/pago');
    expect(await screen.findByRole('heading', { name: 'Pago', level: 1 })).toBeInTheDocument();
  });

  it('un pedido de Mercado Pago que ya no está PENDIENTE muestra el estado sin la acción de pagar', async () => {
    abrirPedido({ id: 58, forma_pago_codigo: 'MERCADOPAGO', estado_codigo: 'CANCELADO' });
    await titulo(58);

    expect(principal().getByText('Cancelado')).toBeInTheDocument();
    expect(principal().queryByRole('link', { name: /Pagar/ })).not.toBeInTheDocument();
    expect(principal().queryByRole('heading', { name: 'Falta el pago' })).not.toBeInTheDocument();
  });

  it('el pedido creado con tarjeta desde el checkout ofrece pagar con el total del servidor', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    await titulo(57);

    await waitFor(() => expect(principal().getByRole('link', { name: 'Pagar $ 3.850 con tarjeta' })).toHaveAttribute('href', '/finalizar-compra/pedido/57/pago'));
  });
});

describe('confirmación: accesibilidad', () => {
  it('la confirmación de efectivo no tiene violaciones', async () => {
    abrirPedido({ id: 57, forma_pago_codigo: 'EFECTIVO' });
    await titulo(57);
    await screen.findByText('Casa');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });

  it('la confirmación de Mercado Pago no tiene violaciones', async () => {
    abrirPedido({ id: 58, forma_pago_codigo: 'MERCADOPAGO' });
    await titulo(58);
    await screen.findByText('Casa');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
