import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { esApiError } from '@/shared/api';
import { selectEstado, selectRoles, useAuthStore } from '@/shared/auth';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { errorApi, handlerLogin, handlerMe, loginOk, type PedidoAuth } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { useIniciarSesion } from '..';

const sesion = () => useAuthStore.getState();

function renderIniciar() {
  return renderHook(() => useIniciarSesion(), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
}

/** Cuenta los pedidos a `POST /auth/refresh` (no debe haber ninguno en un login fallido). */
function espiarRefresh(): { llamadas: number } {
  const espia = { llamadas: 0 };
  server.use(
    http.post(`${API}/auth/refresh`, () => {
      espia.llamadas += 1;
      return HttpResponse.json({ detail: 'Sesión inválida', code: 'HTTP_401', field: null }, { status: 401 });
    }),
  );
  return espia;
}

async function fallo(promesa: Promise<unknown>): Promise<unknown> {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('useIniciarSesion', () => {
  it('envía username/password como formulario urlencoded con el email recortado y deja la sesión autenticada con A1', async () => {
    const pedidos: PedidoAuth[] = [];
    server.use(handlerLogin(loginOk('A1'), pedidos), handlerMe(['CLIENT']));
    const { result } = renderIniciar();

    await act(() => result.current.mutateAsync({ email: ' ana@example.com ', password: 'secreta123' }));

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.contentType).toContain('application/x-www-form-urlencoded');
    expect(pedidos[0]?.texto).toBe('username=ana%40example.com&password=secreta123');
    expect(selectEstado(sesion())).toBe('autenticada');
    expect(sesion().accessToken).toBe('A1');
    expect(selectRoles(sesion())).toEqual(['CLIENT']);
  });

  it('con 401 rechaza con ApiError HTTP_401, deja la sesión anónima y no pide /auth/refresh', async () => {
    const refresh = espiarRefresh();
    server.use(handlerLogin(errorApi(401, 'HTTP_401', 'Credenciales incorrectas')));
    const { result } = renderIniciar();
    sesion().cerrarLocal();

    const error = await act(() => fallo(result.current.mutateAsync({ email: 'ana@example.com', password: 'mala' })));

    expect(esApiError(error) && error.code).toBe('HTTP_401');
    expect(selectEstado(sesion())).toBe('anonima');
    expect(refresh.llamadas).toBe(0);
  });

  it('con 429 y Retry-After 840 rechaza con retryAfter 840', async () => {
    server.use(handlerLogin(errorApi(429, 'RATE_LIMIT_EXCEEDED', 'Demasiados intentos', null, { 'Retry-After': '840' })));
    const { result } = renderIniciar();

    const error = await act(() => fallo(result.current.mutateAsync({ email: 'ana@example.com', password: 'x' })));

    expect(esApiError(error) && error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(esApiError(error) && error.retryAfter).toBe(840);
  });

  it('con login 200 y /auth/me 404 la sesión queda anónima sin access', async () => {
    server.use(
      handlerLogin(loginOk('A1')),
      http.get(`${API}/auth/me`, () => HttpResponse.json({ detail: 'Usuario no encontrado', code: 'HTTP_404', field: null }, { status: 404 })),
    );
    const { result } = renderIniciar();

    const error = await act(() => fallo(result.current.mutateAsync({ email: 'ana@example.com', password: 'secreta123' })));

    expect(esApiError(error) && error.status).toBe(404);
    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().accessToken).toBeNull();
  });
});
