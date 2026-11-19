import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esApiError } from '@/shared/api';
import { selectEstado, selectRoles, selectUsuario, useAuthStore, type UsuarioSesion } from '@/shared/auth';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import {
  errorApi,
  handlerLogin,
  handlerLogoutAll,
  handlerMe,
  handlerPatchPerfil,
  handlerRegister,
  loginOk,
  perfilOk,
  registroOk,
  sinContenido,
  type PedidoAuth,
} from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { useActualizarPerfil, useCerrarTodasLasSesiones, useRegistrarse } from '..';

const sesion = () => useAuthStore.getState();
const wrapper = () => ({ wrapper: envolverConQuery(crearQueryClientDePrueba()) });

const datosRegistro = { nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, password: 'secreta123' };

async function fallo(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('useRegistrarse', () => {
  it('201 + login 200: abre la sesión, el cuerpo es el JSON exacto y el login usa el mismo email y contraseña', async () => {
    const registros: PedidoAuth[] = [];
    const logins: PedidoAuth[] = [];
    server.use(handlerRegister(registroOk(), registros), handlerLogin(loginOk('A1'), logins), handlerMe(['CLIENT']));
    const { result } = renderHook(() => useRegistrarse(), wrapper());

    const resultado = await act(() => result.current.mutateAsync(datosRegistro));

    expect(resultado).toEqual({ tipo: 'sesionAbierta' });
    expect(registros[0]?.cuerpo).toEqual({ nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, password: 'secreta123' });
    expect(logins[0]?.cuerpo).toEqual({ username: 'ana@example.com', password: 'secreta123' });
    expect(selectEstado(sesion())).toBe('autenticada');
    expect(selectRoles(sesion())).toEqual(['CLIENT']);
  });

  it('409: rechaza con ApiError HTTP_409 y no intenta el login', async () => {
    const logins: PedidoAuth[] = [];
    server.use(handlerRegister(errorApi(409, 'HTTP_409', 'El email ya está registrado')), handlerLogin(loginOk(), logins));
    const { result } = renderHook(() => useRegistrarse(), wrapper());

    const error = await act(() => fallo(result.current.mutateAsync(datosRegistro)));

    expect(esApiError(error) && error.code).toBe('HTTP_409');
    expect(logins).toHaveLength(0);
  });

  it('201 + login 429: devuelve cuentaCreadaSinSesion con el email devuelto por el registro', async () => {
    sesion().cerrarLocal();
    server.use(
      handlerRegister(registroOk({ email: 'ana@example.com' })),
      handlerLogin(errorApi(429, 'RATE_LIMIT_EXCEEDED', 'Demasiados intentos', null, { 'Retry-After': '60' })),
    );
    const { result } = renderHook(() => useRegistrarse(), wrapper());

    const resultado = await act(() => result.current.mutateAsync({ ...datosRegistro, email: 'ANA@example.com' }));

    expect(resultado).toEqual({ tipo: 'cuentaCreadaSinSesion', email: 'ana@example.com' });
    expect(selectEstado(sesion())).toBe('anonima');
  });
});

describe('useActualizarPerfil', () => {
  const admin: UsuarioSesion = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles: ['ADMIN'] };

  it('200: reemplaza los datos de la sesión conservando los roles', async () => {
    sesion().establecerSesion('A1', admin);
    const pedidos: PedidoAuth[] = [];
    server.use(handlerPatchPerfil(perfilOk({ nombre: 'Analía' }), pedidos));
    const { result } = renderHook(() => useActualizarPerfil(), wrapper());

    await act(() => result.current.mutateAsync({ nombre: 'Analía', apellido: 'Gómez', celular: null }));

    expect(pedidos[0]?.authorization).toBe('Bearer A1');
    expect(pedidos[0]?.cuerpo).toEqual({ nombre: 'Analía', apellido: 'Gómez', celular: null });
    expect(selectUsuario(sesion())?.nombre).toBe('Analía');
    expect(selectRoles(sesion())).toEqual(['ADMIN']);
  });

  it('503: rechaza y la sesión no cambia', async () => {
    sesion().establecerSesion('A1', admin);
    server.use(handlerPatchPerfil(errorApi(503, 'HTTP_503', 'Servicio no disponible')));
    const { result } = renderHook(() => useActualizarPerfil(), wrapper());

    const error = await act(() => fallo(result.current.mutateAsync({ nombre: 'Analía', apellido: 'Gómez', celular: null })));

    expect(esApiError(error) && error.status).toBe(503);
    expect(selectUsuario(sesion())).toEqual(admin);
  });
});

describe('useCerrarTodasLasSesiones', () => {
  const cliente: UsuarioSesion = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles: ['CLIENT'] };

  it('204: POST /auth/logout-all con Bearer A1 y sesión anónima con motivo logout', async () => {
    sesion().establecerSesion('A1', cliente);
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogoutAll(sinContenido, pedidos));
    const { result } = renderHook(() => useCerrarTodasLasSesiones(), wrapper());

    await act(() => result.current.mutateAsync());

    expect(pedidos.map((p) => p.authorization)).toEqual(['Bearer A1']);
    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().motivo).toBe('logout');
  });

  it('sin respuesta (backend caído): la sesión queda anónima igual', async () => {
    sesion().establecerSesion('A1', cliente);
    server.use(http.post(`${API}/auth/logout-all`, () => HttpResponse.error()));
    const { result } = renderHook(() => useCerrarTodasLasSesiones(), wrapper());

    act(() => result.current.mutate());

    await waitFor(() => expect(selectEstado(sesion())).toBe('anonima'));
    expect(sesion().motivo).toBe('logout');
  });

  it('mientras el pedido está en curso la sesión sigue autenticada', async () => {
    sesion().establecerSesion('A1', cliente);
    server.use(
      handlerLogoutAll(async () => {
        await delay(50);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderHook(() => useCerrarTodasLasSesiones(), wrapper());

    act(() => result.current.mutate());
    expect(selectEstado(sesion())).toBe('autenticada');
    await waitFor(() => expect(selectEstado(sesion())).toBe('anonima'));
  });
});
