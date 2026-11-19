import { act, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectEstado, useAuthStore } from '@/shared/auth';
import { errorApi, handlerLogin, handlerMe, loginOk, type PedidoAuth } from '@/test/msw/auth';
import { crearEstadoDirecciones, handlersDirecciones } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { renderApp } from '@/test/render-app';

type Usuario = ReturnType<typeof renderApp>['usuario'];

const campoEmail = () => screen.findByLabelText('Email');
const campoPassword = () => screen.findByLabelText('Contraseña');
const botonIngresar = () => screen.getByRole('button', { name: /^Ingres/ });

async function completar(usuario: Usuario, email = ' ana@example.com ', password = 'secreta123'): Promise<void> {
  await usuario.type(await campoEmail(), email);
  await usuario.type(await campoPassword(), password);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('página Ingresar', () => {
  it('login correcto: va a /catalogo y la navegación muestra «Mi cuenta»', async () => {
    server.use(handlerLogin(loginOk('A1')), handlerMe(['CLIENT']));
    const { router, usuario } = renderApp('/ingresar');

    await completar(usuario);
    await usuario.click(botonIngresar());

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    expect(await screen.findByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
  });

  it('vuelve a /direcciones cuando esa era la ruta recordada', async () => {
    server.use(...handlersDirecciones(crearEstadoDirecciones()), handlerLogin(loginOk('A1')), handlerMe(['CLIENT']));
    const { router, usuario } = renderApp('/direcciones');
    await screen.findByRole('heading', { name: 'Ingresar', level: 1 });

    await completar(usuario);
    await usuario.click(botonIngresar());

    await waitFor(() => expect(router.state.location.pathname).toBe('/direcciones'));
  });

  it('enviar vacío muestra los dos errores y no hace ningún pedido', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogin(loginOk(), pedidos));
    const { usuario } = renderApp('/ingresar');
    await campoEmail();

    await usuario.click(botonIngresar());

    expect(await screen.findByText('Ingresá tu email')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu contraseña')).toBeInTheDocument();
    expect(await campoEmail()).toHaveAttribute('aria-invalid', 'true');
    expect(pedidos).toHaveLength(0);
  });

  it('un email mal formado muestra el error solo en ese campo al salir del campo', async () => {
    const { usuario } = renderApp('/ingresar');

    await usuario.type(await campoEmail(), 'ana@');
    await usuario.tab();

    expect(await screen.findByText('Ingresá un email válido')).toBeInTheDocument();
    expect(screen.queryByText('Ingresá tu contraseña')).not.toBeInTheDocument();
  });

  it('401: alerta sin decir cuál dato falló, conserva el email, vacía la contraseña y no pide renovar', async () => {
    let refrescos = 0;
    server.use(
      handlerLogin(errorApi(401, 'HTTP_401', 'Credenciales incorrectas')),
      http.post(`${API}/auth/refresh`, () => {
        refrescos += 1;
        return HttpResponse.json({ detail: 'x', code: 'HTTP_401', field: null }, { status: 401 });
      }),
    );
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);
    await campoEmail();
    const refrescosAntes = refrescos;

    await usuario.click(botonIngresar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
    expect(await campoEmail()).toHaveValue('ana@example.com');
    expect(await campoPassword()).toHaveValue('');
    expect(refrescos).toBe(refrescosAntes);
  });

  it('login 200 pero /auth/me 404: alerta genérica, formulario visible con los valores y sesión anónima', async () => {
    server.use(
      handlerLogin(loginOk('A1')),
      http.get(`${API}/auth/me`, () => HttpResponse.json({ detail: 'Usuario no encontrado', code: 'HTTP_404', field: null }, { status: 404 })),
    );
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);

    await usuario.click(botonIngresar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no encontrado');
    expect(await campoEmail()).toHaveValue('ana@example.com');
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('sin respuesta: alerta «No pudimos conectar con el servidor.» y el email sigue cargado', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.error()));
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);

    await usuario.click(botonIngresar());

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar con el servidor.');
    expect(await campoEmail()).toHaveValue('ana@example.com');
  });

  it('doble clic con login demorado: un solo POST y «Ingresando…» deshabilitado', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(
      handlerLogin(async () => {
        await delay(150);
        return HttpResponse.json({ access_token: 'A1', token_type: 'bearer', expires_in: 1800 });
      }, pedidos),
      handlerMe(['CLIENT']),
    );
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);

    await usuario.dblClick(botonIngresar());

    const enviando = await screen.findByRole('button', { name: 'Ingresando…' });
    expect(enviando).toBeDisabled();
    await waitFor(() => expect(selectEstado(useAuthStore.getState())).toBe('autenticada'));
    expect(pedidos).toHaveLength(1);
  });

  it('con state.cuentaCreada muestra el aviso de cuenta creada y el email precargado', async () => {
    const { router } = renderApp('/catalogo');
    await screen.findByRole('heading', { name: 'Catálogo', level: 1 });

    await act(() => router.navigate('/ingresar', { state: { email: 'ana@example.com', cuentaCreada: true } }));

    expect(await screen.findByText('Tu cuenta se creó.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá para continuar.')).toBeInTheDocument();
    expect(await campoEmail()).toHaveValue('ana@example.com');
    expect(await campoPassword()).toHaveValue('');
  });

  it('sin state.cuentaCreada no hay aviso de cuenta creada', async () => {
    renderApp('/ingresar');
    await campoEmail();
    expect(screen.queryByText('Tu cuenta se creó.')).not.toBeInTheDocument();
  });

  it('el enlace «Registrate» lleva a /registrarse', async () => {
    const { router, usuario } = renderApp('/ingresar');

    await usuario.click(await screen.findByRole('link', { name: 'Registrate' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/registrarse'));
  });

  it('autocompletado: email y current-password, y la contraseña es de tipo password', async () => {
    renderApp('/ingresar');

    expect(await campoEmail()).toHaveAttribute('autocomplete', 'email');
    expect(await campoPassword()).toHaveAttribute('autocomplete', 'current-password');
    expect(await campoPassword()).toHaveAttribute('type', 'password');
  });

  it('axe: sin violaciones vacío y con errores', async () => {
    const { usuario } = renderApp('/ingresar');
    await campoEmail();
    await esperarSinViolacionesA11y(document.body);

    await usuario.click(botonIngresar());
    await screen.findByText('Ingresá tu email');

    await esperarSinViolacionesA11y(document.body);
  });
});

describe('página Ingresar: bloqueo por 429', () => {
  const limitar = (cabeceras: Record<string, string>) => handlerLogin(errorApi(429, 'RATE_LIMIT_EXCEEDED', 'Demasiados intentos', null, cabeceras));

  it('con Retry-After 840 avisa 14 minutos y deshabilita «Ingresar» hasta el segundo 840', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true });
    server.use(limitar({ 'Retry-After': '840' }));
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);

    await usuario.click(botonIngresar());

    expect(await screen.findByText(/14 minutos/)).toBeInTheDocument();
    expect(botonIngresar()).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(838_000);
    });
    expect(botonIngresar()).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() => expect(botonIngresar()).toBeEnabled());
  });

  it('sin Retry-After avisa sin tiempo y deja «Ingresar» habilitado', async () => {
    server.use(limitar({}));
    const { usuario } = renderApp('/ingresar');
    await completar(usuario);

    await usuario.click(botonIngresar());

    const aviso = await screen.findByText('Demasiados intentos.');
    expect(within(aviso.closest('[role="alert"]') as HTMLElement).queryByText(/\d+ minutos?/)).not.toBeInTheDocument();
    expect(botonIngresar()).toBeEnabled();
  });
});
