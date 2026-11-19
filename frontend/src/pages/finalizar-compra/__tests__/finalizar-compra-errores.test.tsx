import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import type { RespuestaCrearPedido } from '@/test/msw/pedidos';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { esperarCheckout, montarCheckout } from '@/test/render-checkout';

const confirmar = () => screen.getByRole('button', { name: 'Confirmar pedido' });
const alerta = () => screen.findByRole('alert', {}, { timeout: 3000 });

/** Monta el checkout, elige efectivo y confirma contra una respuesta de error ya configurada. */
async function confirmarConRespuesta(respuestaCrear: RespuestaCrearPedido, formaPago: RegExp = /Efectivo/) {
  const app = montarCheckout({ pedidos: { respuestaCrear } });
  await esperarCheckout();
  await app.usuario.click(screen.getByRole('radio', { name: formaPago }));
  await app.usuario.click(confirmar());
  return { ...app, aviso: await alerta() };
}

describe('checkout: errores de creación que piden revisar el carrito', () => {
  it('400 «No hay stock suficiente»: aviso con el mensaje, foco en la alerta, «Revisar carrito», carrito intacto y botón habilitado', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente' });

    expect(within(aviso).getByText('No pudimos crear el pedido')).toBeInTheDocument();
    expect(within(aviso).getByText('No hay stock suficiente')).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'Revisar carrito' })).toHaveAttribute('href', '/carrito');
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(useCartStore.getState().lineas).toHaveLength(2);
    expect(confirmar()).toBeEnabled();
  });

  it.each([
    [400, 'Producto no disponible'],
    [404, 'Producto no encontrado'],
    [400, 'No puede pedir dos veces el mismo producto con la misma personalización'],
  ])('%i «%s» ofrece «Revisar carrito»', async (status, detail) => {
    const { aviso } = await confirmarConRespuesta({ status, detail });

    expect(within(aviso).getByText(detail)).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'Revisar carrito' })).toBeInTheDocument();
    expect(within(aviso).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });

  it('«Revisar carrito» lleva a /carrito con las líneas intactas', async () => {
    const { aviso, usuario, router } = await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente' });

    await usuario.click(within(aviso).getByRole('link', { name: 'Revisar carrito' }));

    expect(router.state.location.pathname).toBe('/carrito');
    expect(await screen.findByRole('list', { name: 'Productos del carrito' })).toBeInTheDocument();
  });
});

describe('checkout: errores de forma de pago', () => {
  it('«Forma de pago no está habilitada»: invita a elegir otra, la elegida sigue marcada y el botón lleva el foco al grupo', async () => {
    const { aviso, usuario } = await confirmarConRespuesta({ status: 400, detail: 'Forma de pago no está habilitada' }, /Transferencia bancaria/);

    expect(within(aviso).getByText('Forma de pago no está habilitada')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Transferencia bancaria/ })).toBeChecked();

    await usuario.click(within(aviso).getByRole('button', { name: 'Elegí otra forma de pago' }));

    expect(screen.getByRole('group', { name: '¿Cómo pagás?' })).toHaveFocus();
  });

  it('cambiar la forma de pago oculta la alerta', async () => {
    const { usuario } = await confirmarConRespuesta({ status: 400, detail: 'Forma de pago no está habilitada' });

    await usuario.click(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });
});

describe('checkout: errores de conexión y permisos', () => {
  it('sin red: «No pudimos conectar con el servidor.» y «Reintentar» reenvía el mismo cuerpo y, con 201, navega', async () => {
    const { aviso, usuario, estadoPedidos, router } = await confirmarConRespuesta('red');
    expect(within(aviso).getByText('No pudimos conectar con el servidor.')).toBeInTheDocument();

    estadoPedidos.respuestaCrear = 'ok';
    await usuario.click(within(aviso).getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/finalizar-compra/pedido/57'));
    expect(estadoPedidos.creaciones).toHaveLength(2);
    expect(estadoPedidos.creaciones[1]).toEqual(estadoPedidos.creaciones[0]);
    expect(useCartStore.getState().lineas).toEqual([]);
  });

  it('un 500 ofrece «Reintentar» y conserva el carrito', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' });

    expect(within(aviso).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });

  it('un 403 informa que solo las cuentas de cliente pueden hacer pedidos, sin acciones de reintento', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 403, detail: 'Permisos insuficientes' });

    expect(within(aviso).getByText(/Solo las cuentas de cliente pueden hacer pedidos/)).toBeInTheDocument();
    expect(within(aviso).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('un 400 desconocido muestra el mensaje del servidor con «Revisar carrito» y «Elegí otra forma de pago»', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 400, detail: 'Algo nuevo del backend' });

    expect(within(aviso).getByText('Algo nuevo del backend')).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'Revisar carrito' })).toBeInTheDocument();
    expect(within(aviso).getByRole('button', { name: 'Elegí otra forma de pago' })).toBeInTheDocument();
  });
});

describe('checkout: accesibilidad del aviso de error', () => {
  it('el checkout con la alerta de stock no tiene violaciones', async () => {
    await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
