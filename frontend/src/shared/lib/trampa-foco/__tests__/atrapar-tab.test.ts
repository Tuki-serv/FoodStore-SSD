import { afterEach, describe, expect, it, vi } from 'vitest';
import { atraparTab } from '../atrapar-tab';

function montar(): { contenedor: HTMLElement; a: HTMLElement; b: HTMLElement; c: HTMLElement } {
  document.body.innerHTML =
    '<div id="contenedor" tabindex="-1"><button id="a">A</button><button id="b">B</button><button id="c">C</button></div>';
  const buscar = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
  return { contenedor: buscar('contenedor'), a: buscar('a'), b: buscar('b'), c: buscar('c') };
}

const tecla = (key: string, shiftKey = false) => ({ key, shiftKey, preventDefault: vi.fn() });

describe('atraparTab', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Tab en el último enfocable lleva el foco al primero y cancela el comportamiento por defecto', () => {
    const { contenedor, a, c } = montar();
    c.focus();
    const evento = tecla('Tab');

    atraparTab(evento, contenedor);

    expect(a).toHaveFocus();
    expect(evento.preventDefault).toHaveBeenCalledOnce();
  });

  it('Shift+Tab en el primero lleva el foco al último', () => {
    const { contenedor, a, c } = montar();
    a.focus();
    const evento = tecla('Tab', true);

    atraparTab(evento, contenedor);

    expect(c).toHaveFocus();
    expect(evento.preventDefault).toHaveBeenCalledOnce();
  });

  it('Shift+Tab en el propio contenedor lleva el foco al último', () => {
    const { contenedor, c } = montar();
    contenedor.focus();

    atraparTab(tecla('Tab', true), contenedor);

    expect(c).toHaveFocus();
  });

  it('Tab en un enfocable intermedio no interviene', () => {
    const { contenedor, b } = montar();
    b.focus();
    const evento = tecla('Tab');

    atraparTab(evento, contenedor);

    expect(b).toHaveFocus();
    expect(evento.preventDefault).not.toHaveBeenCalled();
  });

  it('otras teclas no intervienen aunque el foco esté en el último', () => {
    const { contenedor, c } = montar();
    c.focus();
    const evento = tecla('Enter');

    atraparTab(evento, contenedor);

    expect(c).toHaveFocus();
    expect(evento.preventDefault).not.toHaveBeenCalled();
  });

  it('sin enfocables cancela Tab para que el foco no escape', () => {
    document.body.innerHTML = '<div id="vacio" tabindex="-1"></div>';
    const evento = tecla('Tab');

    atraparTab(evento, document.getElementById('vacio') as HTMLElement);

    expect(evento.preventDefault).toHaveBeenCalledOnce();
  });
});
