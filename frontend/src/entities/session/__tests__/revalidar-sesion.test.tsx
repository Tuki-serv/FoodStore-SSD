import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api';
import { selectEstado, selectRoles, useAuthStore } from '@/shared/auth';
import { respuestaRefresh, usuarioDto } from '@/test/msw/auth';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba } from '@/test/query';
import { iniciarSesionDePrueba } from '@/test/sesion';
import { INTERVALO_REVALIDACION_MS, useRevalidarSesion } from '..';

const sesion = () => useAuthStore.getState();
const SIN_AUTORIZACION = { detail: 'Credenciales inválidas', code: 'HTTP_401', field: null };

/** Monta el hook como lo hace el shell: con la ruta actual del router. Devuelve cómo navegar. */
function montar() {
  const navegador: { ir: NavigateFunction | null } = { ir: null };
  function Sonda() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
      navegador.ir = navigate;
    }, [navigate]);
    useRevalidarSesion(pathname);
    return null;
  }
  render(
    <QueryClientProvider client={crearQueryClientDePrueba()}>
      <MemoryRouter initialEntries={['/carrito']}>
        <Sonda />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    navegar: (ruta: string) =>
      act(async () => {
        await navegador.ir?.(ruta);
      }),
  };
}

/** `GET /auth/me`: cuenta los pedidos y responde con `respuesta` (200 con el usuario ADMIN por defecto). */
function contarMe(respuesta: () => Response = () => HttpResponse.json(usuarioDto(['ADMIN']))) {
  const cuenta = { llamadas: 0 };
  server.use(
    http.get(`${API}/auth/me`, () => {
      cuenta.llamadas += 1;
      return respuesta();
    }),
  );
  return cuenta;
}

const respuesta401 = () => HttpResponse.json(SIN_AUTORIZACION, { status: 401 });
const pasarSegundos = (segundos: number) => vi.advanceTimersByTime(segundos * 1000);

function enfocarVentana() {
  act(() => {
    window.dispatchEvent(new Event('focus'));
  });
}

function cambiarVisibilidad(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  // Solo `Date`: los timers reales siguen corriendo para MSW, TanStack Query y `waitFor`.
  vi.useFakeTimers({ toFake: ['Date'] });
  iniciarSesionDePrueba(['CLIENT']);
});

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState');
  vi.useRealTimers();
  sesion().reset();
});

describe('useRevalidarSesion: sesión cerrada en otro dispositivo', () => {
  it('cambiar de ruta pasados 15 s con /auth/me y /auth/refresh en 401 deja la sesión anónima por vencimiento', async () => {
    const me = contarMe(respuesta401);
    const { navegar } = montar();
    pasarSegundos(16);

    await navegar('/mis-pedidos');

    await waitFor(() => expect(selectEstado(sesion())).toBe('anonima'));
    expect(sesion().motivo).toBe('expirada');
    expect(me.llamadas).toBe(1);
  });

  it('volver a la pestaña (visibilitychange a visible) pasados 15 s dispara la verificación', async () => {
    const me = contarMe(respuesta401);
    montar();
    cambiarVisibilidad('hidden');
    pasarSegundos(16);

    cambiarVisibilidad('visible');

    await waitFor(() => expect(selectEstado(sesion())).toBe('anonima'));
    expect(sesion().motivo).toBe('expirada');
    expect(me.llamadas).toBe(1);
  });

  it('recuperar el foco de la ventana pasados 15 s dispara la verificación', async () => {
    const me = contarMe();
    montar();
    pasarSegundos(16);

    enfocarVentana();

    await waitFor(() => expect(me.llamadas).toBe(1));
  });
});

