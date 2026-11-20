import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/shared/auth';
import { respuestaError } from '@/test/msw/admin-catalogo';
import { usuarioDto } from '@/test/msw/auth';
import { crearEstadoUsuarios, escriturasUsuarios, pedidosUsuarios, usuariosSeed } from '@/test/msw/usuarios';
import { API, server } from '@/test/msw/server';
import { montarUsuarios } from '@/test/render-usuarios';

const sinCarla = () => crearEstadoUsuarios(usuariosSeed.filter((u) => u.id !== 2));

const rol = (nombre: string) => screen.getByRole('checkbox', { name: new RegExp(`^${nombre}`) });

async function abrirAlta(usuario: UserEvent) {
  await usuario.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
  return screen.findByRole('heading', { name: 'Nuevo usuario', level: 2 });
}

async function completarCarla(usuario: UserEvent, { email = 'carla@example.com', password = 'claveinicial1' } = {}) {
  await usuario.type(screen.getByLabelText('Nombre'), 'Carla');
  await usuario.type(screen.getByLabelText('Apellido'), 'Gómez');
  await usuario.type(screen.getByLabelText('Email'), email);
  await usuario.type(screen.getByLabelText('Contraseña inicial'), password);
}

describe('alta de usuario', () => {
  it('el formulario trae «Cliente» marcado, la ayuda de la contraseña y los cuatro roles agrupados', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);

    const grupo = screen.getByRole('group', { name: /^Roles/ });
    expect(within(grupo).getAllByRole('checkbox')).toHaveLength(4);
    expect(rol('Cliente')).toBeChecked();
    expect(rol('Administrador')).not.toBeChecked();
    expect(screen.getByText('Mínimo 8 caracteres. Se la tenés que pasar vos al usuario.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeInTheDocument();
  });

  it('crear a «Carla Gómez» con «Gestor de pedidos» y «Gestor de stock» envía el POST con roles_codigos [PEDIDOS, STOCK], avisa «Usuario creado» y la fila aparece sin recargar', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios', { estado: sinCarla() });
    await abrirAlta(usuario);

    await completarCarla(usuario);
    await usuario.click(rol('Cliente'));
    await usuario.click(rol('Gestor de pedidos'));
    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Usuario creado')).toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'POST', '/admin/usuarios/createUser')).toHaveLength(1);
    expect(pedidosUsuarios(estado, 'POST', '/admin/usuarios/createUser')[0]?.cuerpo).toEqual({
      nombre: 'Carla',
      apellido: 'Gómez',
      email: 'carla@example.com',
      celular: null,
      password: 'claveinicial1',
      roles_codigos: ['PEDIDOS', 'STOCK'],
    });
    const fila = await screen.findByRole('group', { name: 'Carla Gómez' });
    expect(within(within(fila).getByRole('list', { name: 'Roles de Carla Gómez' })).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['Gestor de pedidos', 'Gestor de stock']);
    expect(screen.queryByRole('heading', { name: 'Nuevo usuario', level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toHaveFocus();
  });

  it('el celular se recorta y se envía; el nombre y el email se recortan', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios', { estado: sinCarla() });
    await abrirAlta(usuario);

    await usuario.type(screen.getByLabelText('Nombre'), '  Carla ');
    await usuario.type(screen.getByLabelText('Apellido'), 'Gómez');
    await usuario.type(screen.getByLabelText('Email'), ' carla@example.com ');
    await usuario.type(screen.getByLabelText(/^Celular/), ' 351 555-0100 ');
    await usuario.type(screen.getByLabelText('Contraseña inicial'), 'claveinicial1');
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    await screen.findByText('Usuario creado');
    expect(pedidosUsuarios(estado, 'POST', '/admin/usuarios/createUser')[0]?.cuerpo).toMatchObject({ nombre: 'Carla', email: 'carla@example.com', celular: '351 555-0100', roles_codigos: ['CLIENT'] });
  });

  it('con todo vacío y sin roles no envía nada y muestra cada error junto a su campo', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);
    await usuario.click(rol('Cliente'));

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Ingresá el nombre')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el apellido')).toBeInTheDocument();
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
    expect(screen.getByText('Usá al menos 8 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Elegí al menos un rol.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(escriturasUsuarios(estado)).toEqual([]);
  });

  it('una contraseña de 6 caracteres no se envía y pide al menos 8', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios', { estado: sinCarla() });
    await abrirAlta(usuario);
    await completarCarla(usuario, { password: 'abc123' });

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Usá al menos 8 caracteres')).toBeInTheDocument();
    expect(screen.queryByText('Ingresá el nombre')).not.toBeInTheDocument();
    expect(escriturasUsuarios(estado)).toEqual([]);
  });

  it('desmarcar el último rol muestra «Elegí al menos un rol.» enseguida y marcar otro lo quita', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);

    await usuario.click(rol('Cliente'));
    expect(await screen.findByText('Elegí al menos un rol.')).toBeInTheDocument();
    await usuario.click(rol('Gestor de stock'));

    await waitFor(() => expect(screen.queryByText('Elegí al menos un rol.')).not.toBeInTheDocument());
  });

  it('un 409 por email repetido muestra «Ya existe un usuario con ese email.» en Email y conserva los datos', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);
    await completarCarla(usuario, { email: 'ana@example.com' });

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByText('Ya existe un usuario con ese email.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Carla');
    expect(screen.getByLabelText('Contraseña inicial')).toHaveValue('claveinicial1');
    expect(screen.getByRole('heading', { name: 'Nuevo usuario', level: 2 })).toBeInTheDocument();
  });

  it('corregir el email quita el error del 409', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);
    await completarCarla(usuario, { email: 'ana@example.com' });
    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await screen.findByText('Ya existe un usuario con ese email.');

    await usuario.type(screen.getByLabelText('Email'), 'x');

    expect(screen.queryByText('Ya existe un usuario con ese email.')).not.toBeInTheDocument();
  });

  it('sin respuesta del servidor muestra la alerta de conexión y conserva los datos', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios', { estado: sinCarla() });
    server.use(http.post(`${API}/admin/usuarios/createUser`, () => HttpResponse.error()));
    await abrirAlta(usuario);
    await completarCarla(usuario);

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No pudimos guardar el usuario');
    expect(alerta).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Carla');
    expect(screen.getByRole('button', { name: 'Crear usuario' })).toBeEnabled();
  });

  it('un 400 (rol inválido) se muestra como alerta general del formulario', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios', { estado: sinCarla() });
    server.use(http.post(`${API}/admin/usuarios/createUser`, () => respuestaError(400, 'HTTP_400', 'Uno o más roles no existen')));
    await abrirAlta(usuario);
    await completarCarla(usuario);

    await usuario.click(screen.getByRole('button', { name: 'Crear usuario' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Uno o más roles no existen');
  });

  it('«Cancelar» vuelve al listado sin enviar nada y devuelve el foco a «Nuevo usuario»', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await abrirAlta(usuario);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('group', { name: 'Ana Gómez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toHaveFocus();
    expect(escriturasUsuarios(estado)).toEqual([]);
  });
});

describe('edición de otro usuario', () => {
  it('«Editar Carla Gómez» abre el formulario con sus datos y roles, sin contraseña y con el email no editable', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');

    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));

    expect(await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Carla');
    expect(screen.getByLabelText('Email')).toHaveValue('carla@example.com');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Contraseña inicial')).not.toBeInTheDocument();
    expect(rol('Gestor de pedidos')).toBeChecked();
    expect(rol('Gestor de stock')).toBeChecked();
    expect(rol('Cliente')).not.toBeChecked();
    expect(rol('Administrador')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('desmarcar «Gestor de stock» y guardar envía el PATCH solo con roles_codigos [PEDIDOS], avisa «Usuario actualizado» y la fila muestra solo «Gestor de pedidos»', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 });

    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Usuario actualizado')).toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'PATCH', '/admin/usuarios/2')).toHaveLength(1);
    expect(pedidosUsuarios(estado, 'PATCH', '/admin/usuarios/2')[0]?.cuerpo).toEqual({ roles_codigos: ['PEDIDOS'] });
    const fila = await screen.findByRole('group', { name: 'Carla Gómez' });
    await waitFor(() => expect(within(within(fila).getByRole('list', { name: 'Roles de Carla Gómez' })).getAllByRole('listitem').map((r) => r.textContent)).toEqual(['Gestor de pedidos']));
    expect(screen.getByRole('button', { name: 'Editar Carla Gómez' })).toHaveFocus();
  });

  it('cambiar solo el apellido y el celular envía solo esos campos', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 });

    await usuario.clear(screen.getByLabelText('Apellido'));
    await usuario.type(screen.getByLabelText('Apellido'), 'Núñez');
    await usuario.type(screen.getByLabelText(/^Celular/), '351 555-0100');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByText('Usuario actualizado');
    expect(pedidosUsuarios(estado, 'PATCH', '/admin/usuarios/2')[0]?.cuerpo).toEqual({ apellido: 'Núñez', celular: '351 555-0100' });
  });

  it('guardar sin cambios cierra el formulario sin enviar nada ni avisar', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 });

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('group', { name: 'Ana Gómez' })).toBeInTheDocument();
    expect(escriturasUsuarios(estado)).toEqual([]);
    expect(screen.queryByText('Usuario actualizado')).not.toBeInTheDocument();
  });

  it('un 409 LAST_ADMIN muestra «Tiene que quedar al menos un administrador activo.» y conserva lo elegido', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.patch(`${API}/admin/usuarios/:id`, () => respuestaError(409, 'LAST_ADMIN', 'otro texto')));
    await usuario.click(await screen.findByRole('button', { name: 'Editar Marcos Peralta' }));
    await screen.findByRole('heading', { name: 'Editar a Marcos Peralta', level: 2 });

    await usuario.click(rol('Administrador'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tiene que quedar al menos un administrador activo.');
    expect(rol('Administrador')).not.toBeChecked();
    expect(rol('Gestor de pedidos')).toBeChecked();
  });

  it('un 404 (ya no estaba activo) avisa, vuelve al listado y lo pide de nuevo', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 });
    estado.usuarios = estado.usuarios.filter((u) => u.id !== 2);
    const consultasAntes = pedidosUsuarios(estado, 'GET', '/admin/usuarios/').length;

    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Carla Gómez ya no estaba activo')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Carla Gómez' })).not.toBeInTheDocument());
    expect(pedidosUsuarios(estado, 'GET', '/admin/usuarios/').length).toBeGreaterThan(consultasAntes);
  });
});

