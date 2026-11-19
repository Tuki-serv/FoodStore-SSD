import { screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { selectEstado, selectUsuario, useAuthStore } from '@/shared/auth';
import { errorApi, handlerLogout, handlerLogoutAll, handlerMe, handlerPatchPerfil, perfilOk, sinContenido, type PedidoAuth } from '@/test/msw/auth';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { API, server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

const titulo = () => screen.findByRole('heading', { name: 'Mi cuenta', level: 1 });
const campo = (nombre: string) => screen.findByLabelText(nombre);
const botonGuardar = () => screen.getByRole('button', { name: /^Guard/ });
const panel = () => within(screen.getByRole('complementary'));

describe('página Mi cuenta: perfil', () => {
  it('un cliente ve sus datos, el email sin campo editable, su rol y no hace ningún pedido a /usuarios/me', async () => {
    let pedidosAUsuariosMe = 0;
    server.use(
      http.get(`${API}/usuarios/me`, () => {
        pedidosAUsuariosMe += 1;
        return HttpResponse.json({});
      }),
    );
    renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    expect(await campo('Nombre')).toHaveValue('Ana');
    expect(await campo('Apellido')).toHaveValue('Gómez');
    expect(await campo('Celular (opcional)')).toHaveValue('');
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(pedidosAUsuariosMe).toBe(0);
  });

  it('un usuario con varios roles los ve por su nombre visible', async () => {
    renderApp('/mi-cuenta', { sesion: { roles: ['ADMIN', 'STOCK'] } });
    await titulo();

    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Gestor de stock')).toBeInTheDocument();
    expect(screen.queryByText('Cliente')).not.toBeInTheDocument();
  });

  it('cambiar el nombre a « Analía » envía los tres campos recortados, actualiza el panel, conserva el rol y avisa', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerPatchPerfil(perfilOk({ nombre: 'Analía' }), pedidos));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['ADMIN'] } });
    await titulo();
    const nombre = await campo('Nombre');

    await usuario.clear(nombre);
    await usuario.type(nombre, ' Analía ');
    await usuario.click(botonGuardar());

    expect(await screen.findByText('Datos guardados')).toBeInTheDocument();
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.cuerpo).toEqual({ nombre: 'Analía', apellido: 'Gómez', celular: null });
    expect(await panel().findByText('Analía Gómez')).toBeInTheDocument();
    expect(selectUsuario(useAuthStore.getState())?.roles).toEqual(['ADMIN']);
  });

  it('apellido vacío: «Ingresá tu apellido» y ningún pedido', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerPatchPerfil(perfilOk(), pedidos));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.clear(await campo('Apellido'));
    await usuario.click(botonGuardar());

    expect(await screen.findByText('Ingresá tu apellido')).toBeInTheDocument();
    expect(await campo('Apellido')).toHaveAttribute('aria-invalid', 'true');
    expect(pedidos).toHaveLength(0);
  });

  it('un celular de 21 caracteres es un error y de 20 se envía', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerPatchPerfil(perfilOk({ celular: '1'.repeat(20) }), pedidos));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();
    const celular = await campo('Celular (opcional)');

    await usuario.type(celular, '1'.repeat(21));
    await usuario.click(botonGuardar());
    expect(await screen.findByText('Máximo 20 caracteres')).toBeInTheDocument();
    expect(pedidos).toHaveLength(0);

    await usuario.type(celular, '{Backspace}');
    await usuario.click(botonGuardar());
    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]?.cuerpo).toMatchObject({ celular: '1'.repeat(20) });
  });

  it('503: alerta con el detail, valores editados conservados y sesión sin cambios', async () => {
    server.use(handlerPatchPerfil(errorApi(503, 'HTTP_503', 'Servicio no disponible')));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();
    const nombre = await campo('Nombre');

    await usuario.clear(nombre);
    await usuario.type(nombre, 'Analía');
    await usuario.click(botonGuardar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
    expect(await campo('Nombre')).toHaveValue('Analía');
    expect(selectUsuario(useAuthStore.getState())?.nombre).toBe('Ana');
  });

  it('422 con field celular: el mensaje queda junto al campo', async () => {
    server.use(handlerPatchPerfil(errorApi(422, 'VALIDATION_ERROR', 'Celular no válido', 'celular')));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.type(await campo('Celular (opcional)'), '123');
    await usuario.click(botonGuardar());

    expect(await screen.findByText('Celular no válido')).toBeInTheDocument();
    expect(await campo('Celular (opcional)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('doble clic en «Guardar cambios»: un solo PATCH', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(
      handlerPatchPerfil(async () => {
        await delay(150);
        return HttpResponse.json({ id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null });
      }, pedidos),
    );
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.dblClick(botonGuardar());

    expect(await screen.findByText('Datos guardados')).toBeInTheDocument();
    expect(pedidos).toHaveLength(1);
  });

  it('axe: la página no tiene violaciones', async () => {
    renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('página Mi cuenta: cerrar todas las sesiones', () => {
  const abrirDialogo = async (usuario: ReturnType<typeof renderApp>['usuario']) => {
    await titulo();
    await usuario.click(screen.getByRole('button', { name: 'Cerrar todas las sesiones' }));
    return screen.findByRole('dialog', { name: '¿Cerrar todas las sesiones?' });
  };

  it('confirmar con 204: POST /auth/logout-all con Bearer A1, vuelve a /catalogo y la navegación pierde «Mi cuenta»', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogoutAll(sinContenido, pedidos));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    const dialogo = await abrirDialogo(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar todas' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    expect(pedidos.map((p) => p.authorization)).toEqual(['Bearer A1']);
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
  });

  it('cancelar: ningún pedido y la sesión sigue autenticada', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogoutAll(sinContenido, pedidos));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    const dialogo = await abrirDialogo(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(pedidos).toHaveLength(0);
    expect(selectEstado(useAuthStore.getState())).toBe('autenticada');
    expect(router.state.location.pathname).toBe('/mi-cuenta');
  });

  it('sin respuesta del backend: la sesión queda anónima igual y va a /catalogo', async () => {
    server.use(http.post(`${API}/auth/logout-all`, () => HttpResponse.error()));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    const dialogo = await abrirDialogo(usuario);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar todas' }));

    await waitFor(() => expect(selectEstado(useAuthStore.getState())).toBe('anonima'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
  });

  it('axe: sin violaciones con el diálogo abierto', async () => {
    server.use(handlerMe(['CLIENT']));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await abrirDialogo(usuario);

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('página Mi cuenta: cerrar sesión', () => {
  // La cabecera de la app también tiene «Cerrar sesión»: el botón bajo prueba es el de la tarjeta «Sesiones».
  const botonCerrar = () => within(screen.getByRole('region', { name: 'Sesiones' })).getByRole('button', { name: 'Cerrar sesión' });

  it('«Cerrar sesión» sin diálogo: POST /auth/logout con Bearer A1, ningún pedido a logout-all, vuelve a /catalogo y la navegación pierde «Mi cuenta»', async () => {
    const pedidos: PedidoAuth[] = [];
    const pedidosTodas: PedidoAuth[] = [];
    server.use(handlerLogout(sinContenido, pedidos), handlerLogoutAll(sinContenido, pedidosTodas));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.click(botonCerrar());

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidos.map((p) => p.authorization)).toEqual(['Bearer A1']);
    expect(pedidosTodas).toHaveLength(0);
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
  });

  it('sin respuesta del backend: la sesión queda anónima igual y va a /catalogo', async () => {
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.click(botonCerrar());

    await waitFor(() => expect(selectEstado(useAuthStore.getState())).toBe('anonima'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
  });

  it('doble clic: un solo POST /auth/logout', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(http.post(`${API}/auth/logout`, async ({ request }) => {
      pedidos.push({ texto: '', cuerpo: undefined, contentType: null, authorization: request.headers.get('authorization') });
      await delay(50);
      return new HttpResponse(null, { status: 204 });
    }));
    const { router, usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.dblClick(botonCerrar());

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    expect(pedidos).toHaveLength(1);
  });

  it('«Cerrar todas las sesiones» sigue pidiendo confirmación y no llama a /auth/logout', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogout(sinContenido, pedidos));
    const { usuario } = renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    await usuario.click(screen.getByRole('button', { name: 'Cerrar todas las sesiones' }));

    expect(await screen.findByRole('dialog', { name: '¿Cerrar todas las sesiones?' })).toBeInTheDocument();
    expect(pedidos).toHaveLength(0);
  });

  it('muestra el copy de la tarjeta «Sesiones» y axe no encuentra violaciones', async () => {
    renderApp('/mi-cuenta', { sesion: { roles: ['CLIENT'] } });
    await titulo();

    expect(screen.getByText(/Cerrá la sesión en este dispositivo o en todos tus dispositivos\./)).toBeInTheDocument();
    await esperarSinViolacionesA11y(document.body);
  });
});
