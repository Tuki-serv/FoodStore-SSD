import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';

const titulo = (numero: number) => screen.findByRole('heading', { name: new RegExp(`Pedido #${numero}`), level: 1 });
const acciones = () => screen.getByRole('region', { name: 'Acciones' });
const abrir = async (usuario: ReturnType<typeof montarGestion>['usuario'], nombre: string) => {
  await usuario.click(within(acciones()).getByRole('button', { name: nombre }));
};

describe('Avanzar el estado desde el detalle', () => {
  it('«Pasar a preparación» con observación envía el cambio, actualiza estado, acciones, historial y avisa', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);

    await abrir(usuario, 'Pasar a preparación');
    const dialogo = await screen.findByRole('dialog', { name: 'Pasar a preparación el pedido #57' });
    expect(dialogo).toHaveTextContent('Confirmado → En preparación');
    await usuario.type(within(dialogo).getByRole('textbox', { name: /Observación/ }), 'Sale en 20 min');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Pasar a preparación' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(estado.cambiosEstado).toEqual([{ id: 57, cuerpo: { nuevo_estado: 'EN_PREP', motivo: 'Sale en 20 min' } }]);
    expect(await screen.findByRole('heading', { name: /En preparación/, level: 1 })).toBeInTheDocument();
    expect(within(acciones()).getByRole('button', { name: 'Despachar' })).toBeInTheDocument();
    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });
    await waitFor(() => expect(within(historial).getByText('Sale en 20 min')).toBeInTheDocument());
    expect(await screen.findByText('Pedido #57 en preparación')).toBeInTheDocument();
  });

  it('«Despachar» sin observación envía el cuerpo sin motivo, muestra la entrega y deja el pedido «En camino»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: 'EN_PREP' })] });
    await titulo(58);

    await abrir(usuario, 'Despachar');
    const dialogo = await screen.findByRole('dialog', { name: 'Despachar el pedido #58' });
    expect(await within(dialogo).findByText(/Av\. Siempre Viva 742/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Despachar' }));

    expect(await screen.findByRole('heading', { name: /En camino/, level: 1 })).toBeInTheDocument();
    expect(estado.cambiosEstado).toEqual([{ id: 58, cuerpo: { nuevo_estado: 'EN_CAMINO' } }]);
    expect(Object.keys(estado.cambiosEstado[0]?.cuerpo ?? {})).toEqual(['nuevo_estado']);
    expect(within(acciones()).getAllByRole('button').map((boton) => boton.textContent)).toEqual(['Marcar entregado']);
  });

  it('el diálogo de despacho de un pedido para retirar dice «Retiro en el local»', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57({ estado_codigo: 'EN_PREP' })] });
    await titulo(57);

    await abrir(usuario, 'Despachar');

    expect(await within(await screen.findByRole('dialog')).findByText('Retiro en el local')).toBeInTheDocument();
  });

  it('«Marcar entregado» termina el pedido: queda «Entregado» sin acciones', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: 'EN_CAMINO' })] });
    await titulo(58);

    await abrir(usuario, 'Marcar entregado');
    const dialogo = await screen.findByRole('dialog', { name: 'Marcar entregado el pedido #58' });
    expect(dialogo).toHaveTextContent('El pedido queda terminado y ya no admite cambios.');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Marcar entregado' }));

    expect(await screen.findByRole('heading', { name: /Entregado/, level: 1 })).toBeInTheDocument();
    expect(estado.cambiosEstado[0]?.cuerpo).toEqual({ nuevo_estado: 'ENTREGADO' });
    expect(screen.getByText('El pedido ya se entregó: no admite más cambios.')).toBeInTheDocument();
  });

  it('la observación se corta en 300 caracteres y el contador lo muestra', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    await abrir(usuario, 'Pasar a preparación');
    const campo = within(await screen.findByRole('dialog')).getByRole('textbox', { name: /Observación/ });

    await usuario.click(campo);
    await usuario.paste('x'.repeat(305));

    expect(campo).toHaveValue('x'.repeat(300));
    expect(screen.getByText('300/300')).toBeInTheDocument();
  });

  it('mientras guarda: «Guardando…» deshabilitado, Escape no cierra y el doble clic envía un solo cambio', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()], estado: { demoraEstado: 300 } });
    await titulo(57);
    await abrir(usuario, 'Pasar a preparación');
    const dialogo = await screen.findByRole('dialog');

    await usuario.dblClick(within(dialogo).getByRole('button', { name: 'Pasar a preparación' }));
    const guardando = await within(dialogo).findByRole('button', { name: 'Guardando…' });
    await usuario.keyboard('{Escape}');

    expect(guardando).toBeDisabled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(estado.cambiosEstado).toHaveLength(1);
  });

  it('Escape en reposo cierra el diálogo y el foco vuelve al botón «Despachar»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57({ estado_codigo: 'EN_PREP' })] });
    await titulo(57);
    await abrir(usuario, 'Despachar');
    await screen.findByRole('dialog', { name: 'Despachar el pedido #57' });

    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(acciones()).getByRole('button', { name: 'Despachar' })).toHaveFocus();
    expect(estado.cambiosEstado).toEqual([]);
  });

  it('tras avanzar, el foco pasa a la acción nueva', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    await abrir(usuario, 'Pasar a preparación');
    await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pasar a preparación' }));

    await waitFor(() => expect(within(acciones()).getByRole('button', { name: 'Despachar' })).toHaveFocus());
  });

  it('el diálogo no tiene violaciones de accesibilidad', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    await abrir(usuario, 'Pasar a preparación');
    await screen.findByRole('dialog');

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('Errores al avanzar el estado', () => {
  const abrirYConfirmar = async (usuario: ReturnType<typeof montarGestion>['usuario'], observacion?: string) => {
    await abrir(usuario, 'Pasar a preparación');
    const dialogo = await screen.findByRole('dialog');
    if (observacion !== undefined) await usuario.type(within(dialogo).getByRole('textbox', { name: /Observación/ }), observacion);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Pasar a preparación' }));
    return dialogo;
  };

  it('409 INVALID_TRANSITION muestra el mensaje y «El pedido cambió mientras lo mirabas», y el detalle muestra el estado real', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    estado.fallos.estado = { status: 409, code: 'INVALID_TRANSITION', detail: 'No se puede cambiar de EN_PREP a EN_PREP' };
    estado.pedidos.set(57, pedido57({ estado_codigo: 'EN_PREP' }));

    const dialogo = await abrirYConfirmar(usuario, 'Sale en 20 min');

    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('El pedido cambió mientras lo mirabas');
    expect(alerta).toHaveTextContent('No se puede cambiar de EN_PREP a EN_PREP');
    expect(await screen.findByRole('heading', { name: /En preparación/, level: 1 })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    expect(within(dialogo).getByRole('textbox', { name: /Observación/ })).toHaveValue('Sale en 20 min');
  });

  it('un error de red ofrece «Reintentar», conserva la observación y reenvía el mismo cuerpo', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    estado.fallos.estado = 'red';

    const dialogo = await abrirYConfirmar(usuario, 'Sale en 20 min');

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(within(dialogo).getByRole('textbox', { name: /Observación/ })).toHaveValue('Sale en 20 min');
    delete estado.fallos.estado;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(estado.cambiosEstado).toHaveLength(2);
    expect(estado.cambiosEstado[1]).toEqual(estado.cambiosEstado[0]);
    expect(estado.cambiosEstado[1]?.cuerpo).toEqual({ nuevo_estado: 'EN_PREP', motivo: 'Sale en 20 min' });
  });

  it('un 500 también ofrece «Reintentar»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    estado.fallos.estado = { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' };

    const dialogo = await abrirYConfirmar(usuario);

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado. Probá de nuevo.');
    expect(within(dialogo).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it.each([
    [403, 'No tenés permiso para cambiar este pedido'],
    [404, 'Este pedido ya no existe'],
  ])('un %i muestra «%s»', async (status, texto) => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/57', { pedidos: [pedido57()] });
    await titulo(57);
    estado.fallos.estado = { status, detail: 'texto del servidor que no se usa' };

    const dialogo = await abrirYConfirmar(usuario);

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(texto);
  });
});
