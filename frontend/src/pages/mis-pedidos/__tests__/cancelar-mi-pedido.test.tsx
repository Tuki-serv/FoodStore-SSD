import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { eventoDto } from '@/test/msw/pedidos';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

type Montaje = ReturnType<typeof montarMisPedidos>;

const titulo = (numero: number) => screen.findByRole('heading', { name: new RegExp(`Pedido #${numero}`), level: 1 });
const acciones = () => screen.getByRole('region', { name: '¿Cambiaste de idea?' });

async function abrirCancelacion(usuario: Montaje['usuario']) {
  await usuario.click(within(acciones()).getByRole('button', { name: 'Cancelar pedido' }));
  return screen.findByRole('dialog', { name: 'Cancelar el pedido #58' });
}

const confirmar = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Cancelar pedido' });
const motivo = (dialogo: HTMLElement) => within(dialogo).getByRole('textbox', { name: 'Motivo' });

describe('Cancelar mi pedido', () => {
  it('con motivo envía DELETE: el detalle queda «Cancelado» con el motivo, sin el botón, y avisa «Pedido #58 cancelado»', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);

    const dialogo = await abrirCancelacion(usuario);
    expect(dialogo).toHaveTextContent('La cancelación no se puede deshacer.');
    await usuario.type(motivo(dialogo), 'Me equivoqué de dirección');
    await usuario.click(confirmar(dialogo));

    expect(await screen.findByText('Pedido cancelado')).toBeInTheDocument();
    expect(estado.cancelaciones).toEqual([{ id: 58, cuerpo: { motivo: 'Me equivoqué de dirección' } }]);
    const seguimiento = screen.getByRole('region', { name: 'Seguimiento' });
    expect(await within(seguimiento).findByText('Me equivoqué de dirección')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    expect(await screen.findByText('Pedido #58 cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['', '   '])('un motivo vacío o de espacios («%s») muestra el error, enfoca el campo y no envía nada', async (escrito) => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    if (escrito !== '') await usuario.type(motivo(dialogo), escrito);

    await usuario.click(confirmar(dialogo));

    expect(await within(dialogo).findByText('Escribí el motivo de la cancelación')).toBeInTheDocument();
    expect(motivo(dialogo)).toHaveFocus();
    expect(estado.cancelaciones).toEqual([]);
  });

  it('el motivo con espacios al borde se envía recortado', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);

    await usuario.type(motivo(dialogo), '  Pedido duplicado  ');
    await usuario.click(confirmar(dialogo));

    await waitFor(() => expect(estado.cancelaciones).toHaveLength(1));
    expect(estado.cancelaciones[0]?.cuerpo).toEqual({ motivo: 'Pedido duplicado' });
  });

  it('un doble clic en «Cancelar pedido» envía un solo DELETE', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)], estado: { demoraCancelar: 200 } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.type(motivo(dialogo), 'Me arrepentí');

    await usuario.dblClick(confirmar(dialogo));

    expect(await screen.findByText('Pedido #58 cancelado')).toBeInTheDocument();
    expect(estado.cancelaciones).toHaveLength(1);
  });

  it('un pedido de efectivo CONFIRMADO no avisa de reintegro ni de stock', async () => {
    const { usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58, { estado_codigo: 'CONFIRMADO' })] });
    await titulo(58);

    const dialogo = await abrirCancelacion(usuario);

    expect(dialogo).not.toHaveTextContent('reintegro');
    expect(dialogo).not.toHaveTextContent('stock');
  });

  it('un pedido CONFIRMADO de Mercado Pago avisa que el reintegro no es automático', async () => {
    const { usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58, { estado_codigo: 'CONFIRMADO', forma_pago_codigo: 'MERCADOPAGO' })], pagos: { estadoConsultado: { pago_id: 7, estado: 'aprobado' } } });
    await titulo(58);

    const dialogo = await abrirCancelacion(usuario);

    expect(dialogo).toHaveTextContent('Si ya pagaste con Mercado Pago, el reintegro no es automático: lo gestionás con el local.');
    expect(dialogo).not.toHaveTextContent('stock');
  });

  it.each([
    ['EN_PREP', 'Tu pedido ya se está preparando: no se puede cancelar.'],
    ['EN_CAMINO', 'Tu pedido ya salió del local: no se puede cancelar.'],
  ])('un pedido %s no ofrece «Cancelar pedido» y explica por qué', async (estadoPedido, explicacion) => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58, { estado_codigo: estadoPedido })] });
    await titulo(58);

    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    expect(acciones()).toHaveTextContent(explicacion);
  });

  it('Escape cierra sin enviar y devuelve el foco a «Cancelar pedido»', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);
    await abrirCancelacion(usuario);

    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(acciones()).getByRole('button', { name: 'Cancelar pedido' })).toHaveFocus();
    expect(estado.cancelaciones).toEqual([]);
  });
});

describe('Cancelar mi pedido · errores', () => {
  it('409 INVALID_TRANSITION: avisa que ya avanzó, vuelve a pedir el detalle y muestra «En preparación»', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.type(motivo(dialogo), 'Me arrepentí');
    // El local lo pasó a preparación mientras el cliente escribía.
    estado.pedidos.set(58, { ...pedidoPropio(58), estado_codigo: 'EN_PREP' });
    estado.historiales.set(58, [eventoDto({ id: 1, pedido_id: 58, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_id: 1 })]);
    const consultas = estado.consultas.length;

    await usuario.click(confirmar(dialogo));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Tu pedido ya avanzó y no se puede cancelar');
    await waitFor(() => expect(estado.consultas.length).toBeGreaterThan(consultas));
    await waitFor(() => expect(screen.getByRole('heading', { name: /Pedido #58/, level: 1 })).toHaveTextContent('En preparación'));
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('un fallo de red muestra «Reintentar», que reenvía el mismo motivo', async () => {
    const { usuario, estado } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)], estado: { fallos: { cancelar: 'red' } } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.type(motivo(dialogo), 'Me arrepentí');
    await usuario.click(confirmar(dialogo));
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(motivo(dialogo)).toHaveValue('Me arrepentí');

    delete estado.fallos.cancelar;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Pedido #58 cancelado')).toBeInTheDocument();
    expect(estado.cancelaciones).toEqual([
      { id: 58, cuerpo: { motivo: 'Me arrepentí' } },
      { id: 58, cuerpo: { motivo: 'Me arrepentí' } },
    ]);
  });

  it('un 500 también ofrece «No se canceló el pedido» y «Reintentar»', async () => {
    const { usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)], estado: { fallos: { cancelar: { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' } } } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.type(motivo(dialogo), 'Me arrepentí');

    await usuario.click(confirmar(dialogo));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se canceló el pedido');
    expect(within(dialogo).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it.each([403, 404])('un %i dice «Este pedido no está disponible»', async (status) => {
    const { usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)], estado: { fallos: { cancelar: { status, detail: 'No' } } } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.type(motivo(dialogo), 'Me arrepentí');

    await usuario.click(confirmar(dialogo));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Este pedido no está disponible');
  });

  it('el diálogo con error no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedidoPropio(58)] });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.click(confirmar(dialogo));
    await within(dialogo).findByText('Escribí el motivo de la cancelación');

    await esperarSinViolacionesA11y(document.body);
  });
});
