import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { respuestaError } from '@/test/msw/admin-catalogo';
import { crearEstadoUsuarios, escriturasUsuarios, pedidosUsuarios, usuarioAdminDto } from '@/test/msw/usuarios';
import { API, server } from '@/test/msw/server';
import { esperarTitulo } from '@/test/render-admin';
import { montarUsuarios } from '@/test/render-usuarios';

const abrirDialogoDeCarla = async (usuario: ReturnType<typeof montarUsuarios>['usuario']) => {
  await usuario.click(await screen.findByRole('button', { name: 'Desactivar Carla Gómez' }));
  return screen.getByRole('dialog', { name: '¿Desactivar a Carla Gómez?' });
};

describe('desactivación de usuario', () => {
  it('«Desactivar Carla Gómez» abre el diálogo con su nombre, su email y lo que pasa al confirmar', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');

    const dialogo = await abrirDialogoDeCarla(usuario);

    expect(within(dialogo).getByText('Carla Gómez')).toBeInTheDocument();
    expect(within(dialogo).getByText('carla@example.com')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('Se cierran sus sesiones abiertas');
    expect(dialogo).toHaveTextContent('No va a poder ingresar con esa cuenta.');
    expect(dialogo).toHaveTextContent('Su email queda libre para una cuenta nueva.');
  });

  it('confirmar envía el DELETE, avisa «Usuario desactivado», quita la fila y deja el foco en el título', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    const dialogo = await abrirDialogoDeCarla(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByText('Usuario desactivado')).toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'DELETE', '/admin/usuarios/2')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Carla Gómez' })).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await esperarTitulo('Usuarios');
    expect(screen.getByRole('heading', { name: 'Usuarios', level: 1 })).toHaveFocus();
  });

  it('«Cancelar» cierra el diálogo, devuelve el foco al botón y no envía nada', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    const boton = await screen.findByRole('button', { name: 'Desactivar Carla Gómez' });
    await usuario.click(boton);

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    expect(escriturasUsuarios(estado)).toEqual([]);
  });

  it('Escape cierra el diálogo y devuelve el foco al botón «Desactivar Carla Gómez»', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    const boton = await screen.findByRole('button', { name: 'Desactivar Carla Gómez' });
    await usuario.click(boton);

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(boton).toHaveFocus();
    expect(escriturasUsuarios(estado)).toEqual([]);
  });

  it('mientras se desactiva muestra «Desactivando…» deshabilitado y Escape no cierra', async () => {
    const estado = crearEstadoUsuarios();
    estado.demoras.DELETE = 250;
    const { usuario } = montarUsuarios('/admin/usuarios', { estado });
    const dialogo = await abrirDialogoDeCarla(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByRole('button', { name: 'Desactivando…' })).toBeDisabled();
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('un 404 avisa que el usuario ya no estaba activo, vuelve a pedir el listado y «Entendido» cierra', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    const dialogo = await abrirDialogoDeCarla(usuario);
    estado.usuarios = estado.usuarios.filter((u) => u.id !== 2);
    const consultasAntes = pedidosUsuarios(estado, 'GET', '/admin/usuarios/').length;

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    const inactivo = await screen.findByRole('dialog', { name: 'Carla Gómez ya no estaba activo' });
    expect(within(inactivo).getByRole('alert')).toHaveTextContent('Otra persona ya lo desactivó');
    await waitFor(() => expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/').length).toBeGreaterThan(consultasAntes));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Carla Gómez' })).not.toBeInTheDocument());
    await usuario.click(within(inactivo).getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Usuarios', level: 1 })).toHaveFocus();
  });

  it('un 500 se muestra dentro del diálogo, que sigue abierto con «Desactivar» disponible', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.delete(`${API}/admin/usuarios/:id`, () => respuestaError(500, 'HTTP_500', 'Falló la base')));
    const dialogo = await abrirDialogoDeCarla(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos desactivar al usuario');
    expect(alerta).toHaveTextContent('Falló la base');
    expect(within(dialogo).getByRole('button', { name: 'Desactivar' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Carla Gómez' })).toBeInTheDocument();
  });

  it('con la red caída muestra el error de conexión dentro del diálogo', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.delete(`${API}/admin/usuarios/:id`, () => HttpResponse.error()));
    const dialogo = await abrirDialogoDeCarla(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor. Probá de nuevo.');
  });

  it('un 409 LAST_ADMIN muestra «Tiene que quedar al menos un administrador activo.» sin quitar la fila', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.delete(`${API}/admin/usuarios/:id`, () => respuestaError(409, 'LAST_ADMIN', 'otro texto')));
    await usuario.click(await screen.findByRole('button', { name: 'Desactivar Marcos Peralta' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Desactivar a Marcos Peralta?' });

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Tiene que quedar al menos un administrador activo.');
    expect(screen.getByRole('group', { name: 'Marcos Peralta' })).toBeInTheDocument();
  });

  it('un 409 SELF_ACTION_NOT_ALLOWED muestra «No podés desactivar tu propia cuenta.»', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.delete(`${API}/admin/usuarios/:id`, () => respuestaError(409, 'SELF_ACTION_NOT_ALLOWED', 'otro texto')));
    const dialogo = await abrirDialogoDeCarla(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No podés desactivar tu propia cuenta.');
  });

  it('al desactivar al único usuario de la última página vuelve a la última página que existe', async () => {
    const usuarios = Array.from({ length: 21 }, (_, i) => usuarioAdminDto(i + 1, `Nombre${i + 1}`, 'Prueba', ['CLIENT']));
    const { router, usuario } = montarUsuarios('/admin/usuarios?page=2', { estado: crearEstadoUsuarios(usuarios) });
    await usuario.click(await screen.findByRole('button', { name: 'Desactivar Nombre21 Prueba' }));

    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByRole('group', { name: 'Nombre1 Prueba' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('heading', { name: 'No hay usuarios con ese rol' })).not.toBeInTheDocument();
  });
});
