import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { busquedasProductos, crearEstadoAdminProductos, handlersAdminProductos } from '@/test/msw/admin-productos';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { productoGestionQueries } from '../index';

const montar = <T,>(hook: () => T) => {
  const estado = crearEstadoAdminProductos();
  server.use(...handlersAdminProductos(estado));
  return { estado, ...renderHook(hook, { wrapper: envolverConQuery(crearQueryClientDePrueba()) }) };
};

describe('productoGestionQueries.lista', () => {
  it('pide page, size y disponible=false tal cual, sin forzar disponible=true', async () => {
    const { estado, result } = montar(() => useQuery(productoGestionQueries.lista({ page: 1, size: 20, disponible: false })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasProductos(estado)).toEqual(['?page=1&size=20&disponible=false']);
    expect(result.current.data?.items.map((p) => p.nombre)).toEqual(['Limonada Natural']);
  });

  it('la clave empieza por productos-gestion y es privada (se descarta al cerrar sesión)', () => {
    const { queryKey } = productoGestionQueries.lista({ page: 1, size: 20 });

    expect(queryKey).toEqual(['productos-gestion', 'lista', { page: 1, size: 20 }]);
    expect(esConsultaPrivada(queryKey)).toBe(true);
    expect(esConsultaPrivada(productoGestionQueries.detalle(3).queryKey)).toBe(true);
  });

  it('sin disponible omite el parámetro; q y categoriaId viajan como q y categoria_ids', async () => {
    const { estado, result } = montar(() => useQuery(productoGestionQueries.lista({ page: 2, size: 20, q: 'burger', categoriaId: 4 })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasProductos(estado)).toEqual(['?page=2&size=20&q=burger&categoria_ids=4']);
  });

  it('q vacío y categoría ausente no dejan rastro en el pedido ni en la clave', async () => {
    const { estado, result } = montar(() => useQuery(productoGestionQueries.lista({ page: 1, size: 20, q: '' })));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(busquedasProductos(estado)).toEqual(['?page=1&size=20']);
    expect(productoGestionQueries.lista({ page: 1, size: 20, q: '' }).queryKey).toEqual(productoGestionQueries.lista({ page: 1, size: 20 }).queryKey);
  });
});

describe('productoGestionQueries.detalle', () => {
  it('pide GET /productos/{id} y trae un producto no disponible (visible para ADMIN/STOCK)', async () => {
    const { result } = montar(() => useQuery(productoGestionQueries.detalle(6)));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ id: 6, nombre: 'Limonada Natural', disponible: false });
  });
});
