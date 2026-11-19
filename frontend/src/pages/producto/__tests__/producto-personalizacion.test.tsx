import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCartStore } from '@/entities/cart';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { productoDto } from '@/test/msw/catalogo';
import { montarCatalogo } from '@/test/render-catalogo';
import { setViewport } from '@/test/viewport';

const ingrediente = (id: number, nombre: string, es_removible: boolean, es_alergeno = false) => ({
  id,
  nombre,
  es_alergeno,
  es_removible,
  cantidad: '1.000',
  unidad_medida_id: 1,
});

const hamburguesa = productoDto({
  id: 1,
  nombre: 'Hamburguesa Clásica',
  precio_base: '1500.00',
  stock_cantidad: 50,
  ingredientes: [ingrediente(5, 'Pan Brioche', false), ingrediente(11, 'Cebolla', true), ingrediente(12, 'Tomate', true)],
});

const titulo = (nombre: string) => screen.findByRole('heading', { name: nombre, level: 1 });
const grupo = () => screen.getByRole('group', { name: 'Personalizá tu pedido' });
const agregar = () => screen.getByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' });
const montar = (opciones: Parameters<typeof montarCatalogo>[1] = {}) =>
  montarCatalogo('/catalogo/1', { productos: [hamburguesa], sesion: { roles: ['CLIENT'] }, ...opciones });

describe('detalle: personalización', () => {
  it('muestra «Personalizá tu pedido» con una casilla «Sin X» por ingrediente removible, sin marcar, y ninguna para los no removibles', async () => {
    montar();
    await titulo('Hamburguesa Clásica');

    const casillas = within(grupo()).getAllByRole('checkbox');
    expect(casillas.map((casilla) => (casilla as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Sin Cebolla', 'Sin Tomate']);
    expect(casillas.every((casilla) => !(casilla as HTMLInputElement).checked)).toBe(true);
    expect(screen.queryByRole('checkbox', { name: 'Sin Pan Brioche' })).not.toBeInTheDocument();
  });

  it('un producto sin ingredientes removibles no muestra la sección', async () => {
    montar({ productos: [productoDto({ id: 1, nombre: 'Hamburguesa Clásica', ingredientes: [ingrediente(5, 'Pan', false)] })] });
    await titulo('Hamburguesa Clásica');

    expect(screen.queryByRole('group', { name: 'Personalizá tu pedido' })).not.toBeInTheDocument();
  });

  it('un producto agotado no muestra la sección', async () => {
    montar({ productos: [{ ...hamburguesa, stock_cantidad: 0 }] });
    await titulo('Hamburguesa Clásica');

    expect(screen.queryByRole('group', { name: 'Personalizá tu pedido' })).not.toBeInTheDocument();
  });

  it('marcar «Sin Cebolla» y agregar guarda la exclusión con su nombre y avisa con la personalización', async () => {
    const { usuario } = montar();
    await titulo('Hamburguesa Clásica');

    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));
    await usuario.click(agregar());

    const [linea] = useCartStore.getState().lineas;
    expect(linea?.personalizacion).toEqual([11]);
    expect(linea?.personalizacionNombres).toEqual(['Cebolla']);
    expect(await screen.findByText('1 × Hamburguesa Clásica, sin cebolla')).toBeInTheDocument();
  });

  it('repetir con la misma casilla suma a la misma línea y las casillas siguen marcadas', async () => {
    const { usuario } = montar();
    await titulo('Hamburguesa Clásica');
    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));

    await usuario.click(agregar());
    await usuario.click(agregar());

    expect(useCartStore.getState().lineas).toHaveLength(1);
    expect(useCartStore.getState().lineas[0]?.cantidad).toBe(2);
    expect(screen.getByRole('checkbox', { name: 'Sin Cebolla' })).toBeChecked();
  });

  it('desmarcar y agregar crea una segunda línea sin exclusiones', async () => {
    const { usuario } = montar();
    await titulo('Hamburguesa Clásica');
    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));
    await usuario.click(agregar());

    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));
    await usuario.click(agregar());

    expect(useCartStore.getState().lineas.map((linea) => linea.personalizacion)).toEqual([[11], []]);
  });

  it('dos exclusiones se avisan juntas: «sin cebolla, sin tomate»', async () => {
    const { usuario } = montar();
    await titulo('Hamburguesa Clásica');

    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Tomate' }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));
    await usuario.click(agregar());

    expect(await screen.findByText('1 × Hamburguesa Clásica, sin cebolla, sin tomate')).toBeInTheDocument();
  });

  it('un alérgeno removible tiene casilla y sigue en «Contiene alérgenos»', async () => {
    montar({ productos: [{ ...hamburguesa, ingredientes: [ingrediente(7, 'Queso', true, true)] }] });
    await titulo('Hamburguesa Clásica');

    expect(screen.getByRole('checkbox', { name: 'Sin Queso' })).toBeInTheDocument();
    expect(screen.getByText('Contiene alérgenos: Queso')).toBeInTheDocument();
  });

  it('sin sesión, con una casilla marcada, «Agregar» lleva a /ingresar y el carrito queda vacío', async () => {
    const { router, usuario } = montar({ sesion: undefined });
    await titulo('Hamburguesa Clásica');

    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));
    await usuario.click(agregar());

    expect(await titulo('Ingresar')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(useCartStore.getState().lineas).toEqual([]);
  });

  it('en mobile la sección se ve y hay un solo botón «Agregar al carrito»', async () => {
    act(() => setViewport(390));
    montar();
    await titulo('Hamburguesa Clásica');

    expect(grupo()).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Agregar Hamburguesa Clásica al carrito' })).toHaveLength(1);
  });

  it('no tiene violaciones de accesibilidad con una casilla marcada', async () => {
    const { usuario } = montar();
    await titulo('Hamburguesa Clásica');
    await usuario.click(screen.getByRole('checkbox', { name: 'Sin Cebolla' }));

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Sin Cebolla' })).toBeChecked());
    await esperarSinViolacionesA11y(screen.getByRole('main'));
  });
});
