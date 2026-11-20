import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { respuestaError } from '@/test/msw/admin-catalogo';
import { crearEstadoUsuarios, pedidosUsuarios, usuarioAdminDto } from '@/test/msw/usuarios';
import { API, server } from '@/test/msw/server';
import { esperarTitulo } from '@/test/render-admin';
import { montarUsuarios } from '@/test/render-usuarios';

describe('listado de usuarios', () => {
  it('«Carla Gómez» muestra sus dos roles con nombre visible y «—» por no tener celular', async () => {
    montarUsuarios('/admin/usuarios');

    const fila = await screen.findByRole('group', { name: 'Carla Gómez' });

    expect(within(fila).getByText('carla@example.com')).toBeInTheDocument();
    const roles = within(fila).getByRole('list', { name: 'Roles de Carla Gómez' });
    expect(within(roles).getAllByRole('listitem').map((rol) => rol.textContent)).toEqual(['Gestor de pedidos', 'Gestor de stock']);
    expect(within(fila).getByText('—')).toBeInTheDocument();
    expect(within(fila).getByRole('button', { name: 'Editar Carla Gómez' })).toBeInTheDocument();
    expect(within(fila).getByRole('button', { name: 'Desactivar Carla Gómez' })).toBeInTheDocument();
  });

  it('un usuario con celular lo muestra y no lleva la marca «Vos»', async () => {
    montarUsuarios('/admin/usuarios');

    const fila = await screen.findByRole('group', { name: 'Diego Fernández' });

    expect(within(fila).getByText('+54 9 351 555-0142')).toBeInTheDocument();
    expect(within(fila).queryByText('Vos')).not.toBeInTheDocument();
    expect(within(fila).queryByText('—')).not.toBeInTheDocument();
  });

  it('la fila de la sesión lleva «Vos», permite «Editar» y no ofrece «Desactivar»', async () => {
    montarUsuarios('/admin/usuarios');

    const fila = await screen.findByRole('group', { name: 'Ana Gómez' });

    expect(within(fila).getByText('Vos')).toBeInTheDocument();
    expect(within(fila).getByRole('button', { name: 'Editar Ana Gómez' })).toBeInTheDocument();
    expect(within(fila).queryByRole('button', { name: /^Desactivar/ })).not.toBeInTheDocument();
  });

  it('muestra el título, «Nuevo usuario» y el total', async () => {
    montarUsuarios('/admin/usuarios');

    await esperarTitulo('Usuarios');

    expect(await screen.findByText('5 usuarios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument();
  });
});

describe('filtro por rol y paginación en la URL', () => {
  it('elegir «Gestor de stock» pide rol_codigo=STOCK&page=1&size=20, guarda rol=STOCK en la URL y lista solo a quienes lo tienen', async () => {
    const { estado, router, usuario } = montarUsuarios('/admin/usuarios');
    await screen.findByRole('group', { name: 'Ana Gómez' });

    await usuario.click(screen.getByRole('button', { name: 'Gestor de stock' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Ana Gómez' })).not.toBeInTheDocument());
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/').map((p) => p.busqueda)).toContain('?rol_codigo=STOCK&page=1&size=20');
    expect(router.state.location.search).toBe('?rol=STOCK');
    expect(screen.getByRole('group', { name: 'Carla Gómez' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Diego Fernández' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestor de stock' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('con el rol Gestor de stock')).toBeInTheDocument();
  });

  it('el filtro tiene «Todos» y los cuatro roles; volver a «Todos» limpia la URL', async () => {
    const { router, usuario } = montarUsuarios('/admin/usuarios?rol=STOCK&page=1');
    const grupo = await screen.findByRole('group', { name: 'Filtrar por rol' });

    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Todos', 'Administrador', 'Gestor de stock', 'Gestor de pedidos', 'Cliente']);
    await usuario.click(within(grupo).getByRole('button', { name: 'Todos' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(within(grupo).getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un rol desconocido en la URL se ve como «Todos» y el pedido no incluye rol_codigo', async () => {
    const { estado } = montarUsuarios('/admin/usuarios?rol=COCINA');

    await screen.findByRole('group', { name: 'Ana Gómez' });

    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/').map((p) => p.busqueda)).toEqual(['?page=1&size=20']);
  });

  it('con 25 usuarios muestra 20 y «Siguiente» lleva a la página 2 con los 5 restantes y la URL page=2', async () => {
    const usuarios = Array.from({ length: 25 }, (_, i) => usuarioAdminDto(i + 1, `Nombre${i + 1}`, 'Prueba', ['CLIENT']));
    const { router, usuario } = montarUsuarios('/admin/usuarios', { estado: crearEstadoUsuarios(usuarios) });
    await screen.findByRole('group', { name: 'Nombre1 Prueba' });
    expect(screen.getAllByRole('group').filter((g) => g.className.includes('urow'))).toHaveLength(20);

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByRole('group', { name: 'Nombre25 Prueba' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Nombre1 Prueba' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  it('cambiar el filtro desde la página 2 vuelve a la página 1', async () => {
    const usuarios = Array.from({ length: 25 }, (_, i) => usuarioAdminDto(i + 1, `Nombre${i + 1}`, 'Prueba', ['CLIENT', ...(i % 2 === 0 ? ['STOCK'] : [])]));
    const { router, usuario } = montarUsuarios('/admin/usuarios?page=2', { estado: crearEstadoUsuarios(usuarios) });
    await screen.findByRole('group', { name: 'Nombre25 Prueba' });

    await usuario.click(screen.getByRole('button', { name: 'Gestor de stock' }));

    await waitFor(() => expect(router.state.location.search).toBe('?rol=STOCK'));
  });
});

describe('estados del listado', () => {
  it('mientras carga muestra el esqueleto «Cargando usuarios»', async () => {
    const estado = crearEstadoUsuarios();
    estado.demoras.GET = 150;
    montarUsuarios('/admin/usuarios', { estado });

    expect(await screen.findByRole('status', { name: 'Cargando usuarios' })).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Ana Gómez' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Cargando usuarios' })).not.toBeInTheDocument();
  });

  it('un filtro sin resultados muestra «No hay usuarios con ese rol» y «Ver todos» vuelve al listado completo', async () => {
    const estado = crearEstadoUsuarios([usuarioAdminDto(1, 'Ana', 'Gómez', ['ADMIN']), usuarioAdminDto(4, 'Lucía', 'Martínez', ['CLIENT'])]);
    const { router, usuario } = montarUsuarios('/admin/usuarios?rol=PEDIDOS', { estado });

    expect(await screen.findByRole('heading', { name: 'No hay usuarios con ese rol' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Ver todos' }));

    expect(await screen.findByRole('group', { name: 'Lucía Martínez' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('un 500 muestra el error con «Reintentar», que vuelve a pedir el listado', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.get(`${API}/admin/usuarios/`, () => respuestaError(500, 'HTTP_500', 'Falló la base'), { once: true }));

    expect(await screen.findByRole('heading', { name: 'No pudimos cargar los usuarios' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('group', { name: 'Ana Gómez' })).toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/').length).toBeGreaterThanOrEqual(1);
  });
});
