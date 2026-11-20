import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { pedidoDto } from '@/test/msw/pedidos';
import { montarGestion, pedido57, pedido58 } from '@/test/render-gestion';

const TITULO = 'Gestión de pedidos';

/** `cantidad` pedidos pendientes con ids 1..cantidad, el 1 más viejo (así el listado muestra primero el de id más alto). */
const pedidosEnMasa = (cantidad: number) =>
  Array.from({ length: cantidad }, (_, indice) => pedidoDto({ id: indice + 1, cliente_nombre: `Cliente ${indice + 1}`, created_at: new Date(Date.UTC(2026, 10, 19, 12, 0, indice)).toISOString() }));

const filas = async () => within(await screen.findByRole('list', { name: 'Pedidos' })).getAllByRole('listitem');

describe('Listado de gestión de pedidos · filtros', () => {
  const variados = () => [
    pedido58(),
    pedido57({ estado_codigo: 'EN_PREP' }),
    pedidoDto({ id: 56, estado_codigo: 'EN_PREP', cliente_nombre: 'Carmen Vega', created_at: '2026-11-19T15:22:00Z' }),
  ];

  it('elegir «En preparación» deja estado=EN_PREP en la URL y lista solo esos pedidos', async () => {
    const { router, usuario, estado } = montarGestion('/gestion-pedidos', { pedidos: variados() });
    await screen.findByRole('heading', { name: TITULO, level: 1 });
    expect(await filas()).toHaveLength(3);

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'En preparación');

    await waitFor(async () => expect(await filas()).toHaveLength(2));
    expect(router.state.location.search).toBe('?estado=EN_PREP');
    expect(estado.consultasLista.at(-1)).toEqual({ estado: 'EN_PREP', page: '1', size: '20' });
    expect((await filas()).map((fila) => fila.textContent)).toEqual([expect.stringContaining('#57'), expect.stringContaining('#56')]);
  });

  it('elegir fechas deja desde y hasta en la URL y el servidor las recibe', async () => {
    const { router, estado } = montarGestion('/gestion-pedidos', { pedidos: variados() });
    await screen.findByRole('heading', { name: TITULO, level: 1 });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-18' } });
    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-18'));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-19' } });

    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-18&hasta=2026-11-19'));
    await waitFor(() => expect(estado.consultasLista.at(-1)).toEqual({ desde: '2026-11-18', hasta: '2026-11-19', page: '1', size: '20' }));
  });

  it('un rango invertido muestra el error, no cambia la URL y no se pide al servidor', async () => {
    const { router, estado } = montarGestion('/gestion-pedidos?desde=2026-11-18', { pedidos: variados() });
    await screen.findByRole('heading', { name: TITULO, level: 1 });
    expect(await filas()).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-20' } });
    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-18&hasta=2026-11-20'));
    await waitFor(() => expect(estado.consultasLista.at(-1)).toMatchObject({ hasta: '2026-11-20' }));
    const pedidosHechos = estado.consultasLista.length;

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-17' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha "Desde" no puede ser posterior a "Hasta"');
    expect(screen.getByLabelText('Desde')).toHaveAttribute('aria-invalid', 'true');
    expect(router.state.location.search).toBe('?desde=2026-11-18&hasta=2026-11-20');
    expect(estado.consultasLista).toHaveLength(pedidosHechos);
    expect(await filas()).toHaveLength(3);
  });

  it('corregir el rango quita el error y aplica el filtro', async () => {
    const { router } = montarGestion('/gestion-pedidos', { pedidos: variados() });
    await screen.findByRole('heading', { name: TITULO, level: 1 });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-19' } });
    await waitFor(() => expect(router.state.location.search).toBe('?desde=2026-11-19'));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-18' } });
    await screen.findByRole('alert');

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-20' } });

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(router.state.location.search).toBe('?desde=2026-11-19&hasta=2026-11-20');
  });

  it('abrir con ?estado=PENDIENTE precarga el filtro y lista solo pendientes', async () => {
    const { estado } = montarGestion('/gestion-pedidos?estado=PENDIENTE', { pedidos: variados() });

    const listado = await filas();

    expect(listado).toHaveLength(1);
    expect(listado[0]).toHaveTextContent('#58');
    expect(screen.getByLabelText('Estado')).toHaveValue('PENDIENTE');
    expect(estado.consultasLista[0]).toEqual({ estado: 'PENDIENTE', page: '1', size: '20' });
  });

  it('los filtros tienen etiquetas visibles y avisan que las fechas son del día UTC del servidor', async () => {
    montarGestion('/gestion-pedidos');
    await screen.findByRole('heading', { name: TITULO, level: 1 });

    expect(screen.getByLabelText('Estado')).toBeVisible();
    expect(screen.getByLabelText('Desde')).toBeVisible();
    expect(screen.getByLabelText('Hasta')).toBeVisible();
    expect(screen.getByText('Fechas según el día del servidor (UTC)')).toBeInTheDocument();
  });

  it('«Limpiar filtros» quita todo de la URL y vuelve a listar todos', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos?estado=EN_PREP&desde=2026-11-18&page=1', { pedidos: variados() });
    await screen.findByRole('heading', { name: TITULO, level: 1 });

    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByLabelText('Estado')).toHaveValue('');
    expect(screen.getByLabelText('Desde')).toHaveValue('');
    await waitFor(async () => expect(await filas()).toHaveLength(3));
  });
});