describe('edición de la propia cuenta', () => {
  async function editarseAUnoMismo(usuario: UserEvent) {
    await usuario.click(await screen.findByRole('button', { name: 'Editar Ana Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Ana Gómez', level: 2 });
  }

  it('la casilla «Administrador» está marcada, deshabilitada y explicada', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    await editarseAUnoMismo(usuario);

    const admin = rol('Administrador');
    expect(admin).toBeChecked();
    expect(admin).toBeDisabled();
    expect(admin).toHaveAccessibleDescription(/No podés quitarte tu propio rol de administrador/);
    expect(screen.getByText('Es tu propia cuenta.')).toBeInTheDocument();
    expect(rol('Gestor de stock')).toBeEnabled();
  });

  it('sumarse «Gestor de stock» envía el PATCH con la lista completa y vuelve a pedir GET /auth/me para refrescar la sesión', async () => {
    const { estado, usuario } = montarUsuarios('/admin/usuarios');
    let pedidosMe = 0;
    server.use(
      http.get(`${API}/auth/me`, () => {
        pedidosMe += 1;
        return HttpResponse.json(usuarioDto(['ADMIN', 'CLIENT', 'STOCK']));
      }),
    );
    await editarseAUnoMismo(usuario);
    const antes = pedidosMe;

    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('Usuario actualizado')).toBeInTheDocument();
    expect(pedidosUsuarios(estado, 'PATCH', '/admin/usuarios/1')[0]?.cuerpo).toEqual({ roles_codigos: ['ADMIN', 'CLIENT', 'STOCK'] });
    await waitFor(() => expect(pedidosMe).toBe(antes + 1));
    await waitFor(() => expect(useAuthStore.getState().usuario?.roles).toEqual(['ADMIN', 'CLIENT', 'STOCK']));
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('editar a otro usuario no refresca la sesión', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    let pedidosMe = 0;
    server.use(
      http.get(`${API}/auth/me`, () => {
        pedidosMe += 1;
        return HttpResponse.json(usuarioDto(['ADMIN', 'CLIENT']));
      }),
    );
    await usuario.click(await screen.findByRole('button', { name: 'Editar Carla Gómez' }));
    await screen.findByRole('heading', { name: 'Editar a Carla Gómez', level: 2 });
    const antes = pedidosMe;

    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await screen.findByText('Usuario actualizado');
    expect(pedidosMe).toBe(antes);
  });

  it('un 409 SELF_ACTION_NOT_ALLOWED muestra «No podés quitarte tu propio rol de administrador.» sin cambiar el listado', async () => {
    const { usuario } = montarUsuarios('/admin/usuarios');
    server.use(http.patch(`${API}/admin/usuarios/:id`, () => respuestaError(409, 'SELF_ACTION_NOT_ALLOWED', 'texto del servidor')));
    await editarseAUnoMismo(usuario);

    await usuario.click(rol('Gestor de stock'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No podés quitarte tu propio rol de administrador.');
    expect(rol('Gestor de stock')).toBeChecked();
  });
});
