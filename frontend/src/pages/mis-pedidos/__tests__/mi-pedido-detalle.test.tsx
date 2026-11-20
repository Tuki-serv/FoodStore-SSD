import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { detalleDto, direccionDto, eventoDto } from '@/test/msw/pedidos';
import { montarMisPedidos, pedidoPropio } from '@/test/render-mis-pedidos';

const local = (dia: number, hora: number, minuto: number) => new Date(2026, 10, dia, hora, minuto).toISOString();

function pedido58(parcial = {}) {
  return pedidoPropio(58, {
    notas: 'Tocar timbre 2, el 1 no anda.',
    direccion: direccionDto({ id: 4, alias: 'Casa', linea1: 'Av. Siempre Viva 742', ciudad: 'Springfield' }),
    items: [
      detalleDto({ pedido_id: 58, producto_id: 1, cantidad: 2, nombre_snapshot: 'Hamburguesa Clásica', precio_snapshot: '1500.00', subtotal_snapshot: '3000.00', personalizacion: [1], personalizacion_snapshot: ['Cebolla'] }),
      detalleDto({ pedido_id: 58, producto_id: 5, cantidad: 1, nombre_snapshot: 'Coca-Cola 500ml', precio_snapshot: '800.00', subtotal_snapshot: '800.00' }),
    ],
    subtotal: '3800.00',
    total: '3850.00',
    ...parcial,
  });
}

const historialInicial = (id: number, creado = local(19, 12, 40)) => [eventoDto({ id: id * 100, pedido_id: id, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_id: 1, usuario_nombre: 'Ana López', created_at: creado })];

