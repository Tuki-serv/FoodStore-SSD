import { delay, http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { selectEstado, useAuthStore, type UsuarioSesion } from '@/shared/auth';
import { API, server } from '@/test/msw/server';
import { esApiError } from '../api-error';
import { apiClient } from '../http-client';

const usuario: UsuarioSesion = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles: ['CLIENT'] };

const sinSesion = () => HttpResponse.json({ detail: 'Sesión inválida', code: 'HTTP_401', field: null }, { status: 401 });
const vencido = () => HttpResponse.json({ detail: 'Token vencido', code: 'HTTP_401', field: null }, { status: 401 });
const bearer = (request: Request): string | null => request.headers.get('Authorization');

interface Espia {
  refreshes: number;
  /** Authorization recibido por cada llamada a las rutas protegidas, en orden. */
  autorizaciones: (string | null)[];
}

/** `refresh` responde 200 con `accessNuevo` (tras `demora` ms) o 401; cuenta las llamadas. */
function simularRefresh(opciones: { accessNuevo?: string; demora?: number } = {}): Espia {
  const espia: Espia = { refreshes: 0, autorizaciones: [] };
  server.use(
    http.post(`${API}/auth/refresh`, async () => {
      espia.refreshes += 1;
      if (opciones.demora !== undefined) await delay(opciones.demora);
      return opciones.accessNuevo === undefined
        ? sinSesion()
        : HttpResponse.json({ access_token: opciones.accessNuevo, token_type: 'bearer', expires_in: 1800 });
    }),
  );
  return espia;
}

/** Ruta que responde 401 salvo con `Bearer <valido>`; registra el Authorization de cada llamada. */
function rutaProtegida(path: string, valido: string, espia: Espia): void {
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      espia.autorizaciones.push(bearer(request));
      return bearer(request) === `Bearer ${valido}` ? HttpResponse.json({ ruta: path }) : vencido();
    }),
  );
}

