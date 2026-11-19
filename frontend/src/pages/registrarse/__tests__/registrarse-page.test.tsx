import { screen, waitFor, within } from '@testing-library/react';
import { delay, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { selectEstado, selectRoles, useAuthStore } from '@/shared/auth';
import { errorApi, handlerLogin, handlerMe, handlerRegister, loginOk, registroOk, type PedidoAuth } from '@/test/msw/auth';
import { esperarSinViolacionesA11y } from '@/test/axe';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

type Usuario = ReturnType<typeof renderApp>['usuario'];

const etiqueta = (nombre: string) => screen.findByLabelText(nombre);
const botonCrear = () => screen.getByRole('button', { name: /^Cre/ });

interface Valores {
  nombre?: string;
  apellido?: string;
  email?: string;
  celular?: string;
  password?: string;
  confirmacion?: string;
}

async function completar(usuario: Usuario, valores: Valores = {}): Promise<void> {
  const v = { nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: '', password: 'secreta123', confirmacion: 'secreta123', ...valores };
  const pares: [string, string][] = [
    ['Nombre', v.nombre],
    ['Apellido', v.apellido],
    ['Email', v.email],
    ['Celular (opcional)', v.celular],
    ['Contraseña', v.password],
    ['Repetir contraseña', v.confirmacion],
  ];
  for (const [campo, valor] of pares) {
    if (valor === '') continue;
    await usuario.type(await etiqueta(campo), valor);
  }
}

describe('página Registrarse', () => {
  it('registro 201 + login 200: va a /catalogo con sesión CLIENT', async () => {
    server.use(handlerRegister(registroOk()), handlerLogin(loginOk('A1')), handlerMe(['CLIENT']));
    const { router, usuario } = renderApp('/registrarse');

    await completar(usuario);
    await usuario.click(botonCrear());

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalogo'));
    expect(selectRoles(useAuthStore.getState())).toEqual(['CLIENT']);
  });

  it('envía el cuerpo exacto: textos recortados, celular null y sin la repetición de la contraseña', async () => {
    const registros: PedidoAuth[] = [];
    server.use(handlerRegister(registroOk(), registros), handlerLogin(loginOk('A1')), handlerMe(['CLIENT']));
    const { usuario } = renderApp('/registrarse');

    await completar(usuario, { nombre: ' Ana ', apellido: ' Gómez ' });
    await usuario.click(botonCrear());

    await waitFor(() => expect(registros).toHaveLength(1));
    expect(registros[0]?.cuerpo).toEqual({ nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, password: 'secreta123' });
  });

  it('409 (field null): mensaje en email con aria-invalid, enlace «Ingresar» y el nombre conservado', async () => {
    const logins: PedidoAuth[] = [];
    server.use(handlerRegister(errorApi(409, 'HTTP_409', 'El email ya está registrado')), handlerLogin(loginOk(), logins));
    const { usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.click(botonCrear());

    expect(await screen.findByText(/Ya existe una cuenta con este email\./)).toBeInTheDocument();
    expect(await etiqueta('Email')).toHaveAttribute('aria-invalid', 'true');
    const idError = (await etiqueta('Email')).getAttribute('aria-describedby') ?? '';
    const error = document.getElementById(idError);
    expect(error).not.toBeNull();
    expect(within(error as HTMLElement).getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar');
    expect(await etiqueta('Nombre')).toHaveValue('Ana');
    expect(logins).toHaveLength(0);
  });

  it('422 con field email: el detail se ve junto al email', async () => {
    server.use(handlerRegister(errorApi(422, 'VALIDATION_ERROR', 'Email no válido para el servidor', 'email')));
    const { usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.click(botonCrear());

    expect(await screen.findByText('Email no válido para el servidor')).toBeInTheDocument();
    expect(await etiqueta('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('422 con field nombre: el detail se ve junto al nombre', async () => {
    server.use(handlerRegister(errorApi(422, 'VALIDATION_ERROR', 'El nombre no es válido', 'nombre')));
    const { usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.click(botonCrear());

    expect(await screen.findByText('El nombre no es válido')).toBeInTheDocument();
    expect(await etiqueta('Nombre')).toHaveAttribute('aria-invalid', 'true');
  });

  it('422 con field body: alerta general del formulario', async () => {
    server.use(handlerRegister(errorApi(422, 'VALIDATION_ERROR', 'Cuerpo inválido', 'body')));
    const { usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.click(botonCrear());

    expect(await screen.findByRole('alert')).toHaveTextContent('Cuerpo inválido');
  });

  it('registro 201 + login 429: va a /ingresar con el email precargado, contraseña vacía y aviso de cuenta creada', async () => {
    server.use(
      handlerRegister(registroOk({ email: 'ana@example.com' })),
      handlerLogin(errorApi(429, 'RATE_LIMIT_EXCEEDED', 'Demasiados intentos', null, { 'Retry-After': '60' })),
    );
    const { router, usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.click(botonCrear());

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'));
    expect(await screen.findByText('Tu cuenta se creó.')).toBeInTheDocument();
    expect(await etiqueta('Email')).toHaveValue('ana@example.com');
    expect(await etiqueta('Contraseña')).toHaveValue('');
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('contraseñas distintas: error en «Repetir contraseña» y ningún pedido', async () => {
    const registros: PedidoAuth[] = [];
    server.use(handlerRegister(registroOk(), registros));
    const { usuario } = renderApp('/registrarse');
    await completar(usuario, { confirmacion: 'secreta12' });

    await usuario.click(botonCrear());

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(await etiqueta('Repetir contraseña')).toHaveAttribute('aria-invalid', 'true');
    expect(registros).toHaveLength(0);
  });

  it('enviar vacío muestra los errores y no hace ningún pedido', async () => {
    const registros: PedidoAuth[] = [];
    server.use(handlerRegister(registroOk(), registros));
    const { usuario } = renderApp('/registrarse');
    await etiqueta('Nombre');

    await usuario.click(botonCrear());

    expect(await screen.findByText('Ingresá tu nombre')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu apellido')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu email')).toBeInTheDocument();
    expect(screen.getByText('Ingresá una contraseña')).toBeInTheDocument();
    expect(registros).toHaveLength(0);
  });

  it('nombre en blanco, apellido vacío y nombre de 81 caracteres muestran su error junto a cada campo', async () => {
    const { usuario } = renderApp('/registrarse');
    await usuario.type(await etiqueta('Nombre'), '   ');
    await usuario.tab();
    await usuario.tab();
    expect(await screen.findByText('Ingresá tu nombre')).toBeInTheDocument();
    expect(await screen.findByText('Ingresá tu apellido')).toBeInTheDocument();

    await usuario.clear(await etiqueta('Nombre'));
    await usuario.click(await etiqueta('Nombre'));
    await usuario.paste('a'.repeat(81));
    await usuario.tab();

    expect(await screen.findByText('Máximo 80 caracteres')).toBeInTheDocument();
  });

  it('contraseña corta muestra «Usá al menos 8 caracteres»', async () => {
    const { usuario } = renderApp('/registrarse');

    await usuario.type(await etiqueta('Contraseña'), '1234567');
    await usuario.tab();

    expect(await screen.findByText('Usá al menos 8 caracteres')).toBeInTheDocument();
  });

  it('doble clic con registro demorado: un solo POST /auth/register', async () => {
    const registros: PedidoAuth[] = [];
    server.use(
      handlerRegister(async () => {
        await delay(150);
        return HttpResponse.json({ id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null }, { status: 201 });
      }, registros),
      handlerLogin(loginOk('A1')),
      handlerMe(['CLIENT']),
    );
    const { usuario } = renderApp('/registrarse');
    await completar(usuario);

    await usuario.dblClick(botonCrear());

    expect(await screen.findByRole('button', { name: 'Creando cuenta…' })).toBeDisabled();
    await waitFor(() => expect(selectEstado(useAuthStore.getState())).toBe('autenticada'));
    expect(registros).toHaveLength(1);
  });

  it('autocompletado de cada campo', async () => {
    renderApp('/registrarse');

    expect(await etiqueta('Nombre')).toHaveAttribute('autocomplete', 'given-name');
    expect(await etiqueta('Apellido')).toHaveAttribute('autocomplete', 'family-name');
    expect(await etiqueta('Email')).toHaveAttribute('autocomplete', 'email');
    expect(await etiqueta('Celular (opcional)')).toHaveAttribute('autocomplete', 'tel');
    expect(await etiqueta('Contraseña')).toHaveAttribute('autocomplete', 'new-password');
    expect(await etiqueta('Repetir contraseña')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('el enlace «Ingresá» lleva a /ingresar', async () => {
    const { router, usuario } = renderApp('/registrarse');

    await usuario.click(await screen.findByRole('link', { name: 'Ingresá' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'));
  });

  it('axe: sin violaciones vacío y con errores', async () => {
    const { usuario } = renderApp('/registrarse');
    await etiqueta('Nombre');
    await esperarSinViolacionesA11y(document.body);

    await usuario.click(botonCrear());
    await screen.findByText('Ingresá tu nombre');

    await esperarSinViolacionesA11y(document.body);
  });
});
