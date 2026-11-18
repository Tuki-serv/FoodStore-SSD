import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { abrirSesion } from '@/entities/session';
import { useAuthStore } from '@/shared/auth';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { handlerMe } from '@/test/msw/auth';
import { direccionDto, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { esperarPagina, montarDirecciones } from '@/test/render-direcciones';

const casa = direccionDto({
  id: 1,
  alias: 'Casa',
  linea1: 'Av. San Martín 1234',
  linea2: 'piso 3, depto. B',
  ciudad: 'Mendoza',
  provincia: 'Mendoza',
  codigo_postal: '5500',
  es_principal: true,
});
const trabajo = direccionDto({ id: 2, alias: 'Trabajo', linea1: 'Belgrano 455', ciudad: 'Godoy Cruz', provincia: 'Mendoza', codigo_postal: '5501' });

const items = () => within(screen.getByRole('list', { name: 'Tus direcciones' })).getAllByRole('listitem');

describe('página Direcciones: listado', () => {
  it('muestra las dos direcciones en orden y marca «Principal» solo en «Casa»', async () => {
    montarDirecciones([trabajo, casa]);

    await screen.findByText('Casa');

    const [primera, segunda] = items();
    expect(primera).toHaveTextContent('Casa');
    expect(primera).toHaveTextContent('Principal');
    expect(primera).toHaveTextContent('Av. San Martín 1234, piso 3, depto. B');
    expect(primera).toHaveTextContent('Mendoza, Mendoza · CP 5500');
    expect(segunda).toHaveTextContent('Trabajo');
    expect(segunda).not.toHaveTextContent('Principal');
    expect(items()).toHaveLength(2);
  });

  it('una dirección sin opcionales muestra «Sin alias», la línea 1 y la ciudad sin separadores sueltos', async () => {
    montarDirecciones([direccionDto({ id: 3, linea1: 'Ruta 40 km 3200', ciudad: 'Luján de Cuyo', es_principal: true })]);
    await screen.findByText('Ruta 40 km 3200');

    const [tarjeta] = items();

    expect(tarjeta).toHaveTextContent('Sin alias');
    expect(tarjeta?.textContent).toContain('Ruta 40 km 3200');
    expect(tarjeta?.textContent).toContain('Luján de Cuyo');
    expect(tarjeta?.textContent).not.toContain('·');
    expect(tarjeta?.textContent).not.toContain('CP');
    expect(tarjeta?.textContent).not.toMatch(/,\s*(,|$)/);
  });

  it('sin direcciones muestra el estado vacío con «Agregar dirección»', async () => {
    montarDirecciones([]);

    expect(await screen.findByRole('heading', { name: 'Todavía no tenés direcciones' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Agregar dirección' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('list', { name: 'Tus direcciones' })).not.toBeInTheDocument();
  });

  it('mientras carga muestra un indicador con aria-busy', async () => {
    const { estado } = montarDirecciones([casa]);
    estado.demoras.GET = 150;
    await esperarPagina();

    expect(await screen.findByRole('status', { name: 'Cargando direcciones' })).toHaveAttribute('aria-busy', 'true');
    await screen.findByText('Casa');
    expect(screen.queryByRole('status', { name: 'Cargando direcciones' })).not.toBeInTheDocument();
  });

  it('un 503 muestra el error y «Reintentar» trae la dirección cuando la siguiente responde 200', async () => {
    let llamadas = 0;
    const { usuario } = montarDirecciones([]);
    server.use(
      http.get(`${API}/direcciones/`, () => {
        llamadas += 1;
        return llamadas === 1
          ? new HttpResponse(null, { status: 503 })
          : HttpResponse.json({ items: [casa], total: 1, page: 1, size: 20, pages: 1 });
      }),
    );
    await esperarPagina();

    expect(await screen.findByText('No pudimos cargar tus direcciones')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Casa')).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar tus direcciones')).not.toBeInTheDocument();
  });
});

describe('página Direcciones: paginación', () => {
  const muchas = Array.from({ length: 25 }, (_, i) => direccionDto({ id: i + 1, alias: `Dir ${i + 1}`, es_principal: i === 0 }));

  it('con 25 direcciones «Siguiente» pide page=2&size=20 y muestra la 21', async () => {
    const { estado, usuario } = montarDirecciones(muchas);
    await screen.findByText('Dir 1');
    expect(items()).toHaveLength(20);

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Dir 21')).toBeInTheDocument();
    expect(pedidosDe(estado, 'GET', '/').map((p) => p.busqueda)).toEqual(['?page=1&size=20', '?page=2&size=20']);
    expect(items()).toHaveLength(5);
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('con la página en la URL pide esa página, y «Anterior» vuelve a la primera', async () => {
    const { estado, usuario } = montarDirecciones(muchas, '/direcciones?page=2');

    expect(await screen.findByText('Dir 21')).toBeInTheDocument();
    expect(pedidosDe(estado, 'GET', '/')[0]?.busqueda).toBe('?page=2&size=20');
    await usuario.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(await screen.findByText('Dir 1')).toBeInTheDocument();
  });

  it('un parámetro page inválido se trata como la página 1', async () => {
    const { estado } = montarDirecciones(muchas, '/direcciones?page=abc');

    await screen.findByText('Dir 1');

    expect(pedidosDe(estado, 'GET', '/')[0]?.busqueda).toBe('?page=1&size=20');
  });

  it('con una sola página no hay controles de paginación', async () => {
    montarDirecciones([casa, trabajo]);
    await screen.findByText('Casa');

    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
  });

  it('mientras llega la página 2 siguen visibles las de la 1', async () => {
    const { estado, usuario } = montarDirecciones(muchas);
    await screen.findByText('Dir 1');
    estado.demoras.GET = 200;

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Dir 1')).toBeInTheDocument();
    expect(await screen.findByText('Dir 21')).toBeInTheDocument();
  });
});

describe('página Direcciones: sin principal y accesibilidad', () => {
  it('con dos direcciones y ninguna principal avisa «Ninguna dirección es principal» y ambas ofrecen marcarla', async () => {
    montarDirecciones([direccionDto({ id: 1, alias: 'Trabajo' }), direccionDto({ id: 2, alias: 'Oficina' })]);

    expect(await screen.findByText('Ninguna dirección es principal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar Trabajo como principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar Oficina como principal' })).toBeInTheDocument();
  });

  it('con una principal no hay aviso y la principal no ofrece «Marcar … como principal»', async () => {
    montarDirecciones([casa, trabajo]);
    await screen.findByText('Casa');

    expect(screen.queryByText('Ninguna dirección es principal')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar Casa como principal' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar Trabajo como principal' })).toBeInTheDocument();
  });

  it('las acciones nombran su dirección', async () => {
    montarDirecciones([casa, trabajo]);
    await screen.findByText('Casa');

    expect(screen.getByRole('button', { name: 'Editar Trabajo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar Trabajo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Casa' })).toBeInTheDocument();
  });

  it('el listado con datos no tiene violaciones de accesibilidad', async () => {
    montarDirecciones([casa, trabajo]);
    await screen.findByText('Casa');

    await esperarSinViolacionesA11y(document.body);
  });

  it('el estado vacío no tiene violaciones de accesibilidad', async () => {
    montarDirecciones([]);
    await screen.findByRole('heading', { name: 'Todavía no tenés direcciones' });

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('página Direcciones: datos privados de la sesión', () => {
  it('al cambiar de usuario se piden de nuevo y no se muestran las de Ana', async () => {
    const { estado, router } = montarDirecciones([casa]);
    await screen.findByText('Casa');

    act(() => useAuthStore.getState().cerrarLocal({ motivo: 'logout' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    estado.direcciones = [];
    server.use(handlerMe(['CLIENT'], { nombre: 'Luis', apellido: 'Paz' }));
    await act(() => abrirSesion('A2'));
    await act(() => router.navigate('/direcciones'));

    expect(await screen.findByRole('heading', { name: 'Todavía no tenés direcciones' })).toBeInTheDocument();
    expect(screen.queryByText('Casa')).not.toBeInTheDocument();
    expect(pedidosDe(estado, 'GET', '/')).toHaveLength(2);
    expect(pedidosDe(estado, 'GET', '/')[1]?.authorization).toBe('Bearer A2');
  });
});
