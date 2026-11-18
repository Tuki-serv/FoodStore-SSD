import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { esperarSinViolacionesA11y } from '@/test/axe';
import {
  crearEstadoAdminCatalogo,
  ingredientesSeed,
  pedidosAdmin,
  pedidosDeEscritura,
  respuestaError,
  type IngredienteDto,
} from '@/test/msw/admin-catalogo';
import { API, server } from '@/test/msw/server';
import { esperarTitulo, montarAdmin } from '@/test/render-admin';

/** 30 ingredientes sin alérgeno (de «Extra 1» a «Extra 30») más los dos alérgenos del seed: da dos páginas con cualquier filtro. */
function ingredientesDeSobra(): IngredienteDto[] {
  const base = ingredientesSeed[0] as IngredienteDto;
  const extras = Array.from({ length: 30 }, (_, i): IngredienteDto => ({ ...base, id: 100 + i, nombre: `Extra ${i + 1}`, es_alergeno: false, productos: [] }));
  return [...ingredientesSeed.filter((i) => i.es_alergeno), ...extras];
}

const busquedas = (estado: ReturnType<typeof crearEstadoAdminCatalogo>): string[] => pedidosAdmin(estado, 'GET', '/ingredientes/').map((p) => p.busqueda);

describe('AdminIngredientesPage: listado del seed', () => {
  it('un ADMIN ve «Pan Brioche» con «Alérgeno», su unidad y «Usado en 3 productos», y «Lechuga» sin marca', async () => {
    montarAdmin('/admin/ingredientes');

    await esperarTitulo('Ingredientes');
    const pan = await screen.findByRole('group', { name: 'Pan Brioche' });
    expect(within(pan).getByText('Alérgeno')).toBeInTheDocument();
    expect(pan).toHaveTextContent('Unidad (u)');
    expect(pan).toHaveTextContent('Usado en 3 productos');
    expect(pan).toHaveTextContent('Pan suave y esponjoso');
    const lechuga = screen.getByRole('group', { name: 'Lechuga' });
    expect(within(lechuga).queryByText('Alérgeno')).not.toBeInTheDocument();
  });

  it('muestra el total, usa el singular con un producto, «Sin productos» sin ninguno y el botón «Nuevo ingrediente»', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.ingredientes.push({ ...(ingredientesSeed[0] as IngredienteDto), id: 50, nombre: 'Huevo', es_alergeno: false, productos: [] });
    montarAdmin('/admin/ingredientes', { estado });

    expect(await screen.findByRole('group', { name: 'Huevo' })).toHaveTextContent('Sin productos');
    expect(screen.getByRole('group', { name: 'Mayonesa' })).toHaveTextContent('Usado en 1 producto');
    expect(screen.getByRole('status')).toHaveTextContent('13 ingredientes');
    expect(screen.getByRole('button', { name: 'Nuevo ingrediente' })).toBeInTheDocument();
  });

  it('si el servidor no informa la unidad del ingrediente (contrato actual del backend) la fila funciona sin mostrarla', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.ingredientes = estado.ingredientes.map(({ unidad_medida_id: _omitida, ...resto }) => (void _omitida, resto) as IngredienteDto);
    montarAdmin('/admin/ingredientes', { estado });

    const pan = await screen.findByRole('group', { name: 'Pan Brioche' });

    expect(pan).toHaveTextContent('Usado en 3 productos');
    expect(pan).not.toHaveTextContent('Unidad (u)');
  });
});

