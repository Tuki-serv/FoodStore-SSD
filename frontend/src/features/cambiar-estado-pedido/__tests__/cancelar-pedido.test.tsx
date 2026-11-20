import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';

const titulo = (numero: number) => screen.findByRole('heading', { name: new RegExp(`Pedido #${numero}`), level: 1 });
const acciones = () => screen.getByRole('region', { name: 'Acciones' });

async function abrirCancelacion(usuario: ReturnType<typeof montarGestion>['usuario']) {
  await usuario.click(within(acciones()).getByRole('button', { name: 'Cancelar pedido' }));
  return screen.findByRole('dialog', { name: /Cancelar el pedido/ });
}

describe('Cancelar un pedido con motivo', () => {
  it('con motivo envía la cancelación: el pedido queda «Cancelado» sin acciones y el historial suma el motivo', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);

    const dialogo = await abrirCancelacion(usuario);
    expect(dialogo).toHaveTextContent('La cancelación no se puede deshacer.');
    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'El cliente no responde');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    expect(await screen.findByRole('heading', { name: /Cancelado/, level: 1 })).toBeInTheDocument();
    expect(estado.cambiosEstado).toEqual([{ id: 58, cuerpo: { nuevo_estado: 'CANCELADO', motivo: 'El cliente no responde' } }]);
    expect(screen.getByText('El pedido está cancelado: no admite más cambios.')).toBeInTheDocument();
    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });
    await waitFor(() => expect(within(historial).getByText('El cliente no responde')).toBeInTheDocument());
    expect(await screen.findByText('Pedido #58 cancelado')).toBeInTheDocument();
  });

  it.each(['', '   '])('un motivo vacío o de espacios («%s») muestra el error, enfoca el campo y no envía nada', async (escrito) => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    if (escrito !== '') await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), escrito);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    expect(await within(dialogo).findByText('Escribí el motivo de la cancelación')).toBeInTheDocument();
    expect(within(dialogo).getByRole('textbox', { name: 'Motivo' })).toHaveFocus();
    expect(estado.cambiosEstado).toEqual([]);
  });

  it('el motivo con espacios al borde se envía recortado', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);

    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), '  Pedido duplicado  ');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() => expect(estado.cambiosEstado).toHaveLength(1));
    expect(estado.cambiosEstado[0]?.cuerpo).toEqual({ nuevo_estado: 'CANCELADO', motivo: 'Pedido duplicado' });
  });

  it('un pedido PENDIENTE no avisa de devolución de stock; uno CONFIRMADO sí', async () => {
    const pendiente = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    expect(await abrirCancelacion(pendiente.usuario)).not.toHaveTextContent('El stock de sus productos se devuelve.');
  });

  it.each(['CONFIRMADO', 'EN_PREP'])('un pedido %s avisa que el stock se devuelve', async (estadoPedido) => {
    const { usuario } = montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: estadoPedido })] });
    await titulo(58);

    const dialogo = await abrirCancelacion(usuario);

    expect(dialogo).toHaveTextContent('El stock de sus productos se devuelve.');
    expect(dialogo).not.toHaveTextContent('reintegro');
  });

  it('un pedido CONFIRMADO de Mercado Pago avisa que el reintegro se gestiona aparte', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);

    const dialogo = await abrirCancelacion(usuario);

    expect(dialogo).toHaveTextContent('Si el cliente ya pagó con tarjeta, el reintegro se gestiona aparte en Mercado Pago.');
    expect(dialogo).toHaveTextContent('El stock de sus productos se devuelve.');
  });

  it('un pedido EN_CAMINO no ofrece «Cancelar pedido»', async () => {
    montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: 'EN_CAMINO' })] });
    await titulo(58);

    expect(within(acciones()).queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
  });

  it('un 422 con field «motivo» se muestra como error del campo', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { estado: { status: 422, code: 'VALIDATION_ERROR', field: 'motivo', detail: 'El motivo es obligatorio si el nuevo_estado es CANCELADO' } } } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);

    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'x');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    expect(await within(dialogo).findByText('El motivo es obligatorio si el nuevo_estado es CANCELADO')).toBeInTheDocument();
    expect(within(dialogo).getByRole('textbox', { name: 'Motivo' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('con un error del servidor muestra la alerta dentro del diálogo y conserva el motivo', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { estado: 'red' } } });
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);

    await usuario.type(within(dialogo).getByRole('textbox', { name: 'Motivo' }), 'El cliente no responde');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(within(dialogo).getByRole('textbox', { name: 'Motivo' })).toHaveValue('El cliente no responde');
  });

  it('«Volver» cierra sin enviar y devuelve el foco al botón «Cancelar pedido»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(acciones()).getByRole('button', { name: 'Cancelar pedido' })).toHaveFocus();
    expect(estado.cambiosEstado).toEqual([]);
  });

  it('el diálogo de cancelación con error no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    const dialogo = await abrirCancelacion(usuario);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar pedido' }));
    await within(dialogo).findByText('Escribí el motivo de la cancelación');

    await esperarSinViolacionesA11y(document.body);
  });
});
