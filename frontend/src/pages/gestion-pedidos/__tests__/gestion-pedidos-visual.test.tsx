import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { pedidoDto } from '@/test/msw/pedidos';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';
import { AccionFila } from '../ui/accion-fila';

// Estructura del mockup aprobado `mockups/gestion-pedidos.html`: columnas, fila compacta, pago como texto y acción neutra.
const clasesDeCeldas = (fila: Element): string[] => Array.from(fila.children).map((celda) => celda.className);

describe('Gestión de pedidos · columnas y filas según el mockup', () => {
  it('el encabezado de columnas es Pedido / Estado / Cliente / Forma de pago / Total / Próxima acción', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido58()] });
    await screen.findByRole('list', { name: 'Pedidos' });

    const cabecera = document.querySelector('.orow.ohead')!;
    expect(Array.from(cabecera.children).map((celda) => celda.textContent)).toEqual(['Pedido', 'Estado', 'Cliente', 'Forma de pago', 'Total', 'Próxima acción']);
  });

  it('las celdas de cada fila siguen el mismo orden que el encabezado', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido58(), pedido57()] });
    const lista = await screen.findByRole('list', { name: 'Pedidos' });

    for (const fila of within(lista).getAllByRole('listitem')) expect(clasesDeCeldas(fila)).toEqual(['onum', 'ostate', 'ocli', 'opay', 'ototal', 'oact']);
  });

  it('la forma de pago es texto plano, sin ícono ni énfasis', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [pedido58(), pedido57()] });
    const lista = await screen.findByRole('list', { name: 'Pedidos' });

    const pagos = Array.from(lista.querySelectorAll('.opay'));
    expect(pagos.map((celda) => celda.textContent)).toEqual(['Efectivo', 'Tarjeta (Mercado Pago)']);
    for (const celda of pagos) expect(celda.querySelector('svg, .pay-lbl')).toBeNull();
  });
});

describe('Gestión de pedidos · «Próxima acción» como botón neutro', () => {
  const avanzar = (estado: 'PENDIENTE' | 'CONFIRMADO' | 'EN_PREP', forma = 'EFECTIVO') => {
    render(
      <MemoryRouter>
        <AccionFila pedido={pedidoDto({ id: 5, estado_codigo: estado, forma_pago_codigo: forma })} onAccion={vi.fn()} />
      </MemoryRouter>,
    );
    return screen.getByRole('button');
  };

  it.each([
    ['PENDIENTE', 'Confirmar pago el pedido #5'],
    ['CONFIRMADO', 'Pasar a preparación el pedido #5'],
    ['EN_PREP', 'Despachar el pedido #5'],
  ] as const)('desde %s el botón «%s» es secundario neutro: borde de divisor, sin naranja y sin ícono', (estado, nombre) => {
    const boton = avanzar(estado);

    expect(boton).toHaveAccessibleName(nombre);
    expect(boton.className).toContain('border-border');
    expect(boton.className).not.toMatch(/primary/);
    expect(boton.querySelector('svg')).toBeNull();
  });
});
