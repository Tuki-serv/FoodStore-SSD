import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { EncabezadoPagina } from '..';

type Callback = (entradas: Array<Pick<IntersectionObserverEntry, 'isIntersecting'>>) => void;
let callback: Callback = () => undefined;
let opciones: IntersectionObserverInit | undefined;
const observados: Element[] = [];
const desconectar = vi.fn();

beforeEach(() => {
  callback = () => undefined;
  opciones = undefined;
  observados.length = 0;
  desconectar.mockClear();
  class ObservadorFalso {
    constructor(cb: Callback, init?: IntersectionObserverInit) {
      callback = cb;
      opciones = init;
    }
    observe(elemento: Element): void {
      observados.push(elemento);
    }
    disconnect = desconectar;
    unobserve(): void {}
  }
  vi.stubGlobal('IntersectionObserver', ObservadorFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty('--band-h');
});

const banda = (): HTMLElement => document.querySelector<HTMLElement>('header.page-band')!;
const cambiarInterseccion = (interseccion: boolean): void => {
  act(() => callback([{ isIntersecting: interseccion }]));
};

describe('EncabezadoPagina: contenido', () => {
  it('muestra título (h1), eyebrow y subtítulo', () => {
    render(<EncabezadoPagina titulo="Catálogo" eyebrow="Tienda" subtitulo="Elegí lo que tengas ganas." />);

    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeInTheDocument();
    expect(screen.getByText('Tienda')).toBeInTheDocument();
    expect(screen.getByText('Elegí lo que tengas ganas.')).toBeInTheDocument();
  });

  it('sin eyebrow, subtítulo ni slots no renderiza regiones vacías', () => {
    render(<EncabezadoPagina titulo="Solo título" />);

    expect(banda().querySelector('.band-sub')).toBeNull();
    expect(banda().querySelector('.eyebrow')).toBeNull();
    expect(banda().querySelector('.band-toolbar')).toBeNull();
    expect(banda().querySelector('.band-active')).toBeNull();
    expect(banda().querySelector('.band-actions')).toBeNull();
  });

  it('renderiza ruta, estado, metadatos, acciones y herramientas en sus slots', () => {
    render(
      <EncabezadoPagina
        titulo="Pedido #5"
        ruta={<a href="/pedidos">Volver a mis pedidos</a>}
        estado={<span>Confirmado</span>}
        metadatos={<span>Actualizado a las 12:41</span>}
        acciones={<button type="button">Actualizar</button>}
        herramientas={<input aria-label="Buscar" />}
      />,
    );

    expect(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('link', { name: 'Volver a mis pedidos' })).toBeInTheDocument();
    expect(within(banda().querySelector<HTMLElement>('.band-h')!).getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('Actualizado a las 12:41')).toBeInTheDocument();
    expect(within(banda().querySelector<HTMLElement>('.band-actions')!).getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(within(banda().querySelector<HTMLElement>('.band-toolbar')!).getByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('sin título (detalle de producto) la banda lleva solo la ruta y ningún h1', () => {
    render(<EncabezadoPagina ruta={<a href="/">Volver al catálogo</a>} />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toBeInTheDocument();
  });

  it('no tiene violaciones de accesibilidad con todos los slots', async () => {
    const { container } = render(
      <main>
        <EncabezadoPagina
          fijo
          titulo="Catálogo"
          eyebrow="Tienda"
          subtitulo="Elegí."
          acciones={<button type="button">Nuevo</button>}
          filtrosActivos={{
            conteo: '3 productos',
            filtros: [{ id: 'a', etiqueta: 'Pizzas', onQuitar: vi.fn() }],
          }}
        />
      </main>,
    );

    await esperarSinViolacionesA11y(container);
  });
});

describe('EncabezadoPagina: foco y herramientas colapsables', () => {
  it('con tituloRef el h1 es enfocable por código (tabindex -1) y la ref apunta a él; sin tituloRef no lo es', () => {
    const ref = { current: null as HTMLHeadingElement | null };
    const { rerender } = render(<EncabezadoPagina titulo="Mis pedidos" tituloRef={ref} />);

    expect(ref.current).toBe(screen.getByRole('heading', { level: 1 }));
    act(() => ref.current?.focus());
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();

    rerender(<EncabezadoPagina titulo="Mis pedidos" />);
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('tabindex');
  });

  it('herramientasColapsables marca la banda para que en mobile compacto las herramientas se oculten; por defecto no', () => {
    const { rerender } = render(<EncabezadoPagina fijo titulo="X" herramientas={<span>filtros</span>} herramientasColapsables />);
    expect(banda()).toHaveClass('band-tools-collapse');

    rerender(<EncabezadoPagina fijo titulo="X" herramientas={<span>filtros</span>} />);
    expect(banda()).not.toHaveClass('band-tools-collapse');
  });
});

describe('EncabezadoPagina: filtros activos', () => {
  const filtros = (quitarA = vi.fn(), quitarB = vi.fn()) => [
    { id: 'categoria', etiqueta: 'Pizzas', onQuitar: quitarA },
    { id: 'precio', etiqueta: 'Hasta $ 5.000', onQuitar: quitarB },
  ];

  it('muestra el conteo con rol status y un chip quitable por filtro', async () => {
    const quitarA = vi.fn();
    const quitarB = vi.fn();
    const user = userEvent.setup();
    render(
      <EncabezadoPagina
        titulo="Catálogo"
        filtrosActivos={{
          conteo: '7 productos',
          filtros: filtros(quitarA, quitarB),
        }}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('7 productos');
    const grupo = screen.getByRole('group', { name: 'Filtros aplicados' });
    expect(within(grupo).getByText('Pizzas')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar filtro Pizzas' }));
    expect(quitarA).toHaveBeenCalledTimes(1);
    expect(quitarB).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Quitar filtro Hasta $ 5.000' }));
    expect(quitarB).toHaveBeenCalledTimes(1);
  });

  it('«Limpiar filtros» aparece con dos o más filtros y llama a su callback', async () => {
    const limpiar = vi.fn();
    const user = userEvent.setup();
    render(
      <EncabezadoPagina
        titulo="Catálogo"
        filtrosActivos={{
          conteo: '7 productos',
          filtros: filtros(),
          onLimpiar: limpiar,
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(limpiar).toHaveBeenCalledTimes(1);
  });

  it('con un solo filtro no ofrece «Limpiar filtros»; sin filtros no hay grupo de chips pero sí conteo', () => {
    const { rerender } = render(
      <EncabezadoPagina
        titulo="X"
        filtrosActivos={{
          conteo: '1 producto',
          filtros: [filtros()[0]!],
          onLimpiar: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();

    rerender(
      <EncabezadoPagina
        titulo="X"
        filtrosActivos={{
          conteo: '9 productos',
          filtros: [],
          onLimpiar: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByRole('group', { name: 'Filtros aplicados' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('9 productos');
  });
});

describe('EncabezadoPagina: fijo y estado compacto', () => {
  it('fijo observa un centinela de alto 0 ubicado justo antes de la banda', () => {
    render(<EncabezadoPagina fijo titulo="Catálogo" />);

    expect(observados).toHaveLength(1);
    expect(observados[0]).toHaveAttribute('aria-hidden', 'true');
    expect(observados[0]?.nextElementSibling).toBe(banda());
    expect(banda()).toHaveClass('is-sticky');
  });

  it('pasa a compacto (data-stuck) cuando el centinela deja de intersectar y vuelve al intersectar', () => {
    render(<EncabezadoPagina fijo titulo="Catálogo" subtitulo="Elegí." />);
    expect(banda()).not.toHaveAttribute('data-stuck');

    cambiarInterseccion(false);
    expect(banda()).toHaveAttribute('data-stuck', 'true');

    cambiarInterseccion(true);
    expect(banda()).not.toHaveAttribute('data-stuck');
  });

  it('descuenta el top de la banda de la raíz del observador', () => {
    render(<EncabezadoPagina fijo titulo="Catálogo" />);

    expect(opciones?.rootMargin).toBe('0px 0px 0px 0px');
  });

  it('bajo la barra superior (top 56 px) el observador recorta esos 56 px y --band-h suma el top', () => {
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((elemento, pseudo) => {
      const estilo = real(elemento, pseudo);
      return elemento.classList.contains('page-band') ? ({ ...estilo, top: '56px' } as CSSStyleDeclaration) : estilo;
    });

    render(<EncabezadoPagina fijo titulo="Catálogo" />);

    expect(opciones?.rootMargin).toBe('-56px 0px 0px 0px');
    expect(document.documentElement.style.getPropertyValue('--band-h')).toBe('56px');
    vi.restoreAllMocks();
  });

  it('con fijo en falso no es sticky, no observa nada y no marca compacto', () => {
    render(<EncabezadoPagina titulo="Detalle" />);

    expect(banda()).not.toHaveClass('is-sticky');
    expect(observados).toHaveLength(0);
    expect(banda().previousElementSibling).toBeNull();
    expect(banda()).not.toHaveAttribute('data-stuck');
  });

  it('con fijo publica el alto de la banda en --band-h y lo quita al desmontar', () => {
    const { unmount } = render(<EncabezadoPagina fijo titulo="Catálogo" />);
    expect(document.documentElement.style.getPropertyValue('--band-h')).toBe('0px');

    unmount();

    expect(document.documentElement.style.getPropertyValue('--band-h')).toBe('');
    expect(desconectar).toHaveBeenCalled();
  });

  it('sin fijo no publica --band-h', () => {
    render(<EncabezadoPagina titulo="Detalle" />);

    expect(document.documentElement.style.getPropertyValue('--band-h')).toBe('');
  });

  it('sin IntersectionObserver (entorno viejo) no falla y queda en estado expandido', () => {
    vi.stubGlobal('IntersectionObserver', undefined);

    render(<EncabezadoPagina fijo titulo="Catálogo" />);

    expect(banda()).not.toHaveAttribute('data-stuck');
  });
});
