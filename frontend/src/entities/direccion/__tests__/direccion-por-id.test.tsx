import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearEstadoDirecciones, direccionDto, handlersDirecciones } from '@/test/msw/direcciones';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { useDireccionPorId } from '../index';

const casa = direccionDto({ id: 4, alias: 'Casa', es_principal: true });
const trabajo = direccionDto({ id: 6, alias: 'Trabajo' });

function montar(id: number | null) {
  server.use(...handlersDirecciones(crearEstadoDirecciones([casa, trabajo])));
  return renderHook(() => useDireccionPorId(id), { wrapper: envolverConQuery(crearQueryClientDePrueba()) });
}

describe('useDireccionPorId', () => {
  it('mientras carga está cargando y no hay dirección', () => {
    const { result } = montar(4);

    expect(result.current).toEqual({ direccion: undefined, cargando: true });
  });

  it('devuelve la dirección del listado con ese id', async () => {
    const { result } = montar(6);

    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.direccion).toMatchObject({ id: 6, alias: 'Trabajo' });
  });

  it('un id que no está en el listado no devuelve dirección', async () => {
    const { result } = montar(99);

    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.direccion).toBeUndefined();
  });

  it('sin id (retiro en el local) no pide el listado ni está cargando', () => {
    const { result } = montar(null);

    expect(result.current).toEqual({ direccion: undefined, cargando: false });
  });
});