describe('useRevalidarSesion: sesión vigente y fallos de red', () => {
  it('con 200 la sesión sigue autenticada y el usuario queda con los roles de la respuesta', async () => {
    contarMe();
    const { navegar } = montar();
    pasarSegundos(16);

    await navegar('/mis-pedidos');

    await waitFor(() => expect(selectRoles(sesion())).toEqual(['ADMIN']));
    expect(selectEstado(sesion())).toBe('autenticada');
  });

  it('con el backend caído o 503 la sesión sigue autenticada', async () => {
    let falla: () => Response = () => HttpResponse.error();
    const me = contarMe(() => falla());
    const { navegar } = montar();
    pasarSegundos(16);
    await navegar('/mis-pedidos');
    await waitFor(() => expect(me.llamadas).toBe(1));
    falla = () => HttpResponse.json({ detail: 'Caído', code: 'HTTP_503', field: null }, { status: 503 });
    pasarSegundos(16);

    await navegar('/carrito');

    await waitFor(() => expect(me.llamadas).toBe(2));
    expect(selectEstado(sesion())).toBe('autenticada');
    expect(selectRoles(sesion())).toEqual(['CLIENT']);
  });
});

describe('useRevalidarSesion: acotada', () => {
  it('sin sesión (anónima) no pide nada al navegar, enfocar ni cambiar de pestaña', async () => {
    sesion().cerrarLocal();
    const me = contarMe();
    const { navegar } = montar();
    pasarSegundos(60);

    await navegar('/catalogo');
    enfocarVentana();
    cambiarVisibilidad('visible');

    expect(me.llamadas).toBe(0);
  });

  it('con la pestaña oculta no verifica', async () => {
    const me = contarMe();
    const { navegar } = montar();
    cambiarVisibilidad('hidden');
    pasarSegundos(16);

    await navegar('/mis-pedidos');
    enfocarVentana();

    expect(me.llamadas).toBe(0);
  });

  it('una ráfaga de tres navegaciones, foco y visibilidad en menos de 15 s hace un solo GET /auth/me', async () => {
    const me = contarMe();
    const { navegar } = montar();
    pasarSegundos(16);

    await navegar('/mis-pedidos');
    await navegar('/direcciones');
    await navegar('/carrito');
    enfocarVentana();
    cambiarVisibilidad('visible');

    await waitFor(() => expect(me.llamadas).toBe(1));
    expect(me.llamadas).toBe(1);
  });

  it('navegar 16 s después de una verificación hace una segunda', async () => {
    const me = contarMe();
    const { navegar } = montar();
    pasarSegundos(16);
    await navegar('/mis-pedidos');
    await waitFor(() => expect(me.llamadas).toBe(1));

    pasarSegundos(16);
    await navegar('/carrito');

    await waitFor(() => expect(me.llamadas).toBe(2));
  });

  it('recién abierta la sesión, navegar antes de 15 s no verifica', async () => {
    const me = contarMe();
    const { navegar } = montar();
    pasarSegundos(INTERVALO_REVALIDACION_MS / 1000 - 1);

    await navegar('/mis-pedidos');

    expect(me.llamadas).toBe(0);
  });

  it('GET /auth/me y otro pedido con 401 al mismo tiempo comparten una sola renovación', async () => {
    let refrescos = 0;
    const conAccessNuevo = (ok: () => Response) => ({ request }: { request: Request }): Response =>
      request.headers.get('authorization') === 'Bearer A2' ? ok() : respuesta401();
    server.use(
      http.get(`${API}/auth/me`, conAccessNuevo(() => HttpResponse.json(usuarioDto(['CLIENT'])))),
      http.get(`${API}/pedidos/`, conAccessNuevo(() => HttpResponse.json({ items: [] }))),
      http.post(`${API}/auth/refresh`, () => {
        refrescos += 1;
        return respuestaRefresh('A2');
      }),
    );
    const { navegar } = montar();
    pasarSegundos(16);

    await act(async () => {
      const otro = apiClient.get('/pedidos/');
      await navegar('/mis-pedidos');
      await otro;
    });

    await waitFor(() => expect(sesion().accessToken).toBe('A2'));
    expect(refrescos).toBe(1);
    expect(selectEstado(sesion())).toBe('autenticada');
  });
});
