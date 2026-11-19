import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reiniciarEspia } from '@/test/mp-sdk-doble';
import { pedidoAPagar, montarPago } from '@/test/render-pago';
import { usePaymentStore } from '@/entities/payment';

vi.mock('@mercadopago/sdk-react', () => import('@/test/mp-sdk-doble'));

const RUTA = '/finalizar-compra/pedido/58/pago';

async function esperarFormulario() {
  await screen.findByRole('heading', { name: 'Pagar pedido #58', level: 1 });
  return screen.findByRole('button', { name: 'Simular pago' });
}

beforeEach(() => {
  reiniciarEspia();
  usePaymentStore.getState().reset();
});

describe('Página de pago · acceso y carga', () => {
  it('un CLIENT con el pedido 58 por pagar ve el título, el total y el formulario de tarjeta', async () => {
    const { estadoPedidos, estadoPagos } = montarPago();

    expect(await esperarFormulario()).toBeInTheDocument();

    expect(screen.getByText(/Total a pagar:/)).toHaveTextContent('Total a pagar: $ 2.850.');
    expect(screen.getByRole('complementary', { name: 'Pedido #58' })).toBeInTheDocument();
    expect(estadoPedidos.consultas).toEqual([58]);
    expect(estadoPagos.consultas).toEqual([58]);
  });

  it('con un identificador inválido muestra «No encontramos este pedido» sin pedir nada al backend', async () => {
    const { estadoPedidos, estadoPagos } = montarPago({ ruta: '/finalizar-compra/pedido/abc/pago' });

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute('href', '/mis-pedidos');
    expect(estadoPedidos.consultas).toEqual([]);
    expect(estadoPagos.configuraciones).toBe(0);
  });

  it('un pedido que el backend responde 404 muestra «No encontramos este pedido» y no el formulario', async () => {
    const { estadoPagos } = montarPago({ ruta: '/finalizar-compra/pedido/999/pago' });

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(estadoPagos.configuraciones).toBe(0);
  });

  it('sin sesión lleva a /ingresar recordando la ruta de pago', async () => {
    const { router } = montarPago({ sesion: null });

    expect(await screen.findByRole('heading', { name: 'Ingresar', level: 1 })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(router.state.location.state).toEqual({ desde: { pathname: RUTA, search: '', hash: '' } });
  });

  it('un usuario solo ADMIN ve «Sin permiso» y no se pide el pedido', async () => {
    const { estadoPedidos } = montarPago({ sesion: { roles: ['ADMIN'] } });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección', level: 1 })).toBeInTheDocument();
    expect(estadoPedidos.consultas).toEqual([]);
  });

  it('mientras carga el pedido muestra un indicador de carga', async () => {
    montarPago();

    expect(await screen.findByRole('status', { name: 'Cargando el pedido' })).toBeInTheDocument();
    await esperarFormulario();
  });

  it('tiene un único h1 en el formulario', async () => {
    montarPago();
    await esperarFormulario();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('Página de pago · no corresponde pagar', () => {
  it('un pedido EFECTIVO muestra «Este pedido no se paga con tarjeta» sin brick ni consulta de configuración', async () => {
    const { estadoPagos } = montarPago({
      pedidos: [pedidoAPagar({ id: 60, forma_pago_codigo: 'EFECTIVO' })],
      ruta: '/finalizar-compra/pedido/60/pago',
    });

    expect(await screen.findByRole('heading', { name: 'Este pedido no se paga con tarjeta', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/finalizar-compra/pedido/60');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(estadoPagos.configuraciones).toBe(0);
  });

  it('un pedido MERCADOPAGO CANCELADO sin pago muestra «Este pedido ya no se puede pagar»', async () => {
    const { estadoPagos } = montarPago({
      pedidos: [pedidoAPagar({ id: 61, estado_codigo: 'CANCELADO' })],
      ruta: '/finalizar-compra/pedido/61/pago',
    });

    expect(await screen.findByRole('heading', { name: 'Este pedido ya no se puede pagar', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(estadoPagos.configuraciones).toBe(0);
  });

  it('un pedido CONFIRMADO sin pago en la sesión también ya no se puede pagar', async () => {
    montarPago({ pedidos: [pedidoAPagar({ estado_codigo: 'CONFIRMADO' })] });

    expect(await screen.findByRole('heading', { name: 'Este pedido ya no se puede pagar', level: 1 })).toBeInTheDocument();
  });
});

describe('Página de pago · resultados inmediatos', () => {
  it('aprobado: muestra «¡Pago aprobado!», el número de operación y los enlaces, sin redirigir ni volver a pedir GET /pagos/58', async () => {
    const { estadoPagos, estadoPedidos, usuario, router, queryClient } = montarPago();
    queryClient.setQueryData(['pedidos', 'lista'], { items: [] });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/finalizar-compra/pedido/58');
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalogo');
    expect(screen.getByText('PAY01JX7')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(RUTA);
    expect(estadoPagos.consultas).toEqual([58]);
    await waitFor(() => expect(estadoPedidos.consultas).toEqual([58, 58]));
    expect(queryClient.getQueryState(['pedidos', 'lista'])?.isInvalidated).toBe(true);
  });

  it('aprobado: el resumen muestra el pedido confirmado cuando el servidor lo confirma', async () => {
    const { estadoPedidos, usuario } = montarPago();
    const boton = await esperarFormulario();
    estadoPedidos.pedidos.set(58, pedidoAPagar({ estado_codigo: 'CONFIRMADO' }));
    await usuario.click(boton);

    await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 });

    expect(await screen.findByText('Confirmado')).toBeInTheDocument();
  });

  it('rechazado por fondos: muestra el motivo, «Intentar de nuevo» y un nuevo envío usa el mismo pedido', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { resultados: [{ estado: 'rechazado', mp_status_detail: 'insufficient_amount' }, { estado: 'aprobado' }] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('La tarjeta no tiene fondos suficientes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58]);

    await usuario.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    await usuario.click(await screen.findByRole('button', { name: 'Simular pago' }));

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(estadoPagos.creaciones.map((cuerpo) => cuerpo.pedido_id)).toEqual([58, 58]);
  });

  it('rechazado con detalle desconocido muestra el motivo genérico', async () => {
    const { usuario } = montarPago({ pagos: { resultados: [{ estado: 'rechazado', mp_status_detail: 'algo_nuevo' }] } });
    await usuario.click(await esperarFormulario());

    await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 });

    expect(screen.getByText('Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.')).toBeInTheDocument();
  });

  it('un 400 de crear muestra «El pago fue rechazado» con el motivo genérico y permite reintentar', async () => {
    const { usuario } = montarPago({ pagos: { resultados: [{ status: 400, detail: 'MercadoPago rechazó los datos del pago' }] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago no aprobó el pago. Probá con otra tarjeta o medio.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeInTheDocument();
  });

  it('pendiente: vista de seguimiento con «Ver mi pedido», sin formulario ni reintento', async () => {
    const { usuario, estadoPagos } = montarPago({ pagos: { resultados: [{ estado: 'pendiente' }] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('heading', { name: 'Estamos esperando la confirmación de Mercado Pago', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/Esta pantalla se actualiza sola cada 5 segundos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/finalizar-compra/pedido/58');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).not.toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58]);
  });

  it('a_devolver: explica la devolución manual, sin formulario ni reintento', async () => {
    const { usuario, estadoPedidos } = montarPago({ pagos: { resultados: [{ estado: 'a_devolver' }] } });
    const boton = await esperarFormulario();
    estadoPedidos.pedidos.set(58, pedidoAPagar({ estado_codigo: 'CANCELADO' }));
    await usuario.click(boton);

    expect(await screen.findByRole('heading', { name: 'Tu pago se aprobó, pero no pudimos confirmar el pedido', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/La devolución la gestiona el equipo del local de forma manual/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/catalogo');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Intentar de nuevo' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Cancelado')).toBeInTheDocument());
  });
});

describe('Página de pago · errores al pagar', () => {
  it('409 con el pago ya aprobado: vuelve a pedir pedido y pago y muestra «¡Pago aprobado!»', async () => {
    const { estadoPagos, estadoPedidos, usuario } = montarPago({
      pagos: { resultados: [{ status: 409, detail: 'El pedido ya tiene un pago aprobado o en proceso' }], estadoConsultado: { estado: null } },
    });
    const boton = await esperarFormulario();
    estadoPagos.estadoConsultado = { estado: 'aprobado', pago_id: 31 };
    estadoPedidos.pedidos.set(58, pedidoAPagar({ estado_codigo: 'CONFIRMADO' }));
    await usuario.click(boton);

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(estadoPagos.consultas).toEqual([58, 58]);
    await waitFor(() => expect(estadoPedidos.consultas).toEqual([58, 58]));
  });

  it('409 con el pago pendiente: muestra la vista pendiente', async () => {
    const { estadoPagos, usuario } = montarPago({
      pagos: { resultados: [{ status: 409, detail: 'El pedido ya tiene un pago aprobado o en proceso' }], estadoConsultado: { estado: null } },
    });
    const boton = await esperarFormulario();
    estadoPagos.estadoConsultado = { estado: 'pendiente' };
    await usuario.click(boton);

    expect(await screen.findByRole('heading', { name: 'Estamos esperando la confirmación de Mercado Pago', level: 1 })).toBeInTheDocument();
  });

  it('502: avisa que no se pudo confirmar el resultado y «Reintentar» vuelve a mostrar el formulario', async () => {
    const { estadoPagos, usuario } = montarPago({ pagos: { resultados: [{ status: 502, detail: 'MercadoPago no respondió' }, { estado: 'aprobado' }] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar el resultado con Mercado Pago');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    await usuario.click(await screen.findByRole('button', { name: 'Simular pago' }));

    expect(await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 })).toBeInTheDocument();
    expect(estadoPagos.creaciones).toHaveLength(2);
  });

  it('503: avisa que el pago con tarjeta no está disponible y ofrece ver el pedido', async () => {
    const { usuario } = montarPago({ pagos: { resultados: [{ status: 503, detail: 'MercadoPago no configurado' }] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago con tarjeta no está disponible en este momento');
    expect(screen.getByRole('link', { name: 'Ver mi pedido' })).toHaveAttribute('href', '/finalizar-compra/pedido/58');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
  });

  it('sin respuesta del servidor: avisa que no pudimos conectarnos y permite reintentar', async () => {
    const { usuario } = montarPago({ pagos: { resultados: ['red'] } });
    await usuario.click(await esperarFormulario());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('con GET /pagos/config en 503 muestra «no está disponible» sin brick', async () => {
    montarPago({ pagos: { clavePublica: null } });

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago con tarjeta no está disponible en este momento');
    expect(screen.queryByRole('button', { name: 'Simular pago' })).not.toBeInTheDocument();
  });
});

describe('Página de pago · accesibilidad', () => {
  it('al pasar de procesando a rechazado el título «El pago fue rechazado» recibe el foco', async () => {
    const { usuario } = montarPago({ pagos: { resultados: [{ estado: 'rechazado', mp_status_detail: 'insufficient_amount' }] } });
    await usuario.click(await esperarFormulario());

    const titulo = await screen.findByRole('heading', { name: 'El pago fue rechazado', level: 1 });

    await waitFor(() => expect(titulo).toHaveFocus());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('al aprobarse el título «¡Pago aprobado!» recibe el foco y sigue habiendo un solo h1', async () => {
    const { usuario } = montarPago();
    await usuario.click(await esperarFormulario());

    const titulo = await screen.findByRole('heading', { name: '¡Pago aprobado!', level: 1 });

    await waitFor(() => expect(titulo).toHaveFocus());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('no mueve el foco al cargar la página por primera vez', async () => {
    montarPago();
    const titulo = await screen.findByRole('heading', { name: 'Pagar pedido #58', level: 1 });
    await esperarFormulario();

    expect(titulo).not.toHaveFocus();
  });
});
