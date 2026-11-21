import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { pedidosDe } from '@/test/msw/direcciones';
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
    const { aviso } = await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente', code: 'INSUFFICIENT_STOCK' });

    expect(within(aviso).getByText('No pudimos crear el pedido')).toBeInTheDocument();
    expect(within(aviso).getByText('No hay stock suficiente')).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'Revisar carrito' })).toHaveAttribute('href', '/carrito');
    await waitFor(() => expect(aviso).toHaveFocus());
    expect(useCartStore.getState().lineas).toHaveLength(2);
    expect(confirmar()).toBeEnabled();
  });

  it.each([
    [400, 'Producto no disponible', 'PRODUCT_UNAVAILABLE'],
    [404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND'],
    [400, 'No puede pedir dos veces el mismo producto con la misma personalización', 'DUPLICATE_ITEM'],
    [400, 'La personalización solo puede quitar ingredientes removibles del producto', 'INVALID_CUSTOMIZATION'],
  ])('%i «%s» (%s) ofrece «Revisar carrito»', async (status, detail, code) => {
    const { aviso } = await confirmarConRespuesta({ status, detail, code });

    expect(within(aviso).getByText(detail)).toBeInTheDocument();
    expect(within(aviso).getByRole('link', { name: 'Revisar carrito' })).toBeInTheDocument();
    expect(within(aviso).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });

  it('«Revisar carrito» lleva a /carrito con las líneas intactas', async () => {
    const { aviso, usuario, router } = await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente', code: 'INSUFFICIENT_STOCK' });

    await usuario.click(within(aviso).getByRole('link', { name: 'Revisar carrito' }));

    expect(router.state.location.pathname).toBe('/carrito');
    expect(await screen.findByRole('list', { name: 'Productos del carrito' })).toBeInTheDocument();
  });
});

describe('checkout: errores de forma de pago', () => {
  it('«Forma de pago no está habilitada»: invita a elegir otra, la elegida sigue marcada y el botón lleva el foco al grupo', async () => {
    const { aviso, usuario } = await confirmarConRespuesta({ status: 400, detail: 'Forma de pago no está habilitada', code: 'PAYMENT_METHOD_UNAVAILABLE' }, /Transferencia bancaria/);

    expect(within(aviso).getByText('Forma de pago no está habilitada')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Transferencia bancaria/ })).toBeChecked();

    await usuario.click(within(aviso).getByRole('button', { name: 'Elegí otra forma de pago' }));

    expect(screen.getByRole('group', { name: '¿Cómo pagás?' })).toHaveFocus();
  });

  it('cambiar la forma de pago oculta la alerta', async () => {
    const { usuario } = await confirmarConRespuesta({ status: 400, detail: 'Forma de pago no está habilitada', code: 'PAYMENT_METHOD_UNAVAILABLE' });

    await usuario.click(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });
});

describe('checkout: dirección que ya no está disponible', () => {
  it('ADDRESS_NOT_FOUND vuelve a pedir las direcciones, ofrece elegir otra entrega y no ofrece revisar el carrito', async () => {
    const { aviso, usuario, estadoDirecciones } = await confirmarConRespuesta({
      status: 404,
      detail: 'Dirección no encontrada',
      code: 'ADDRESS_NOT_FOUND',
      field: 'direccion_id',
    });

    expect(within(aviso).getByText('Dirección no encontrada')).toBeInTheDocument();
    expect(within(aviso).queryByRole('link', { name: 'Revisar carrito' })).not.toBeInTheDocument();
    await waitFor(() => expect(pedidosDe(estadoDirecciones, 'GET', '/').length).toBeGreaterThanOrEqual(2));

    await usuario.click(within(aviso).getByRole('button', { name: 'Elegí otra entrega' }));

    expect(screen.getByRole('region', { name: 'Entrega' })).toHaveFocus();
    expect(useCartStore.getState().lineas).toHaveLength(2);
  });
});

