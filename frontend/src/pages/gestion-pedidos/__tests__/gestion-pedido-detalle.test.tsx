import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { eventoDto } from '@/test/msw/pedidos';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';

const local = (dia: number, hora: number, minuto: number) => new Date(2026, 10, dia, hora, minuto).toISOString();

const HISTORIAL_58 = [eventoDto({ id: 5801, pedido_id: 58, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_nombre: 'Ana López', created_at: local(19, 12, 40) })];

const titulo = (numero: number) => screen.findByRole('heading', { name: new RegExp(`Pedido #${numero}`), level: 1 });

afterEach(() => {
  vi.useRealTimers();
});

describe('Detalle de gestión de pedidos', () => {
  it('muestra el pedido con cliente, forma de pago, dirección, ítems, totales, nota del cliente e historial', async () => {
    montarGestion('/gestion-pedidos/58', { historiales: { 58: HISTORIAL_58 } });

    const encabezado = await titulo(58);

    expect(encabezado).toHaveTextContent('Pendiente');
    const entrega = screen.getByRole('region', { name: 'Cliente y entrega' });
    expect(entrega).toHaveTextContent('Ana López');
    expect(entrega).toHaveTextContent('Efectivo');
    expect(entrega).toHaveTextContent('Av. Siempre Viva 742');
    expect(entrega).toHaveTextContent('Springfield');
    expect(entrega).toHaveTextContent('Tocar timbre 2, el 1 no anda.');
    const productos = screen.getByRole('list', { name: 'Productos del pedido' });
    expect(productos).toHaveTextContent('2 ×Hamburguesa ClásicaSin cebolla$ 3.000');
    expect(productos).toHaveTextContent('1 ×Coca-Cola 500ml$ 800');
    const totales = screen.getByRole('region', { name: 'Productos' });
    expect(totales).toHaveTextContent('Subtotal$ 3.800');
    expect(totales).toHaveTextContent('Costo de envío$ 50');
    expect(totales).toHaveTextContent('Descuento$ 0');
    expect(totales).toHaveTextContent('Total$ 3.850');
    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });
    expect(within(historial).getByText('Pedido creado')).toBeInTheDocument();
    expect(screen.getByText(/Creado el 19\/11\/2026 a las \d\d:\d\d/)).toBeInTheDocument();
  });

  it('un pedido para retirar dice «Retiro en el local» y no muestra la nota si no hay', async () => {
    montarGestion('/gestion-pedidos/57', { pedidos: [pedido57({ notas: null })] });
    await titulo(57);

    expect(screen.getByRole('region', { name: 'Cliente y entrega' })).toHaveTextContent('Retiro en el local');
    expect(screen.queryByText('Nota del cliente')).toBeNull();
  });

  it('el historial muestra el evento del Sistema y la observación de un cambio', async () => {
    montarGestion('/gestion-pedidos/57', {
      pedidos: [pedido57()],
      historiales: {
        57: [
          eventoDto({ id: 1, pedido_id: 57, estado_hacia: 'PENDIENTE', motivo: 'Pedido creado', usuario_nombre: 'Bruno Díaz', created_at: local(19, 12, 31) }),
          eventoDto({ id: 2, pedido_id: 57, estado_desde: 'PENDIENTE', estado_hacia: 'CONFIRMADO', usuario_id: null, usuario_nombre: null, created_at: local(19, 12, 33) }),
          eventoDto({ id: 3, pedido_id: 57, estado_desde: 'CONFIRMADO', estado_hacia: 'EN_PREP', motivo: 'Sale en 20 min', usuario_id: 9, usuario_nombre: 'Carla', created_at: local(19, 12, 40) }),
        ],
      },
    });

    const historial = await screen.findByRole('list', { name: 'Historial del pedido' });

    const eventos = within(historial).getAllByRole('listitem');
    expect(eventos).toHaveLength(3);
    expect(eventos[1]).toHaveTextContent('Sistema');
    expect(eventos[2]).toHaveTextContent('Carla');
    expect(eventos[2]).toHaveTextContent('Sale en 20 min');
  });

  it('un pedido inexistente muestra «No encontramos este pedido» con el enlace al listado', async () => {
    montarGestion('/gestion-pedidos/999');

    expect(await screen.findByRole('heading', { name: 'No encontramos este pedido', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a pedidos' })).toHaveAttribute('href', '/gestion-pedidos');
  });

  it('«Volver a pedidos» conserva los filtros de la URL desde la que se abrió el pedido', async () => {
    const { usuario, router } = montarGestion('/gestion-pedidos?estado=PENDIENTE');
    await usuario.click(await screen.findByRole('link', { name: '#58' }));
    await titulo(58);

    await usuario.click(screen.getByRole('link', { name: 'Volver a pedidos' }));

    expect(router.state.location.pathname).toBe('/gestion-pedidos');
    expect(router.state.location.search).toBe('?estado=PENDIENTE');
  });

  it('un error de servidor en el detalle ofrece «Reintentar»', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { detalle: { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' } } } });

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar el pedido' })).toBeInTheDocument();
    delete estado.fallos.detalle;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await titulo(58)).toBeInTheDocument();
  });

  it('si el historial falla el detalle se ve igual y el bloque de historial ofrece «Reintentar»', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos/58', { estado: { fallos: { historial: { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' } } } });

    await titulo(58);
    expect(await screen.findByText('No pudimos cargar el historial')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cliente y entrega' })).toHaveTextContent('Ana López');
    delete estado.fallos.historial;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('list', { name: 'Historial del pedido' })).toBeInTheDocument();
  });

  it('vuelve a pedir el detalle y el historial a los 30 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { estado } = montarGestion('/gestion-pedidos/58');
    await titulo(58);
    await screen.findByRole('list', { name: 'Historial del pedido' });
    const detalles = estado.consultas.length;
    const historiales = estado.consultasHistorial.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    await waitFor(() => expect(estado.consultas.length).toBeGreaterThan(detalles));
    await waitFor(() => expect(estado.consultasHistorial.length).toBeGreaterThan(historiales));
  });

  it('no tiene violaciones de accesibilidad con el historial', async () => {
    montarGestion('/gestion-pedidos/58', { historiales: { 58: HISTORIAL_58 } });
    await titulo(58);
    await screen.findByRole('list', { name: 'Historial del pedido' });

    await esperarSinViolacionesA11y(document.body);
  });
});

