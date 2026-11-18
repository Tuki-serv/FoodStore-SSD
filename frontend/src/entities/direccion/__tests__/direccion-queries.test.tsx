import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { useAuthStore } from '@/shared/auth';
import { crearEstadoDirecciones, direccionDto, handlersDirecciones, pedidosDe } from '@/test/msw/direcciones';
import { API, server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { direccionQueries } from '../index';

const casa = direccionDto({ id: 1, alias: 'Casa', es_principal: true });
const trabajo = direccionDto({ id: 2, alias: 'Trabajo' });

describe('direccionQueries.lista', () => {
  it('pide page y size con el Bearer y devuelve el Paginado con la principal primero', async () => {
    useAuthStore.getState().establecerAccess('A1');
    const estado = crearEstadoDirecciones([trabajo, casa]);
    server.use(...handlersDirecciones(estado));

    const { result } = renderHook(() => useQuery(direccionQueries.lista({ page: 1, size: 20 })), {
      wrapper: envolverConQuery(crearQueryClientDePrueba()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [pedido] = pedidosDe(estado, 'GET', '/');
    expect(pedido?.busqueda).toBe('?page=1&size=20');
    expect(pedido?.authorization).toBe('Bearer A1');
    expect(result.current.data).toEqual({ items: [casa, trabajo], total: 2, page: 1, size: 20, pages: 1 });
  });

  it('al pasar a la página 2 pide page=2 y mantiene los datos de la 1 mientras carga', async () => {
    const muchas = Array.from({ length: 25 }, (_, i) => direccionDto({ id: i + 1, alias: `Dir ${i + 1}`, es_principal: i === 0 }));
    const estado = crearEstadoDirecciones(muchas);
    server.use(...handlersDirecciones(estado));

    const { result } = renderHook(
      () => {
        const [page, setPage] = useState(1);
        return { page, setPage, consulta: useQuery(direccionQueries.lista({ page, size: 20 })) };
      },
      { wrapper: envolverConQuery(crearQueryClientDePrueba()) },
    );
    await waitFor(() => expect(result.current.consulta.data?.items).toHaveLength(20));
    estado.demoras.GET = 80;
    act(() => result.current.setPage(2));

    await waitFor(() => expect(result.current.consulta.isPlaceholderData).toBe(true));
    expect(result.current.consulta.data?.page).toBe(1);
    await waitFor(() => expect(result.current.consulta.data?.page).toBe(2));
    expect(result.current.consulta.data?.items).toHaveLength(5);
    expect(result.current.consulta.isPlaceholderData).toBe(false);
    expect(pedidosDe(estado, 'GET', '/').map((p) => p.busqueda)).toContain('?page=2&size=20');
  });

  it('un 503 rechaza con ApiError de code HTTP_503', async () => {
    server.use(http.get(`${API}/direcciones/`, () => new HttpResponse(null, { status: 503 })));

    const { result } = renderHook(() => useQuery(direccionQueries.lista({ page: 1, size: 20 })), {
      wrapper: envolverConQuery(crearQueryClientDePrueba()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.code).toBe('HTTP_503');
  });

  it('su clave empieza con "direcciones" y es una consulta privada de la sesión', () => {
    const { queryKey } = direccionQueries.lista({ page: 2, size: 20 });

    expect(queryKey).toEqual(['direcciones', 'lista', { page: 2, size: 20 }]);
    expect(direccionQueries.todas()).toEqual(['direcciones']);
    expect(esConsultaPrivada(queryKey)).toBe(true);
  });
});
