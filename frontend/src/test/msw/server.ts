import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = 'http://localhost:8000/api/v1';

/** Handlers base: sin cookie de refresh (anónimo) y logout idempotente. Cada test sobrescribe con `server.use`. */
export const handlersBase = [
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ detail: 'Sesión inválida', code: 'HTTP_401', field: null }, { status: 401 }),
  ),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];

export const server = setupServer(...handlersBase);