describe('Mi pedido · detalle', () => {
  it('muestra el pedido 58: forma de pago, entrega, ítems, total, progreso y el historial con «Vos»', async () => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [pedido58()] });

    expect(await screen.findByRole('heading', { name: /Pedido #58/, level: 1 })).toBeInTheDocument();
    const entrega = screen.getByRole('region', { name: 'Entrega y pago' });
    expect(entrega).toHaveTextContent('Efectivo');
    expect(entrega).toHaveTextContent('Av. Siempre Viva 742');
    expect(entrega).toHaveTextContent('Springfield');
    expect(entrega).toHaveTextContent('Tocar timbre 2, el 1 no anda.');
    const productos = screen.getByRole('region', { name: 'Productos' });
    expect(within(productos).getByText('Sin cebolla')).toBeInTheDocument();
    expect(productos).toHaveTextContent('$ 3.850');
    const seguimiento = screen.getByRole('region', { name: 'Seguimiento' });
    expect(seguimiento).toHaveTextContent('Paso actual: Pendiente');
    expect(seguimiento).toHaveTextContent('El local confirma tu pedido cuando recibe el pago.');
    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });
    expect(within(historial).getByText('Pedido creado')).toBeInTheDocument();
    expect(historial).toHaveTextContent('Vos · 19/11/2026 a las 12:40');
  });

  it('un retiro en el local lo dice y llama «Listo para retirar» al paso 4', async () => {
    montarMisPedidos('/mis-pedidos/57', {
      pedidos: [pedidoPropio(57, { estado_codigo: 'EN_CAMINO', direccion_id: null, direccion: null, forma_pago_codigo: 'TRANSFERENCIA' })],
    });

    await screen.findByRole('heading', { name: /Pedido #57/, level: 1 });

    expect(screen.getByRole('region', { name: 'Entrega y pago' })).toHaveTextContent('Retiro en el local');
    const seguimiento = screen.getByRole('region', { name: 'Seguimiento' });
    expect(within(seguimiento).getByText('Listo para retirar')).toBeInTheDocument();
    expect(seguimiento).toHaveTextContent('Paso actual: Listo para retirar');
    expect(seguimiento).toHaveTextContent('Tu pedido está listo para retirar.');
  });

  it('un pedido en preparación marca «Pendiente» y «Confirmado» como cumplidos', async () => {
    montarMisPedidos('/mis-pedidos/54', { pedidos: [pedidoPropio(54, { estado_codigo: 'EN_PREP' })] });

    await screen.findByRole('heading', { name: /Pedido #54/, level: 1 });

    const pasos = within(screen.getByRole('list', { name: 'Progreso del pedido' })).getAllByRole('listitem');
    expect(pasos.map((paso) => paso.textContent)).toEqual([
      'Pendiente (cumplido)',
      'Confirmado (cumplido)',
      'En preparación',
      'En camino (pendiente)',
      'Entregado (pendiente)',
    ]);
    expect(screen.getByRole('region', { name: 'Seguimiento' })).toHaveTextContent('Tu pedido se está preparando.');
  });

  it('un pedido cancelado muestra «Pedido cancelado» con el motivo y sin pasos', async () => {
    const creado = local(18, 20, 2);
    montarMisPedidos('/mis-pedidos/44', {
      pedidos: [pedidoPropio(44, { estado_codigo: 'CANCELADO' })],
      historiales: {
        44: [
          ...historialInicial(44, creado),
          eventoDto({ id: 4402, pedido_id: 44, estado_desde: 'PENDIENTE', estado_hacia: 'CANCELADO', motivo: 'Me equivoqué de dirección', usuario_id: 1, usuario_nombre: 'Ana López', created_at: local(18, 20, 9) }),
        ],
      },
    });

    await screen.findByRole('heading', { name: /Pedido #44/, level: 1 });

    const seguimiento = screen.getByRole('region', { name: 'Seguimiento' });
    expect(await within(seguimiento).findByText('Me equivoqué de dirección')).toBeInTheDocument();
    expect(seguimiento).toHaveTextContent('Pedido cancelado');
    expect(seguimiento).toHaveTextContent('Lo cancelaste');
    expect(screen.queryByRole('list', { name: 'Progreso del pedido' })).not.toBeInTheDocument();
  });

  it('un pedido cancelado por el local lo dice así', async () => {
    montarMisPedidos('/mis-pedidos/44', {
      pedidos: [pedidoPropio(44, { estado_codigo: 'CANCELADO' })],
      historiales: {
        44: [
          ...historialInicial(44),
          eventoDto({ id: 4402, pedido_id: 44, estado_desde: 'PENDIENTE', estado_hacia: 'CANCELADO', motivo: 'Sin stock de pan', usuario_id: 9, usuario_nombre: 'Carla', created_at: local(19, 12, 50) }),
        ],
      },
    });

    const seguimiento = await screen.findByRole('region', { name: 'Seguimiento' });

    expect(await within(seguimiento).findByText('Sin stock de pan')).toBeInTheDocument();
    expect(seguimiento).toHaveTextContent('Lo canceló el local');
  });

  it('el historial muestra «Automático» y «El local» y nunca el nombre del personal', async () => {
    montarMisPedidos('/mis-pedidos/53', {
      pedidos: [pedidoPropio(53, { estado_codigo: 'EN_PREP', forma_pago_codigo: 'MERCADOPAGO' })],
      historiales: {
        53: [
          ...historialInicial(53),
          eventoDto({ id: 5302, pedido_id: 53, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', motivo: 'Pago aprobado por Mercado Pago', usuario_id: null, usuario_nombre: null, created_at: local(19, 12, 41) }),
          eventoDto({ id: 5303, pedido_id: 53, estado_desde: 'CONFIRMADO', estado_hacia: 'EN_PREP', motivo: 'Sale en 20 min', usuario_id: 9, usuario_nombre: 'Carla', created_at: local(19, 12, 45) }),
        ],
      },
    });

    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });

    expect(within(historial).getByText('Automático')).toBeInTheDocument();
    expect(within(historial).getByText('El local')).toBeInTheDocument();
    expect(within(historial).getByText('Sale en 20 min')).toBeInTheDocument();
    expect(screen.queryByText(/Carla/)).not.toBeInTheDocument();
  });

  it('un pedido de otro usuario dice «No encontramos este pedido» sin mostrar sus datos', async () => {
    montarMisPedidos('/mis-pedidos/70', { pedidos: [pedidoPropio(70, { usuario_id: 2, cliente_nombre: 'Bruno Díaz', notas: 'Dato ajeno' })] });

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('Bruno Díaz')).not.toBeInTheDocument();
    expect(screen.queryByText('Dato ajeno')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mis pedidos' })).toHaveAttribute('href', '/mis-pedidos');
  });

  it.each([404, 403])('un %i del servidor dice lo mismo, con «Volver a mis pedidos»', async (status) => {
    montarMisPedidos('/mis-pedidos/58', { pedidos: [pedido58()], estado: { fallos: { detalle: { status, detail: 'No' } } } });

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a mis pedidos' })).toBeInTheDocument();
  });

  it('un error 500 del detalle ofrece «Reintentar» y se recupera', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedido58()], estado: { fallos: { detalle: { status: 500, detail: 'Fallo interno' } } } });

    await screen.findByRole('button', { name: 'Reintentar' });
    delete estado.fallos.detalle;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: /Pedido #58/, level: 1 })).toBeInTheDocument();
  });

  it('si falla el historial el detalle se ve y el historial ofrece «Reintentar»', async () => {
    const { estado, usuario } = montarMisPedidos('/mis-pedidos/58', { pedidos: [pedido58()], estado: { fallos: { historial: { status: 500, detail: 'Fallo' } } } });

    const aviso = await screen.findByText('No pudimos cargar el historial');
    expect(screen.getByRole('heading', { name: /Pedido #58/, level: 1 })).toBeInTheDocument();
    expect(aviso).toBeInTheDocument();

    delete estado.fallos.historial;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('list', { name: 'Historial del pedido' })).toBeInTheDocument();
  });
});