describe('AdminIngredientesPage: filtro y paginación en la URL', () => {
  it('«Alérgenos» pide is_alergeno=true desde la página 1 y guarda el filtro en la URL', async () => {
    const { estado, usuario, router } = montarAdmin('/admin/ingredientes');
    await screen.findByRole('group', { name: 'Lechuga' });

    await usuario.click(screen.getByRole('button', { name: 'Alérgenos' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Lechuga' })).not.toBeInTheDocument());
    expect(busquedas(estado).at(-1)).toBe('?page=1&size=20&is_alergeno=true');
    expect(router.state.location.search).toBe('?alergeno=si');
    expect(screen.getByRole('button', { name: 'Alérgenos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('3 ingredientes alérgenos');
  });

  it('«No alérgenos» pide is_alergeno=false y volver a «Todos» limpia la URL', async () => {
    const { estado, usuario, router } = montarAdmin('/admin/ingredientes');
    await screen.findByRole('group', { name: 'Lechuga' });

    await usuario.click(screen.getByRole('button', { name: 'No alérgenos' }));
    await waitFor(() => expect(busquedas(estado).at(-1)).toBe('?page=1&size=20&is_alergeno=false'));
    expect(router.state.location.search).toBe('?alergeno=no');
    await usuario.click(screen.getByRole('button', { name: 'Todos' }));

    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('abrir con ?alergeno=no&page=2 respeta el filtro y la página', async () => {
    const estado = crearEstadoAdminCatalogo({ ingredientes: ingredientesDeSobra() });
    montarAdmin('/admin/ingredientes?alergeno=no&page=2', { estado });

    expect(await screen.findByRole('group', { name: 'Extra 30' })).toBeInTheDocument();
    expect(busquedas(estado)[0]).toBe('?page=2&size=20&is_alergeno=false');
    expect(screen.getByRole('button', { name: 'No alérgenos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('navigation', { name: 'Paginación de ingredientes' })).toHaveTextContent('Página 2 de 2');
  });

  it('«Siguiente» y «Anterior» cambian de página y la guardan en la URL; cambiar el filtro vuelve a la página 1', async () => {
    const estado = crearEstadoAdminCatalogo({ ingredientes: ingredientesDeSobra() });
    const { usuario, router } = montarAdmin('/admin/ingredientes', { estado });
    await screen.findByRole('group', { name: 'Pan Brioche' });

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('group', { name: 'Extra 30' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    await usuario.click(screen.getByRole('button', { name: 'No alérgenos' }));

    await waitFor(() => expect(router.state.location.search).toBe('?alergeno=no'));
    expect(await screen.findByRole('group', { name: 'Extra 1' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginación de ingredientes' })).toHaveTextContent('Página 1 de 2');
  });

  it('con parámetros inválidos en la URL usa «Todos» y la página 1', async () => {
    const estado = crearEstadoAdminCatalogo();
    montarAdmin('/admin/ingredientes?alergeno=quizas&page=-3', { estado });

    await screen.findByRole('group', { name: 'Lechuga' });

    expect(busquedas(estado)[0]).toBe('?page=1&size=20');
  });
});

describe('AdminIngredientesPage: carga, vacío y error', () => {
  it('mientras carga muestra el esqueleto con aria-busy y luego el listado', async () => {
    const estado = crearEstadoAdminCatalogo();
    estado.demoras.GET = 150;
    montarAdmin('/admin/ingredientes', { estado });

    expect(await screen.findByRole('status', { name: 'Cargando ingredientes' })).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
  });

  it('el filtro «Alérgenos» sin resultados muestra «No hay ingredientes alérgenos» y «Ver todos» vuelve al listado', async () => {
    const estado = crearEstadoAdminCatalogo({ ingredientes: ingredientesSeed.filter((i) => !i.es_alergeno) });
    const { usuario, router } = montarAdmin('/admin/ingredientes', { estado });
    await screen.findByRole('group', { name: 'Lechuga' });

    await usuario.click(screen.getByRole('button', { name: 'Alérgenos' }));

    expect(await screen.findByRole('heading', { name: 'No hay ingredientes alérgenos' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?alergeno=si');
    await usuario.click(screen.getByRole('button', { name: 'Ver todos' }));
    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('sin ningún ingrediente y sin filtro muestra «Todavía no hay ingredientes» con un único «Nuevo ingrediente»', async () => {
    montarAdmin('/admin/ingredientes', { estado: crearEstadoAdminCatalogo({ ingredientes: [] }) });

    expect(await screen.findByRole('heading', { name: 'Todavía no hay ingredientes' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nuevo ingrediente' })).toHaveLength(1);
  });

  it('si el pedido falla muestra el error y «Reintentar» vuelve a pedir el listado', async () => {
    const estado = crearEstadoAdminCatalogo();
    const { usuario } = montarAdmin('/admin/ingredientes', { estado });
    server.use(http.get(`${API}/ingredientes/`, () => respuestaError(500, 'HTTP_500', 'Error del servidor'), { once: true }));

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los ingredientes' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Error del servidor');
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('group', { name: 'Lechuga' })).toBeInTheDocument();
    expect(busquedas(estado)).toHaveLength(1);
  });
});

describe('AdminIngredientesPage: permisos y accesibilidad', () => {
  it.each([['STOCK'], ['CLIENT']])('un usuario %s ve la página de acceso denegado y no se envía ningún pedido', async (rol) => {
    const { estado } = montarAdmin('/admin/ingredientes', { roles: [rol] });

    expect(await screen.findByRole('heading', { name: 'No tenés acceso a esta sección' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo ingrediente' })).not.toBeInTheDocument();
    expect(pedidosDeEscritura(estado)).toEqual([]);
    expect(estado.pedidos).toEqual([]);
  });

  it('la página con datos no tiene violaciones de accesibilidad', async () => {
    montarAdmin('/admin/ingredientes');
    await screen.findByRole('group', { name: 'Lechuga' });

    await waitFor(() => esperarSinViolacionesA11y(document.body));
  });
});
