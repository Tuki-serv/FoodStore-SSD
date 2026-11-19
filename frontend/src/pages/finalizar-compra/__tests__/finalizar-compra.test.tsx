import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { cocaCola, esperarCheckout, montarCheckout } from '@/test/render-checkout';

const resumen = () => screen.getByRole('complementary', { name: 'Tu pedido' });
const grupo = (nombre: string) => screen.getByRole('group', { name: nombre });
const confirmar = () => screen.getByRole('button', { name: 'Confirmar pedido' });

describe('checkout: pantalla y resumen', () => {
  it('muestra el título, los pasos con «Casa» elegida y la forma de pago sin elección', async () => {
    montarCheckout();
    await esperarCheckout();

    expect(screen.getByRole('heading', { name: 'Finalizar compra', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Entrega', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Forma de pago', level: 2 })).toBeInTheDocument();
    expect(within(grupo('¿Dónde lo recibís?')).getByRole('radio', { name: /Casa/ })).toBeChecked();
    expect(within(grupo('¿Dónde lo recibís?')).getByRole('radio', { name: /Trabajo/ })).not.toBeChecked();
    for (const radio of within(grupo('¿Cómo pagás?')).getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('ofrece las tres formas de pago en orden', async () => {
    montarCheckout();
    await esperarCheckout();

    const etiquetas = within(grupo('¿Cómo pagás?')).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent);
    expect(etiquetas[0]).toContain('Tarjeta (Mercado Pago)');
    expect(etiquetas[1]).toContain('Efectivo');
    expect(etiquetas[2]).toContain('Transferencia bancaria');
  });

  it('el resumen lista las líneas con su personalización y muestra subtotal, envío, descuento y total estimado', async () => {
    montarCheckout();
    await esperarCheckout();

    const lista = within(resumen()).getByRole('list', { name: 'Productos del pedido' });
    const [hamburguesa, coca] = within(lista).getAllByRole('listitem');
    expect(hamburguesa).toHaveTextContent('2 ×');
    expect(hamburguesa).toHaveTextContent('Hamburguesa Clásica');
    expect(hamburguesa).toHaveTextContent('Sin cebolla, sin tomate');
    expect(hamburguesa).toHaveTextContent('$ 3.000');
    expect(coca).toHaveTextContent('Coca-Cola 500ml');
    expect(coca).not.toHaveTextContent('Sin ');
    expect(coca).toHaveTextContent('$ 800');
    expect(within(resumen()).getByText('Subtotal (3 unidades)').nextSibling).toHaveTextContent('$ 3.800');
    expect(within(resumen()).getByText('Costo de envío').nextSibling).toHaveTextContent('$ 50');
    expect(within(resumen()).getByText('Descuento').nextSibling).toHaveTextContent('$ 0');
    expect(within(resumen()).getByText('Total estimado').nextSibling).toHaveTextContent('$ 3.850');
  });

  it('con otras cantidades el total estimado se recalcula', async () => {
    montarCheckout({ lineas: [{ ...cocaCola, cantidad: 3 }] });
    await esperarCheckout();

    expect(within(resumen()).getByText('Subtotal (3 unidades)').nextSibling).toHaveTextContent('$ 2.400');
    expect(within(resumen()).getByText('Total estimado').nextSibling).toHaveTextContent('$ 2.450');
  });

  it('aclara que el total final lo confirma el servidor y que el stock se verifica pero no se reserva', async () => {
    montarCheckout();
    await esperarCheckout();

    expect(within(resumen()).getByText('El total final lo confirma el servidor con los precios vigentes.')).toBeInTheDocument();
    expect(
      within(resumen()).getByText('Verificamos el stock al crear el pedido, pero no lo reservamos: se descuenta cuando el pedido se confirma.'),
    ).toBeInTheDocument();
  });

  it('un enlace permite volver al carrito y otro gestionar direcciones', async () => {
    montarCheckout();
    await esperarCheckout();

    expect(screen.getByRole('link', { name: /Volver al carrito/ })).toHaveAttribute('href', '/carrito');
    expect(screen.getByRole('link', { name: 'Gestionar direcciones' })).toHaveAttribute('href', '/direcciones');
  });
});

describe('checkout: acceso y entrega', () => {
  it('con el carrito vacío reemplaza la URL por /carrito y muestra «Tu carrito está vacío»', async () => {
    const { router } = montarCheckout({ lineas: [] });

    expect(await screen.findByRole('heading', { name: 'Tu carrito está vacío' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/carrito');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('sin direcciones elige «Retiro en el local» y aclara que la tarifa de envío es fija también con retiro', async () => {
    montarCheckout({ direcciones: [] });
    await esperarCheckout();

    expect(screen.getByText('No tenés direcciones guardadas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agregar dirección' })).toHaveAttribute('href', '/direcciones');
    expect(screen.getByRole('radio', { name: /Retiro en el local/ })).toBeChecked();
    expect(within(resumen()).getByText('Tarifa fija por pedido, también con retiro')).toBeInTheDocument();
  });

  it('elegir «Retiro en el local» con direcciones muestra la aclaración; volver a una dirección la oculta', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    expect(within(resumen()).queryByText('Tarifa fija por pedido, también con retiro')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: /Retiro en el local/ }));
    expect(within(resumen()).getByText('Tarifa fija por pedido, también con retiro')).toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: /Trabajo/ }));
    expect(within(resumen()).queryByText('Tarifa fija por pedido, también con retiro')).not.toBeInTheDocument();
  });
});

