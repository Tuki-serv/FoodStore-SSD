import { useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { esConsultaPrivada } from '@/shared/api';
import { arbolSeed, crearEstadoCatalogo, handlersCatalogo } from '@/test/msw/catalogo';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { categoriaQueries } from '../index';

describe('categoriaQueries.arbol', () => {
  it('devuelve el árbol (el campo data del servidor)', async () => {
    const estado = crearEstadoCatalogo();
    server.use(...handlersCatalogo(estado));
    const { result } = renderHook(() => useQuery(categoriaQueries.arbol()), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(arbolSeed);
    expect(estado.pedidos.map((p) => p.ruta)).toEqual(['/categorias/arbol']);
  });

  it('su clave es pública y se cachea 5 minutos', () => {
    const opciones = categoriaQueries.arbol();

    expect(opciones.queryKey).toEqual(['categorias', 'arbol']);
    expect(opciones.staleTime).toBe(300_000);
    expect(esConsultaPrivada(opciones.queryKey)).toBe(false);
  });
});
