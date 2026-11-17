import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { selectEstado, selectRoles, selectUsuario, useAuthStore } from '@/shared/auth';
import { esApiError } from '@/shared/api';
import { handlerMe, handlerRefreshOk, usuarioDto } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { abrirSesion, rehidratarSesion } from '..';

const sesion = () => useAuthStore.getState();

/** Cuenta las llamadas a `GET /auth/me` y guarda el Authorization de cada una. */
function espiarMe(roles: readonly string[]): { llamadas: (string | null)[] } {
  const espia: { llamadas: (string | null)[] } = { llamadas: [] };
  server.use(
    http.get(`${API}/auth/me`, ({ request }) => {
      espia.llamadas.push(request.headers.get('Authorization'));
      return HttpResponse.json(usuarioDto(roles));
    }),
  );
  return espia;
}

describe('rehidratarSesion', () => {
  it('con cookie vigente: refresh, /auth/me y sesión autenticada con sus roles', async () => {
    server.use(handlerRefreshOk('A1'));
    const me = espiarMe(['CLIENT']);

    await rehidratarSesion();

    expect(selectEstado(sesion())).toBe('autenticada');
    expect(selectRoles(sesion())).toEqual(['CLIENT']);
    expect(sesion().accessToken).toBe('A1');
    expect(selectUsuario(sesion())).toEqual({
      id: 1,
      nombre: 'Ana',
      apellido: 'Gómez',
      email: 'ana@example.com',
      celular: null,
      roles: ['CLIENT'],
    });
    expect(me.llamadas).toEqual(['Bearer A1']);
  });

  it('con varios roles expone los códigos de roles[].codigo', async () => {
    server.use(handlerRefreshOk('A1'), handlerMe(['CLIENT', 'PEDIDOS']));

    await rehidratarSesion();

    expect(selectRoles(sesion())).toEqual(['CLIENT', 'PEDIDOS']);
  });

  it('refresh 401: queda anónima, sin llamar a /auth/me y sin lanzar error', async () => {
    const me = espiarMe(['CLIENT']);

    await expect(rehidratarSesion()).resolves.toBeUndefined();

    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().accessToken).toBeNull();
    expect(sesion().motivo).toBeNull();
    expect(me.llamadas).toEqual([]);
  });

  it('refresh sin respuesta (backend caído): queda anónima', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()));

    await rehidratarSesion();

    expect(selectEstado(sesion())).toBe('anonima');
  });

  it('refresh 503: queda anónima', async () => {
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ detail: 'Caído', code: 'HTTP_503', field: null }, { status: 503 })),
    );

    await rehidratarSesion();

    expect(selectEstado(sesion())).toBe('anonima');
  });

  it('si /auth/me falla tras renovar, queda anónima y sin access', async () => {
    server.use(
      handlerRefreshOk('A1'),
      http.get(`${API}/auth/me`, () => HttpResponse.json({ detail: 'No existe', code: 'HTTP_404', field: null }, { status: 404 })),
    );

    await rehidratarSesion();

    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().accessToken).toBeNull();
  });
});

describe('abrirSesion', () => {
  it('con el access de un login correcto deja la sesión autenticada como ADMIN', async () => {
    server.use(handlerMe(['ADMIN']));

    await abrirSesion('A1');

    expect(selectEstado(sesion())).toBe('autenticada');
    expect(sesion().accessToken).toBe('A1');
    expect(selectRoles(sesion())).toEqual(['ADMIN']);
  });

  it('si /auth/me responde 404 queda anónima sin access y rechaza con ApiError 404', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => HttpResponse.json({ detail: 'Usuario no encontrado', code: 'HTTP_404', field: null }, { status: 404 })),
    );

    const error = await abrirSesion('A1').catch((e: unknown) => e);

    expect(esApiError(error) && error.status).toBe(404);
    expect(selectEstado(sesion())).toBe('anonima');
    expect(sesion().accessToken).toBeNull();
  });
});
