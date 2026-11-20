import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { montarGestion, pedido58 } from '@/test/render-gestion';

const titulo = (numero: number) => screen.findByRole('heading', { name: new RegExp(`Pedido #${numero}`), level: 1 });
const acciones = () => screen.getByRole('region', { name: 'Acciones' });

describe('Confirmar el pago a mano', () => {
  it('en efectivo explica la confirmación y el descuento de stock, y deja el pedido «Confirmado»', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);

    await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Confirmar pago del pedido #58' });
    expect(dialogo).toHaveTextContent('Pendiente → Confirmado');
    expect(dialogo).toHaveTextContent('Confirmás que el local recibió el pago en efectivo.');
    expect(dialogo).toHaveTextContent('Al confirmar se descuenta el stock');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pago' }));

    expect(await screen.findByRole('heading', { name: /Confirmado/, level: 1 })).toBeInTheDocument();
    expect(estado.cambiosEstado).toEqual([{ id: 58, cuerpo: { nuevo_estado: 'CONFIRMADO' } }]);
    expect(within(acciones()).getByRole('button', { name: 'Pasar a preparación' })).toBeInTheDocument();
    expect(await screen.findByText('Pedido #58 confirmado')).toBeInTheDocument();
  });

  it('en transferencia el texto dice «por transferencia»', async () => {
    const { usuario } = montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ forma_pago_codigo: 'TRANSFERENCIA' })] });
    await titulo(58);

    await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('recibió el pago por transferencia');
  });

  describe('sin stock', () => {
    const sinStock = { status: 409, code: 'INSUFFICIENT_STOCK', detail: 'No hay stock suficiente para Hamburguesa Clásica' };

    it('muestra el mensaje del servidor, el pedido sigue «Pendiente» y ofrece «Cancelar por falta de stock»', async () => {
      const { usuario, estado } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { estado: sinStock } } });
      await titulo(58);

      await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));
      const dialogo = await screen.findByRole('dialog');
      await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar pago' }));

      const alerta = await within(dialogo).findByRole('alert');
      expect(alerta).toHaveTextContent('No hay stock suficiente para Hamburguesa Clásica');
      expect(within(alerta).getByRole('button', { name: 'Cancelar por falta de stock' })).toBeInTheDocument();
      expect(within(dialogo).getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Pendiente/, level: 1 })).toBeInTheDocument();
      expect(estado.pedidos.get(58)?.estado_codigo).toBe('PENDIENTE');
    });

    it('«Cancelar por falta de stock» abre la cancelación con «Sin stock» escrito y la envía', async () => {
      const { usuario, estado } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { estado: sinStock } } });
      await titulo(58);
      await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));
      await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar pago' }));
      await usuario.click(await screen.findByRole('button', { name: 'Cancelar por falta de stock' }));

      const cancelacion = await screen.findByRole('dialog', { name: 'Cancelar el pedido #58' });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      expect(within(cancelacion).getByRole('textbox', { name: 'Motivo' })).toHaveValue('Sin stock');
      delete estado.fallos.estado;
      await usuario.click(within(cancelacion).getByRole('button', { name: 'Cancelar pedido' }));

      expect(await screen.findByRole('heading', { name: /Cancelado/, level: 1 })).toBeInTheDocument();
      expect(estado.cambiosEstado.at(-1)).toEqual({ id: 58, cuerpo: { nuevo_estado: 'CANCELADO', motivo: 'Sin stock' } });
    });

    it('el diálogo con el error de stock no tiene violaciones de accesibilidad', async () => {
      const { usuario } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { estado: sinStock } } });
      await titulo(58);
      await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));
      await usuario.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar pago' }));
      await screen.findByRole('alert');

      await esperarSinViolacionesA11y(document.body);
    });
  });

  it('cerrar con Escape un diálogo recién abierto no envía nada', async () => {
    const { usuario, estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    await usuario.click(within(acciones()).getByRole('button', { name: 'Confirmar pago' }));
    await screen.findByRole('dialog');

    await usuario.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(estado.cambiosEstado).toEqual([]);
  });
});
