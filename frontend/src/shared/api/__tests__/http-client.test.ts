import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/shared/auth';
import { API, server } from '@/test/msw/server';
import { esApiError } from '../api-error';
import { apiClient } from '../http-client';
import { unirUrl } from '../url';

describe('cliente HTTP: URL base', () => {
  it('pide al path de la API bajo VITE_API_URL + /api/v1', async () => {
    let urlRecibida = '';
    server.use(
      http.get(`${API}/auth/me`, ({ request }) => {
        urlRecibida = request.url;
        return HttpResponse.json({ ok: true });
      }),
    );

    const respuesta = await apiClient.get('/auth/me');

    expect(respuesta.data).toEqual({ ok: true });
    expect(urlRecibida).toBe('http://localhost:8000/api/v1/auth/me');
  });

  it.each([
    ['http://localhost:8000', 'http://localhost:8000/api/v1'],
    ['http://localhost:8000/', 'http://localhost:8000/api/v1'],
    ['https://api.example.com//', 'https://api.example.com/api/v1'],
  ])('unirUrl(%s) normaliza la barra final', (base, esperada) => {
    expect(unirUrl(base, '/api/v1')).toBe(esperada);
  });
});

describe('cliente HTTP: credenciales y Bearer', () => {
  it('envía las credenciales del navegador', async () => {
    let credenciales: string | null = null;
    server.use(
      http.get(`${API}/productos`, ({ request }) => {
        credenciales = request.credentials;
        return HttpResponse.json([]);
      }),
    );

    await apiClient.get('/productos');

    expect(credenciales).toBe('include');
  });

  it('con access en la sesión agrega Authorization: Bearer', async () => {
    useAuthStore.getState().establecerAccess('A1');
    let autorizacion: string | null = null;
    server.use(
      http.get(`${API}/pedidos`, ({ request }) => {
        autorizacion = request.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiClient.get('/pedidos');

    expect(autorizacion).toBe('Bearer A1');
  });

  it('sin access no envía el header Authorization', async () => {
    let autorizacion: string | null = 'sin-leer';
    server.use(
      http.get(`${API}/productos`, ({ request }) => {
        autorizacion = request.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiClient.get('/productos');

    expect(autorizacion).toBeNull();
  });
});

describe('cliente HTTP: errores', () => {
  it('rechaza con ApiError (409 del backend)', async () => {
    server.use(
      http.post(`${API}/pedidos`, () =>
        HttpResponse.json({ detail: 'Stock insuficiente', code: 'INSUFFICIENT_STOCK', field: null }, { status: 409 }),
      ),
    );

    const error = await apiClient.post('/pedidos', {}).catch((e: unknown) => e);

    expect(esApiError(error)).toBe(true);
    expect(esApiError(error) && error.code).toBe('INSUFFICIENT_STOCK');
    expect(esApiError(error) && error.status).toBe(409);
  });

  it('un fallo de red llega como ApiError con NETWORK_ERROR', async () => {
    server.use(http.get(`${API}/productos`, () => HttpResponse.error()));

    const error = await apiClient.get('/productos').catch((e: unknown) => e);

    expect(esApiError(error) && error.code).toBe('NETWORK_ERROR');
  });
});