/** Acciones esperadas, escritas a mano desde la FSM del backend (`fsm.py`), no importadas de la UI. */
const ESPERADAS: [estado: string, forma: string, botones: string[]][] = [
  ['PENDIENTE', 'EFECTIVO', ['Confirmar pago', 'Cancelar pedido']],
  ['PENDIENTE', 'TRANSFERENCIA', ['Confirmar pago', 'Cancelar pedido']],
  ['PENDIENTE', 'MERCADOPAGO', ['Cancelar pedido']],
  ['CONFIRMADO', 'EFECTIVO', ['Pasar a preparación', 'Cancelar pedido']],
  ['CONFIRMADO', 'TRANSFERENCIA', ['Pasar a preparación', 'Cancelar pedido']],
  ['CONFIRMADO', 'MERCADOPAGO', ['Pasar a preparación', 'Cancelar pedido']],
  ['EN_PREP', 'EFECTIVO', ['Despachar', 'Cancelar pedido']],
  ['EN_PREP', 'TRANSFERENCIA', ['Despachar', 'Cancelar pedido']],
  ['EN_PREP', 'MERCADOPAGO', ['Despachar', 'Cancelar pedido']],
  ['EN_CAMINO', 'EFECTIVO', ['Marcar entregado']],
  ['EN_CAMINO', 'TRANSFERENCIA', ['Marcar entregado']],
  ['EN_CAMINO', 'MERCADOPAGO', ['Marcar entregado']],
  ['ENTREGADO', 'EFECTIVO', []],
  ['ENTREGADO', 'TRANSFERENCIA', []],
  ['ENTREGADO', 'MERCADOPAGO', []],
  ['CANCELADO', 'EFECTIVO', []],
  ['CANCELADO', 'TRANSFERENCIA', []],
  ['CANCELADO', 'MERCADOPAGO', []],
];

const TODAS = ['Confirmar pago', 'Pasar a preparación', 'Despachar', 'Marcar entregado', 'Cancelar pedido'];

describe('Detalle de gestión de pedidos · acciones según estado, forma de pago y rol', () => {
  const rolesDe: [string, string[]][] = [
    ['ADMIN', ['ADMIN']],
    ['PEDIDOS', ['PEDIDOS']],
    ['CLIENT + PEDIDOS', ['CLIENT', 'PEDIDOS']],
  ];

  it.each(rolesDe.flatMap(([nombre, roles]) => ESPERADAS.map(([estado, forma, botones]) => [nombre, roles, estado, forma, botones] as const)))(
    '%s · %s %s: ofrece solo las acciones permitidas',
    async (_nombre, roles, estado, forma, botones) => {
      montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: estado, forma_pago_codigo: forma })], roles: [...roles] });
      await titulo(58);
      const acciones = screen.getByRole('region', { name: 'Acciones' });

      const visibles = TODAS.filter((nombre) => within(acciones).queryByRole('button', { name: nombre }) !== null);

      expect(visibles).toEqual(TODAS.filter((nombre) => botones.includes(nombre)));
    },
  );

  it('un pedido de Mercado Pago pendiente avisa que se confirma solo cuando Mercado Pago aprueba el pago', async () => {
    montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ forma_pago_codigo: 'MERCADOPAGO' })] });
    await titulo(58);

    expect(screen.getByText('Se confirma solo cuando Mercado Pago aprueba el pago')).toBeInTheDocument();
  });

  it('un pedido de efectivo pendiente no muestra ese aviso', async () => {
    montarGestion('/gestion-pedidos/58');
    await titulo(58);

    expect(screen.queryByText('Se confirma solo cuando Mercado Pago aprueba el pago')).toBeNull();
  });

  it.each([
    ['ENTREGADO', 'El pedido ya se entregó: no admite más cambios.'],
    ['CANCELADO', 'El pedido está cancelado: no admite más cambios.'],
  ])('un pedido %s explica que no admite cambios', async (estado, texto) => {
    montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: estado })] });
    await titulo(58);

    expect(screen.getByText(texto)).toBeInTheDocument();
  });
});
