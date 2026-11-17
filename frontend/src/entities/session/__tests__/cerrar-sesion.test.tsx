import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { selectEstado, selectUsuario, useAuthStore, type UsuarioSesion } from '@/shared/auth';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { handlerRefreshOk } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { useCerrarSesion } from '..';

const usuario: UsuarioSesion = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles: ['CLIENT'] };
const sesion = () => useAuthStore.getState();

function renderCerrar() {
  return renderHook(() => useCerrarSesion(), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
}

describe('useCerrarSesion', () => {
  it('logout 204: llama una vez a POST /auth/logout y deja la sesión anónima con motivo logout', async () => {
    sesion().establecerSesion('A1', usuario);
    const autorizaciones: (string | null)[] = [];
    server.use(
      http.post(`${API}/auth/logout`, ({ request }) => {
        autorizaciones.push(request.headers.get('Authorization'));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { result } = renderCerrar();

    await act(() => result.current.mutateAsync());

    expect(autorizaciones).toEqual(['Bearer A1']);
    expect(selectEstado(sesion())).toBe('anonima');
    expect(selectUsuario(sesion())).toBeNull();
    expect(sesion().accessToken).toBeNull();
    expect(sesion().motivo).toBe('logout');
  });

  it('logout sin respuesta (backend caído): la sesión queda anónima igual', async () => {
    sesion().establecerSesion('A1', usuario);
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()));
    const { result } = renderCerrar();

    act(() => result.current.mutate());

    await waitFor(() => expect(selectEstado(sesion())).toBe('anonima'));
    expect(sesion().motivo).toBe('logout');
  });

  it('logout 401 con access vencido: renueva y repite el logout con el access nuevo', async () => {
    sesion().establecerSesion('A1', usuario);
    server.use(handlerRefreshOk('A2'));
    const autorizaciones: (string | null)[] = [];
    server.use(
      http.post(`${API}/auth/logout`, ({ request }) => {
        autorizaciones.push(request.headers.get('Authorization'));
        return request.headers.get('Authorization') === 'Bearer A2'
          ? new HttpResponse(null, { status: 204 })
          : HttpResponse.json({ detail: 'Token vencido', code: 'HTTP_401', field: null }, { status: 401 });
      }),
    );
    const { result } = renderCerrar();

    await act(() => result.current.mutateAsync());

    expect(autorizaciones).toEqual(['Bearer A1', 'Bearer A2']);
    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().motivo).toBe('logout');
  });

  it('el carrito persistido sigue intacto tras cerrar sesión', async () => {
    const carrito = JSON.stringify({ state: { lineas: [{ productoId: 7, cantidad: 2 }, { productoId: 9, cantidad: 1 }] }, version: 1 });
    window.localStorage.setItem('foodstore.cart', carrito);
    sesion().establecerSesion('A1', usuario);
    const { result } = renderCerrar();

    await act(() => result.current.mutateAsync());

    expect(window.localStorage.getItem('foodstore.cart')).toBe(carrito);
  });
});
