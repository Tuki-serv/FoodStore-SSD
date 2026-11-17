import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiClient } from '@/shared/api';
import { useAuthStore } from '@/shared/auth';
import { handlerMe, handlerRefreshOk, respuestaRefresh } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

const ACCESS_REHIDRATADO = 'TOKEN-REHIDRATADO';
const ACCESS_RENOVADO = 'TOKEN-RENOVADO';

/** Todas las entradas (`clave=valor`) de ambos almacenes del navegador. */
function entradasDeStorage(): string[] {
  return [window.localStorage, window.sessionStorage].flatMap((almacen) =>
    Array.from({ length: almacen.length }, (_, i) => {
      const clave = almacen.key(i) ?? '';
      return `${clave}=${almacen.getItem(clave) ?? ''}`;
    }),
  );
}

describe('el access token no deja rastro en el storage', () => {
  it('ni al rehidratar la sesión al arrancar ni al renovarla tras un 401', async () => {
    server.use(handlerRefreshOk(ACCESS_REHIDRATADO), handlerMe(['CLIENT']));
    renderApp('/catalogo');
    await screen.findByRole('heading', { name: 'Catálogo', level: 1 });
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe(ACCESS_REHIDRATADO));

    server.use(
      http.post(`${API}/auth/refresh`, () => respuestaRefresh(ACCESS_RENOVADO)),
      http.get(`${API}/pedidos`, ({ request }) =>
        request.headers.get('Authorization') === `Bearer ${ACCESS_RENOVADO}`
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ detail: 'Token vencido', code: 'HTTP_401', field: null }, { status: 401 }),
      ),
    );
    await apiClient.get('/pedidos');

    expect(useAuthStore.getState().accessToken).toBe(ACCESS_RENOVADO);
    const entradas = entradasDeStorage();
    expect(entradas.filter((e) => e.includes(ACCESS_REHIDRATADO) || e.includes(ACCESS_RENOVADO))).toEqual([]);
    const clavesPermitidas = ['foodstore.ui', 'foodstore.cart'];
    const claves = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i) ?? '');
    expect(claves.filter((clave) => !clavesPermitidas.includes(clave))).toEqual([]);
    expect(window.sessionStorage.length).toBe(0);
  });
});