describe('Listado de gestión de pedidos · paginación', () => {
  it('con 45 pedidos, la página 3 muestra 5 filas y deja page=3 en la URL', async () => {
    const { estado } = montarGestion('/gestion-pedidos?page=3', { pedidos: pedidosEnMasa(45) });

    const listado = await filas();

    expect(listado).toHaveLength(5);
    expect(listado[0]).toHaveTextContent('#5');
    expect(estado.consultasLista[0]).toEqual({ page: '3', size: '20' });
    expect(screen.getByText('Página 3 de 3')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 41–45 de 45')).toBeInTheDocument();
  });

  it('«Siguiente» y «Anterior» cambian de página y la URL', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos', { pedidos: pedidosEnMasa(45) });
    expect(await filas()).toHaveLength(20);

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    await screen.findByText('Página 2 de 3');
    await usuario.click(screen.getByRole('button', { name: 'Anterior' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('cambiar un filtro vuelve a la página 1', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos?page=3', { pedidos: pedidosEnMasa(45) });
    await filas();

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Pendiente');

    await waitFor(() => expect(router.state.location.search).toBe('?estado=PENDIENTE'));
  });
});

describe('Listado de gestión de pedidos · estados', () => {
  it('mientras carga por primera vez muestra un esqueleto', async () => {
    montarGestion('/gestion-pedidos');

    expect(await screen.findByRole('status', { name: 'Cargando pedidos' })).toBeInTheDocument();
    await filas();
    expect(screen.queryByRole('status', { name: 'Cargando pedidos' })).toBeNull();
  });

  it('sin pedidos y sin filtros dice «Todavía no hay pedidos»', async () => {
    montarGestion('/gestion-pedidos', { pedidos: [] });

    expect(await screen.findByRole('heading', { name: 'Todavía no hay pedidos' })).toBeInTheDocument();
  });

  it('sin resultados con filtros ofrece «Limpiar filtros» que vuelve a listar todos', async () => {
    const { router, usuario } = montarGestion('/gestion-pedidos?estado=ENTREGADO', { pedidos: [pedido58()] });

    expect(await screen.findByRole('heading', { name: 'No hay pedidos con estos filtros' })).toBeInTheDocument();
    await usuario.click(screen.getAllByRole('button', { name: 'Limpiar filtros' }).at(-1) as HTMLElement);

    expect(await filas()).toHaveLength(1);
    expect(router.state.location.search).toBe('');
  });

  it('un 500 muestra el error con «Reintentar», que vuelve a pedir el listado', async () => {
    const { estado, usuario } = montarGestion('/gestion-pedidos', { estado: { fallos: { lista: { status: 500, detail: 'Ocurrió un error inesperado. Probá de nuevo.' } } } });

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los pedidos' })).toBeInTheDocument();
    expect(screen.getByText('Ocurrió un error inesperado. Probá de nuevo.')).toBeInTheDocument();
    const intentos = estado.consultasLista.length;
    delete estado.fallos.lista;
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await filas()).toHaveLength(2);
    expect(estado.consultasLista.length).toBeGreaterThan(intentos);
  });

  it('sin conexión muestra el mensaje de red', async () => {
    montarGestion('/gestion-pedidos', { estado: { fallos: { lista: 'red' } } });

    expect(await screen.findByText('No pudimos conectar con el servidor.')).toBeInTheDocument();
  });
});

describe('Listado de gestión de pedidos · accesibilidad', () => {
  it('no tiene violaciones con datos', async () => {
    montarGestion('/gestion-pedidos');
    await filas();

    await esperarSinViolacionesA11y(document.body);
  });

  it('no tiene violaciones con el error de rango', async () => {
    montarGestion('/gestion-pedidos');
    await filas();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-19' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-18' } });
    await screen.findByRole('alert');

    await esperarSinViolacionesA11y(document.body);
  });
});