describe('checkout: forma de pago', () => {
  it('confirmar sin elegir muestra «Elegí una forma de pago», lleva el foco al grupo y no envía nada', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();

    await usuario.click(confirmar());

    const grupoPago = grupo('¿Cómo pagás?');
    expect(await screen.findByText('Elegí una forma de pago.')).toBeInTheDocument();
    await waitFor(() => expect(grupoPago).toHaveFocus());
    expect(grupoPago).toHaveAccessibleDescription('Elegí una forma de pago.');
    expect(estadoPedidos.creaciones).toEqual([]);
  });

  it('elegir una forma de pago después del error hace desaparecer el mensaje', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    await usuario.click(confirmar());
    await screen.findByText('Elegí una forma de pago.');

    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    expect(screen.queryByText('Elegí una forma de pago.')).not.toBeInTheDocument();
  });

  it('antes de intentar confirmar no se muestra ningún error de forma de pago', async () => {
    montarCheckout();
    await esperarCheckout();

    expect(screen.queryByText('Elegí una forma de pago.')).not.toBeInTheDocument();
  });

  it.each([
    ['Efectivo', /Tu pedido queda pendiente hasta que el local confirme el pago en efectivo/],
    ['Transferencia bancaria', /Tu pedido queda pendiente hasta que el local confirme el pago de la transferencia/],
  ])('«%s» explica la confirmación manual', async (etiqueta, texto) => {
    const { usuario } = montarCheckout();
    await esperarCheckout();

    await usuario.click(screen.getByRole('radio', { name: new RegExp(etiqueta) }));

    expect(screen.getByText('Confirmación manual')).toBeInTheDocument();
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(screen.queryByLabelText(/número de tarjeta/i)).not.toBeInTheDocument();
  });

  it('«Tarjeta (Mercado Pago)» explica que el pago con tarjeta se hace en el paso siguiente y no muestra campos de tarjeta', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();

    await usuario.click(screen.getByRole('radio', { name: /Tarjeta \(Mercado Pago\)/ }));

    expect(screen.getByText('Pago en el paso siguiente')).toBeInTheDocument();
    expect(screen.getByText(/El pago con tarjeta lo hacés en el paso siguiente/)).toBeInTheDocument();
    expect(screen.queryByText('Confirmación manual')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/número de tarjeta/i)).not.toBeInTheDocument();
  });
});

describe('checkout: notas', () => {
  it('«Agregar una nota» abre «Notas para el local» con contador de 300', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    expect(screen.queryByRole('textbox', { name: /Notas para el local/ })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /Agregar una nota/ }));
    await usuario.type(screen.getByRole('textbox', { name: /Notas para el local/ }), 'Timbre 3B');

    expect(screen.getByRole('textbox', { name: /Notas para el local/ })).toHaveAttribute('maxlength', '300');
    expect(screen.getByText('9/300')).toBeInTheDocument();
  });

  it('el texto con espacios sobrantes se envía recortado', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('button', { name: /Agregar una nota/ }));
    await usuario.type(screen.getByRole('textbox', { name: /Notas para el local/ }), '  Sin servilletas  ');
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    await usuario.click(confirmar());

    await waitFor(() => expect(estadoPedidos.creaciones).toHaveLength(1));
    expect(estadoPedidos.creaciones[0]).toMatchObject({ notas: 'Sin servilletas' });
  });

  it('una nota vacía o de solo espacios no envía «notas»', async () => {
    const { usuario, estadoPedidos } = montarCheckout();
    await esperarCheckout();
    await usuario.click(screen.getByRole('button', { name: /Agregar una nota/ }));
    await usuario.type(screen.getByRole('textbox', { name: /Notas para el local/ }), '   ');
    await usuario.click(screen.getByRole('radio', { name: /Efectivo/ }));

    await usuario.click(confirmar());

    await waitFor(() => expect(estadoPedidos.creaciones).toHaveLength(1));
    expect(estadoPedidos.creaciones[0]).not.toHaveProperty('notas');
  });
});

describe('checkout: accesibilidad', () => {
  it('el checkout con datos no tiene violaciones', async () => {
    montarCheckout();
    await esperarCheckout();

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });

  it('el checkout con la validación de forma de pago no tiene violaciones', async () => {
    const { usuario } = montarCheckout();
    await esperarCheckout();
    await usuario.click(confirmar());
    await screen.findByText('Elegí una forma de pago.');

    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