describe('renovación transparente ante un 401', () => {
  beforeEach(() => {
    useAuthStore.getState().establecerSesion('A1', usuario);
  });

  it('renueva, repite el pedido con el access nuevo y entrega el 200 original', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    rutaProtegida('/pedidos', 'A2', espia);

    const respuesta = await apiClient.get('/pedidos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.data).toEqual({ ruta: '/pedidos' });
    expect(useAuthStore.getState().accessToken).toBe('A2');
    expect(espia.refreshes).toBe(1);
    expect(espia.autorizaciones).toEqual(['Bearer A1', 'Bearer A2']);
  });

  it('tres pedidos concurrentes con 401 comparten una sola renovación', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2', demora: 50 });
    rutaProtegida('/pedidos', 'A2', espia);
    rutaProtegida('/direcciones', 'A2', espia);
    rutaProtegida('/perfil', 'A2', espia);

    const respuestas = await Promise.all([apiClient.get('/pedidos'), apiClient.get('/direcciones'), apiClient.get('/perfil')]);

    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(espia.refreshes).toBe(1);
    expect(espia.autorizaciones.filter((a) => a === 'Bearer A2')).toHaveLength(3);
  });

  it('si el reintento vuelve a dar 401 llega un ApiError 401 con una sola renovación', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    rutaProtegida('/pedidos', 'NUNCA', espia);

    const error = await apiClient.get('/pedidos').catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(401);
    expect(espia.refreshes).toBe(1);
    expect(espia.autorizaciones).toEqual(['Bearer A1', 'Bearer A2']);
  });

  it('un 401 de POST /auth/login no renueva y llega directo', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ detail: 'Credenciales inválidas', code: 'HTTP_401', field: null }, { status: 401 }),
      ),
    );

    const error = await apiClient.post('/auth/login', new URLSearchParams({ username: 'a', password: 'b' })).catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(401);
    expect(esApiError(error) && error.detail).toBe('Credenciales inválidas');
    expect(espia.refreshes).toBe(0);
    expect(useAuthStore.getState().accessToken).toBe('A1');
  });

  it('un 401 directo de POST /auth/refresh no dispara otra renovación', async () => {
    const espia = simularRefresh();

    const error = await apiClient.post('/auth/refresh').catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(401);
    expect(espia.refreshes).toBe(1);
  });

  it('un 401 de POST /auth/logout renueva y repite el logout con el access nuevo', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    const autorizaciones: (string | null)[] = [];
    server.use(
      http.post(`${API}/auth/logout`, ({ request }) => {
        autorizaciones.push(bearer(request));
        return bearer(request) === 'Bearer A2' ? new HttpResponse(null, { status: 204 }) : vencido();
      }),
    );

    const respuesta = await apiClient.post('/auth/logout');

    expect(respuesta.status).toBe(204);
    expect(autorizaciones).toEqual(['Bearer A1', 'Bearer A2']);
    expect(espia.refreshes).toBe(1);
  });

  it('un 401 de un pedido enviado con A1 cuando la sesión ya tiene A2 se repite sin renovar', async () => {
    const espia = simularRefresh({ accessNuevo: 'A3' });
    const autorizaciones: (string | null)[] = [];
    server.use(
      http.get(`${API}/pedidos`, ({ request }) => {
        autorizaciones.push(bearer(request));
        if (bearer(request) === 'Bearer A1') {
          // Otra renovación terminó mientras este pedido estaba en vuelo.
          useAuthStore.getState().establecerAccess('A2');
          return vencido();
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const respuesta = await apiClient.get('/pedidos');

    expect(respuesta.status).toBe(200);
    expect(autorizaciones).toEqual(['Bearer A1', 'Bearer A2']);
    expect(espia.refreshes).toBe(0);
  });

  it('si la renovación responde 401 la sesión queda anónima por vencimiento y todos los pedidos en espera fallan con 401', async () => {
    const espia = simularRefresh({ demora: 30 });
    rutaProtegida('/pedidos', 'NUNCA', espia);
    rutaProtegida('/direcciones', 'NUNCA', espia);
    rutaProtegida('/perfil', 'NUNCA', espia);

    const resultados = await Promise.allSettled([apiClient.get('/pedidos'), apiClient.get('/direcciones'), apiClient.get('/perfil')]);

    expect(resultados.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected']);
    for (const resultado of resultados) {
      expect(resultado.status === 'rejected' && esApiError(resultado.reason) && resultado.reason.status).toBe(401);
    }
    expect(espia.refreshes).toBe(1);
    const sesion = useAuthStore.getState();
    expect(selectEstado(sesion)).toBe('anonima');
    expect(sesion.motivo).toBe('expirada');
    expect(sesion.accessToken).toBeNull();
    expect(sesion.usuario).toBeNull();
  });

  it('si la renovación falla sin respuesta también cierra la sesión local', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()));
    rutaProtegida('/pedidos', 'NUNCA', { refreshes: 0, autorizaciones: [] });

    const error = await apiClient.get('/pedidos').catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(401);
    expect(selectEstado(useAuthStore.getState())).toBe('anonima');
  });

  it('una lectura pública con access inválido renueva y devuelve el listado', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    server.use(
      http.get(`${API}/productos`, ({ request }) => {
        espia.autorizaciones.push(bearer(request));
        return bearer(request) === 'Bearer A2' ? HttpResponse.json([{ id: 1 }]) : vencido();
      }),
    );

    const respuesta = await apiClient.get('/productos');

    expect(respuesta.data).toEqual([{ id: 1 }]);
    expect(espia.refreshes).toBe(1);
  });

  it('un error que no es 401 no renueva', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2' });
    server.use(
      http.get(`${API}/pedidos`, () => HttpResponse.json({ detail: 'No autorizado', code: 'HTTP_403', field: null }, { status: 403 })),
    );

    const error = await apiClient.get('/pedidos').catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(403);
    expect(espia.refreshes).toBe(0);
  });

  it('si el logout ocurre con una renovación en vuelo, la respuesta tardía no reabre la sesión', async () => {
    const espia = simularRefresh({ accessNuevo: 'A2', demora: 100 });
    rutaProtegida('/pedidos', 'A2', espia);

    const pedido = apiClient.get('/pedidos').catch((e: unknown) => e);
    await vi.waitFor(() => expect(espia.refreshes).toBe(1), { interval: 2 });
    useAuthStore.getState().cerrarLocal({ motivo: 'logout' });
    const resultado = await pedido;

    expect(esApiError(resultado) && resultado.status).toBe(401);
    const sesion = useAuthStore.getState();
    expect(selectEstado(sesion)).toBe('anonima');
    expect(sesion.accessToken).toBeNull();
    expect(sesion.usuario).toBeNull();
    expect(sesion.motivo).toBe('logout');
  });

  it('si el logout ocurre con una renovación que falla, el motivo sigue siendo logout', async () => {
    const espia = simularRefresh({ demora: 100 });
    rutaProtegida('/pedidos', 'NUNCA', espia);

    const pedido = apiClient.get('/pedidos').catch((e: unknown) => e);
    await vi.waitFor(() => expect(espia.refreshes).toBe(1), { interval: 2 });
    useAuthStore.getState().cerrarLocal({ motivo: 'logout' });
    await pedido;

    expect(useAuthStore.getState().motivo).toBe('logout');
  });
});
