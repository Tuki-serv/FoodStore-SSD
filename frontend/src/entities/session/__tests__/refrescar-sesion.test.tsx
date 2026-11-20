import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { esApiError } from '@/shared/api';
import { selectRoles, selectUsuario, useAuthStore } from '@/shared/auth';
import { handlerMe } from '@/test/msw/auth';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { API, server } from '@/test/msw/server';
import { iniciarSesionDePrueba } from '@/test/sesion';
import { useRefrescarSesion } from '..';

const sesion = () => useAuthStore.getState();
const wrapper = () => ({ wrapper: envolverConQuery(crearQueryClientDePrueba()) });

afterEach(() => useAuthStore.getState().reset());

describe('useRefrescarSesion', () => {
  it('vuelve a pedir GET /auth/me y reemplaza el usuario de la sesión (roles nuevos incluidos) sin tocar el access', async () => {
    iniciarSesionDePrueba(['ADMIN', 'CLIENT']);
    server.use(handlerMe(['ADMIN', 'CLIENT', 'STOCK'], { nombre: 'Ana María' }));
    const { result } = renderHook(() => useRefrescarSesion(), wrapper());

    await act(() => result.current.mutateAsync());

    expect(selectRoles(sesion())).toEqual(['ADMIN', 'CLIENT', 'STOCK']);
    expect(selectUsuario(sesion())?.nombre).toBe('Ana María');
    expect(sesion().accessToken).toBe('A1');
    expect(sesion().estado).toBe('autenticada');
  });

  it('si /auth/me falla relanza el ApiError y conserva la sesión como estaba', async () => {
    iniciarSesionDePrueba(['ADMIN', 'CLIENT']);
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ detail: 'Falló', code: 'HTTP_500', field: null }, { status: 500 })));
    const { result } = renderHook(() => useRefrescarSesion(), wrapper());

    const fallo = await act(async () => result.current.mutateAsync().catch((error: unknown) => error));

    expect(esApiError(fallo) && fallo.status).toBe(500);
    expect(selectRoles(sesion())).toEqual(['ADMIN', 'CLIENT']);
  });
});
