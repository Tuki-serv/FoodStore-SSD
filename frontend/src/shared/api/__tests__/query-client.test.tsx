import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { API, server } from '@/test/msw/server';
import { apiClient } from '../http-client';
import { crearQueryClient } from '../query-client';

function envoltorio(cliente: ReturnType<typeof crearQueryClient>) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

/** Handler que responde según la lista dada, en orden, y cuenta los pedidos. */
function responder(metodo: 'get' | 'post', path: string, estados: number[]): { pedidos: number } {
  const cuenta = { pedidos: 0 };
  server.use(
    http[metodo](`${API}${path}`, () => {
      const estado = estados[Math.min(cuenta.pedidos, estados.length - 1)] ?? 500;
      cuenta.pedidos += 1;
      return estado === 200
        ? HttpResponse.json({ ok: true })
        : HttpResponse.json({ detail: 'Falla', code: `HTTP_${estado}`, field: null }, { status: estado });
    }),
  );
  return cuenta;
}

const consultar = (path: string) => () => apiClient.get<{ ok: boolean }>(path).then((r) => r.data);

describe('política de reintentos de TanStack Query', () => {
  it('un 404 no se reintenta: un pedido y el error llega tipado como ApiError', async () => {
    const cuenta = responder('get', '/productos/999', [404]);
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'detalle', 999], queryFn: consultar('/productos/999') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cuenta.pedidos).toBe(1);
    expect(result.current.error?.code).toBe('HTTP_404');
    expect(result.current.error?.status).toBe(404);
  });

  it('un 422 tampoco se reintenta', async () => {
    const cuenta = responder('get', '/productos', [422]);
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'lista', {}], queryFn: consultar('/productos') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cuenta.pedidos).toBe(1);
  });

  it('un 503 y luego 200 entrega los datos tras dos pedidos', async () => {
    const cuenta = responder('get', '/productos', [503, 200]);
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'lista', {}], queryFn: consultar('/productos') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ ok: true });
    expect(cuenta.pedidos).toBe(2);
  });

  it('un 503 persistente se reintenta una sola vez y falla', async () => {
    const cuenta = responder('get', '/productos', [503]);
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'lista', {}], queryFn: consultar('/productos') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cuenta.pedidos).toBe(2);
  });

  it('una falla de red también se reintenta una vez', async () => {
    let pedidos = 0;
    server.use(
      http.get(`${API}/productos`, () => {
        pedidos += 1;
        return pedidos === 1 ? HttpResponse.error() : HttpResponse.json({ ok: true });
      }),
    );
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'lista', {}], queryFn: consultar('/productos') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidos).toBe(2);
  });

  it('una mutación que falla con 503 no se reintenta', async () => {
    const cuenta = responder('post', '/pedidos', [503]);
    const cliente = crearQueryClient({ reintentoEspera: 0 });

    const { result } = renderHook(() => useMutation({ mutationFn: () => apiClient.post('/pedidos', {}) }), {
      wrapper: envoltorio(cliente),
    });
    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cuenta.pedidos).toBe(1);
    expect(result.current.error?.status).toBe(503);
  });

  it('con conReintentos: false un 503 no se reintenta', async () => {
    const cuenta = responder('get', '/productos', [503, 200]);
    const cliente = crearQueryClient({ conReintentos: false });

    const { result } = renderHook(() => useQuery({ queryKey: ['productos', 'lista', {}], queryFn: consultar('/productos') }), {
      wrapper: envoltorio(cliente),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cuenta.pedidos).toBe(1);
  });
});