describe('checkout: la dirección rechazada no se reemplaza en silencio (verify C-25b1)', () => {
  /** El cliente elige «Trabajo» y, antes de confirmar, esa dirección deja de ser suya: el refetch ya no la trae. */
  async function rechazarTrabajo() {
    const app = montarCheckout({
      pedidos: { respuestaCrear: { status: 404, detail: 'Dirección no encontrada', code: 'ADDRESS_NOT_FOUND', field: 'direccion_id' } },
    });
    await esperarCheckout();
    await app.usuario.click(screen.getByRole('radio', { name: /Trabajo/ }));
    await app.usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    app.estadoDirecciones.direcciones = app.estadoDirecciones.direcciones.filter((direccion) => direccion.alias !== 'Trabajo');
    await app.usuario.click(confirmar());
    const aviso = await alerta();
    await waitFor(() => expect(pedidosDe(app.estadoDirecciones, 'GET', '/').length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(screen.queryByRole('radio', { name: /Trabajo/ })).not.toBeInTheDocument());
    return { ...app, aviso };
  }

  it('con la entrega preseleccionada (sin tocarla) que desaparece, la que queda no se elige sola y confirmar no crea el pedido', async () => {
    const app = montarCheckout({
      pedidos: { respuestaCrear: { status: 404, detail: 'Dirección no encontrada', code: 'ADDRESS_NOT_FOUND', field: 'direccion_id' } },
    });
    await esperarCheckout();
    await waitFor(() => expect(screen.getByRole('radio', { name: /Casa/ })).toBeChecked());
    // Como en el navegador: el rechazo llega fuera de `act`, sin el lote de actualizaciones que arma Testing Library.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    await app.usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    app.estadoDirecciones.direcciones = app.estadoDirecciones.direcciones.filter((direccion) => direccion.alias !== 'Casa');
    await app.usuario.click(confirmar());
    await alerta();
    await waitFor(() => expect(screen.queryByRole('radio', { name: /Casa/ })).not.toBeInTheDocument());
    await new Promise((resolver) => setTimeout(resolver, 300));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    expect(screen.getByRole('radio', { name: /Trabajo/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).not.toBeChecked();
    app.estadoPedidos.respuestaCrear = 'ok';
    await app.usuario.click(confirmar());
    expect(await screen.findByText('Elegí dónde lo recibís.')).toBeInTheDocument();
    expect(app.estadoPedidos.creaciones).toHaveLength(1);
  });

  it('tras el refetch el aviso sigue visible y ninguna entrega queda elegida (no se salta a la principal)', async () => {
    await rechazarTrabajo();

    expect(screen.getByText('Dirección no encontrada')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Casa/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).not.toBeChecked();
  });

  it('sin elegir otra entrega no se vuelve a enviar: el paso pide elegir dónde lo recibís', async () => {
    const { usuario, estadoPedidos } = await rechazarTrabajo();

    await usuario.click(confirmar());

    expect(await screen.findByText('Elegí dónde lo recibís.')).toBeInTheDocument();
    expect(estadoPedidos.creaciones).toHaveLength(1);
  });

  it('cambiar la forma de pago oculta el aviso pero la entrega sigue sin elegir y confirmar no crea el pedido', async () => {
    const { usuario, estadoPedidos } = await rechazarTrabajo();

    await usuario.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }));
    await new Promise((resolver) => setTimeout(resolver, 300));

    expect(screen.getByRole('radio', { name: /Casa/ })).not.toBeChecked();
    estadoPedidos.respuestaCrear = 'ok';
    await usuario.click(confirmar());
    expect(await screen.findByText('Elegí dónde lo recibís.')).toBeInTheDocument();
    expect(estadoPedidos.creaciones).toHaveLength(1);
  });

  it('elegir una entrega a propósito sí oculta el aviso y permite confirmar de nuevo', async () => {
    const { usuario, estadoPedidos } = await rechazarTrabajo();

    await usuario.click(screen.getByRole('radio', { name: /Casa/ }));

    expect(screen.queryByText('Dirección no encontrada')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Casa/ })).toBeChecked();
    estadoPedidos.respuestaCrear = 'ok';
    await usuario.click(confirmar());
    await waitFor(() => expect(estadoPedidos.creaciones).toHaveLength(2));
    expect(estadoPedidos.creaciones[1]).toMatchObject({ direccion_id: 4 });
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

  it('un código desconocido muestra el mensaje del servidor sin acción específica', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 400, detail: 'Algo nuevo del backend', code: 'CODIGO_NUEVO' });

    expect(within(aviso).getByText('Algo nuevo del backend')).toBeInTheDocument();
    expect(within(aviso).queryByRole('link', { name: 'Revisar carrito' })).not.toBeInTheDocument();
    expect(within(aviso).queryByRole('button')).not.toBeInTheDocument();
  });

  it('mismo texto, otro código: «No hay stock suficiente» con PAYMENT_METHOD_UNAVAILABLE invita a elegir otra forma de pago, no a revisar el carrito', async () => {
    const { aviso } = await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente', code: 'PAYMENT_METHOD_UNAVAILABLE' });

    expect(within(aviso).getByRole('button', { name: 'Elegí otra forma de pago' })).toBeInTheDocument();
    expect(within(aviso).queryByRole('link', { name: 'Revisar carrito' })).not.toBeInTheDocument();
  });
});

describe('checkout: accesibilidad del aviso de error', () => {
  it('el checkout con la alerta de stock no tiene violaciones', async () => {
    await confirmarConRespuesta({ status: 400, detail: 'No hay stock suficiente', code: 'INSUFFICIENT_STOCK' });

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
