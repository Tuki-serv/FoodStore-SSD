import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { useUiStore } from '@/shared/model';
import { esperarCheckout, montarCheckout } from '@/test/render-checkout';

const confirmar = () => screen.getByRole('button', { name: 'Confirmar pedido' });

describe('checkout: crear el pedido', () => {
  it('«Efectivo» + «Confirmar pedido» envía el cuerpo exacto, vacía el carrito, navega a la confirmación y avisa', async () => {
    const { usuario, estadoPedidos, router } = montarCheckout();
    await esperarCheckout();

    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));
    await usuario.click(confirmar());

    await waitFor(() => expect(router.state.location.pathname).toBe('/finalizar-compra/pedido/57'));
    expect(estadoPedidos.creaciones).toEqual([
      {
        direccion_id: 4,
        forma_pago_codigo: 'EFECTIVO',
        items: [
          { producto_id: 1, cantidad: 2, personalizacion: [1, 3] },
          { producto_id: 5, cantidad: 1, personalizacion: [] },
        ],
      },
    ]);
    expect(useCartStore.getState().lineas).toEqual([]);
    expect(useUiStore.getState().toasts.map((toast) => toast.titulo)).toContain('Pedido #57 creado');
  });

  it('con otra dirección y «Transferencia bancaria» envía esos valores', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();

    await usuario.click(screen.getByRole('radio', { name: /Trabajo/ }));
    await usuario.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }));
    await usuario.click(confirmar());

    await waitFor(() => expect(estadoPedidos.creaciones).toHaveLength(1));
    expect(estadoPedidos.creaciones[0]).toMatchObject({ direccion_id: 6, forma_pago_codigo: 'TRANSFERENCIA' });
  });

  it('«Retiro en el local» envía direccion_id null', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();

    await usuario.click(screen.getByRole('radio', { name: /Retiro en el local/ }));
    await usuario.click(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ }));
    await usuario.click(confirmar());

    await waitFor(() => expect(estadoPedidos.creaciones).toHaveLength(1));
    expect(estadoPedidos.creaciones[0]).toMatchObject({ direccion_id: null, forma_pago_codigo: 'MERCADOPAGO' });
  });

  it('mientras el pedido viaja el botón dice «Creando pedido…» deshabilitado y los grupos no se pueden cambiar', async () => {
    const { usuario } = montarCheckout({ pedidos: { demoraCrear: 300 } });
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    await usuario.click(confirmar());

    const boton = await screen.findByRole('button', { name: 'Creando pedido…' });
    expect(boton).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Casa/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ })).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Creando pedido…' })).not.toBeInTheDocument());
  });

  it('un doble clic en «Confirmar pedido» registra un solo pedido', async () => {
    const { usuario, estadoPedidos } = montarCheckout({ pedidos: { demoraCrear: 200 } });
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    await usuario.dblClick(confirmar());

    await waitFor(() => expect(useCartStore.getState().lineas).toEqual([]));
    expect(estadoPedidos.creaciones).toHaveLength(1);
  });

  it('el pedido creado queda sembrado en la caché: la confirmación no pide GET /pedidos/57', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    await usuario.click(confirmar());

    expect(await screen.findByRole('heading', { name: 'Pedido #57 recibido', level: 1 })).toBeInTheDocument();
    expect(estadoPedidos.consultas).toEqual([]);
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Seguir comprando' })).toBeInTheDocument();
  });
});
