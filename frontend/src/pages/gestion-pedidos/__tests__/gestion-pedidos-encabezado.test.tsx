import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { restablecerViewport, setViewport } from '@/test/viewport';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;

describe('Gestión de pedidos · encabezado fijo (D9)', () => {
  it('título, filtros, conteo y «Actualizar» viven en la banda fija; la lista queda fuera', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido58(), pedido57()] });
    const lista = await screen.findByRole('list', { name: 'Pedidos' });

    expect(banda()).toHaveClass('is-sticky');
    const dentro = within(banda());
    expect(dentro.getByRole('heading', { level: 1, name: 'Gestión de pedidos' })).toBeInTheDocument();
    expect(dentro.getByRole('group', { name: 'Estado' })).toBeInTheDocument();
    expect(dentro.getByLabelText('Desde')).toBeInTheDocument();
    expect(dentro.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(dentro.getByRole('status')).toHaveTextContent('2 pedidos');
    expect(banda()).not.toContainElement(lista);
  });

  it('un chip quitable por filtro aplicado; quitar «Desde» lo saca de la URL y conserva el resto', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos?estado=PENDIENTE&desde=2026-11-18', { pedidos: [pedido58(), pedido57()] });
    const chips = await screen.findByRole('group', { name: 'Filtros aplicados' });

    expect(within(chips).getByText('Pendiente')).toBeInTheDocument();
    expect(within(chips).getByText('Desde 18/11/2026')).toBeInTheDocument();

    await usuario.click(within(chips).getByRole('button', { name: 'Quitar filtro Desde 18/11/2026' }));

    await waitFor(() => expect(router.state.location.search).toBe('?estado=PENDIENTE'));
  });

  it('la lista tiene su encabezado de columnas (se fija bajo la banda por CSS) y los filtros siguen a mano al desplazar', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido58()] });
    await screen.findByRole('list', { name: 'Pedidos' });

    expect(banda()).not.toHaveClass('band-tools-collapse');
    expect(document.querySelector('.orow.ohead')).not.toBeNull();
  });
});

describe('Gestión de pedidos · filtros en mobile (mockup gestion-pedidos, 390 px)', () => {
  afterEach(() => restablecerViewport());

  it('el rango de fechas pasa a un chip «Fechas» que abre una hoja con «Desde» y «Hasta»', async () => {
    act(() => setViewport(390));
    const { router, usuario } = montarGestion('/gestion-pedidos', { pedidos: [pedido58()] });
    await screen.findByRole('list', { name: 'Pedidos' });

    expect(screen.queryByLabelText('Desde')).toBeNull();
    expect(within(banda()).getByRole('group', { name: 'Estado' })).toBeInTheDocument();
    await usuario.click(within(banda()).getByRole('button', { name: 'Fechas' }));

    const hoja = await screen.findByRole('dialog', { name: 'Fechas' });
    await usuario.type(within(hoja).getByLabelText('Desde'), '2026-11-18');

    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-18'));
  });

  it('el chip «Fechas» cuenta las fechas aplicadas', async () => {
    act(() => setViewport(390));
    montarGestion('/gestion-pedidos?desde=2026-11-18&hasta=2026-11-19', { pedidos: [pedido58()] });
    await screen.findByRole('list', { name: 'Pedidos' });

    expect(within(banda()).getByRole('button', { name: /^Fechas/ })).toHaveTextContent('2');
  });
});

describe('Detalle de gestión de pedido · encabezado fijo con acciones (D9)', () => {
  it('Actualizar y las acciones del pedido suben a la banda fija; la ruta de vuelta y el estado también', async () => {
    montarGestion('/gestion-pedidos/58');
    await screen.findByRole('heading', { level: 1, name: /Pedido #58/ });

    expect(banda()).toHaveClass('is-sticky');
    const dentro = within(banda());
    expect(dentro.getByRole('link', { name: 'Volver a pedidos' })).toBeInTheDocument();
    expect(dentro.getByRole('heading', { level: 1 })).toHaveTextContent('Pendiente');
    expect(dentro.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    const acciones = dentro.getByRole('region', { name: 'Acciones' });
    expect(within(acciones).getByRole('button', { name: 'Confirmar pago' })).toBeInTheDocument();
    expect(within(acciones).getByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument();
  });

  it('un pedido entregado deja la banda sin botones de acción y explica que no admite cambios', async () => {
    montarGestion('/gestion-pedidos/58', { pedidos: [pedido58({ estado_codigo: 'ENTREGADO' })] });
    await screen.findByRole('heading', { level: 1, name: /Pedido #58/ });

    const acciones = within(banda()).getByRole('region', { name: 'Acciones' });
    expect(within(acciones).queryByRole('button')).toBeNull();
    expect(acciones).toHaveTextContent('no admite más cambios');
  });
});
