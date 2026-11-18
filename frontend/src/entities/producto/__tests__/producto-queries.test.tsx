import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { busquedasDeLista, crearEstadoCatalogo, handlersCatalogo, pedidosDeProductos, productoDto, productosSeed } from '@/test/msw/catalogo';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { productoQueries } from '../index';

const montar = <T,>(hook: () => T, estado = crearEstadoCatalogo()) => {
  server.use(...handlersCatalogo(estado));
  return { estado, ...renderHook(hook, { wrapper: envolverConQuery(crearQueryClientDePrueba()) }) };
};

describe('productoQueries.lista', () => {
  it('serializa las listas repetidas (sin «[]») y devuelve el Paginado', async () => {
    const { result, estado } = montar(() =>
      useQuery(productoQueries.lista({ page: 1, size: 12, categoriaIds: [1, 4], precioMin: 1000, conStock: true })),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasDeLista(estado)).toEqual(['?page=1&size=12&disponible=true&categoria_ids=1&categoria_ids=4&precio_min=1000&con_stock=true']);
    expect(result.current.data?.items.map((p) => p.nombre)).toEqual(['Hamburguesa Clásica', 'Burger BBQ Bacon', 'Burger Vegana', 'Burger Sin TACC']);
    expect(result.current.data).toMatchObject({ total: 4, page: 1, size: 12, pages: 1 });
  });

  it('sin filtros pide solo page, size y disponible', async () => {
    const { result, estado } = montar(() => useQuery(productoQueries.lista({ page: 2, size: 12 })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasDeLista(estado)).toEqual(['?page=2&size=12&disponible=true']);
  });

  it('traduce q, precio_max y las demás claves a snake_case', async () => {
    const { result, estado } = montar(() => useQuery(productoQueries.lista({ page: 1, size: 12, q: 'burger', precioMax: 2000 })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasDeLista(estado)).toEqual(['?page=1&size=12&disponible=true&q=burger&precio_max=2000']);
  });

  it('filtros equivalentes (ids en otro orden o vacíos) comparten la misma queryKey', () => {
    const a = productoQueries.lista({ page: 1, size: 12, categoriaIds: [4, 1, 5] }).queryKey;
    const b = productoQueries.lista({ page: 1, size: 12, categoriaIds: [1, 4, 5] }).queryKey;
    const c = productoQueries.lista({ page: 1, size: 12, categoriaIds: [] }).queryKey;
    const d = productoQueries.lista({ page: 1, size: 12 }).queryKey;

    expect(a).toEqual(b);
    expect(a).toEqual(['productos', 'lista', { page: 1, size: 12, categoriaIds: [1, 4, 5] }]);
    expect(c).toEqual(d);
  });

  it('mientras carga la página 2 mantiene los datos de la 1 (isPlaceholderData)', async () => {
    const muchos = Array.from({ length: 20 }, (_, i) => productoDto({ id: i + 1 }));
    const estado = crearEstadoCatalogo(muchos);
    const { result } = montar(() => {
      const [page, setPage] = useState(1);
      return { setPage, consulta: useQuery(productoQueries.lista({ page, size: 12 })) };
    }, estado);
    await waitFor(() => expect(result.current.consulta.data?.items).toHaveLength(12));
    estado.demoras.lista = 80;
    act(() => result.current.setPage(2));

    await waitFor(() => expect(result.current.consulta.isPlaceholderData).toBe(true));
    expect(result.current.consulta.data?.page).toBe(1);
    await waitFor(() => expect(result.current.consulta.data?.page).toBe(2));
    expect(result.current.consulta.data?.items).toHaveLength(8);
  });

  it('es una consulta pública: sobrevive al cierre de sesión', () => {
    expect(esConsultaPrivada(productoQueries.lista({ page: 1, size: 12 }).queryKey)).toBe(false);
    expect(esConsultaPrivada(productoQueries.detalle(1).queryKey)).toBe(false);
  });
});

describe('productoQueries.detalle', () => {
  it('pide /productos/7 y devuelve el producto', async () => {
    const estado = crearEstadoCatalogo([...productosSeed, productoDto({ id: 7, nombre: 'Flan Casero' })]);
    const { result } = montar(() => useQuery(productoQueries.detalle(7)), estado);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pedidosDeProductos(estado).map((p) => p.ruta)).toEqual(['/productos/7']);
    expect(result.current.data?.nombre).toBe('Flan Casero');
  });

  it('un 404 rechaza con ApiError de code HTTP_404', async () => {
    const { result } = montar(() => useQuery(productoQueries.detalle(99)));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.code).toBe('HTTP_404');
  });
});
