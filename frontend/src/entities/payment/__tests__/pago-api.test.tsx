import { useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { crearEstadoPagos, handlersPagos } from '@/test/msw/pagos';
import { server } from '@/test/msw/server';
import { crearQueryClientDePrueba, envolverConQuery } from '@/test/query';
import { pagoQueries, useCrearPago, type CrearPagoBody } from '../index';

const cuerpo: CrearPagoBody = {
  pedido_id: 58,
  token: 'tok_1',
  payment_method_id: 'visa',
  payment_type_id: 'credit_card',
  installments: 3,
  issuer_id: 310,
  payer: { email: 'comprador@test.com', identification: { type: 'DNI', number: '12345678' } },
};

function montar<T>(usar: () => T, estado = crearEstadoPagos()) {
  server.use(...handlersPagos(estado));
  const cliente = crearQueryClientDePrueba();
  const hook = renderHook(usar, { wrapper: envolverConQuery(cliente) });
  return { estado, cliente, ...hook };
}

describe('pagoQueries.configuracion', () => {
  it('usa la clave [pagos, config] y devuelve la clave pública del backend', async () => {
    expect(pagoQueries.configuracion().queryKey).toEqual(['pagos', 'config']);
    const { result } = montar(() => useQuery(pagoQueries.configuracion()));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe('APP_USR-clave-publica-de-prueba');
  });

  it('un 503 llega como ApiError con status 503 y sin reintentos', async () => {
    const estado = crearEstadoPagos({ clavePublica: null });
    const { result } = montar(() => useQuery(pagoQueries.configuracion()), estado);

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.status).toBe(503);
    expect(estado.configuraciones).toBe(1);
  });

  it('sin respuesta del servidor llega como ApiError con status null', async () => {
    const { result } = montar(() => useQuery(pagoQueries.configuracion()), crearEstadoPagos({ clavePublica: 'red' }));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.status).toBeNull();
  });
});

describe('pagoQueries.estado', () => {
  it('usa la clave [pagos, 58] y pide GET /pagos/58', async () => {
    expect(pagoQueries.estado(58).queryKey).toEqual(['pagos', 58]);
    const estado = crearEstadoPagos({ estadoConsultado: { estado: 'aprobado', pago_id: 31, mp_status_detail: 'accredited' } });
    const { result } = montar(() => useQuery(pagoQueries.estado(58)), estado);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(estado.consultas).toEqual([58]);
    expect(result.current.data).toMatchObject({ pedido_id: 58, estado: 'aprobado', pago_id: 31 });
  });

  it('un pedido sin intentos de pago devuelve estado null', async () => {
    const { result } = montar(() => useQuery(pagoQueries.estado(61)));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ pedido_id: 61, estado: null, pago_id: null });
  });
});

describe('useCrearPago', () => {
  it('envía POST /pagos/crear con el cuerpo exacto y devuelve la respuesta', async () => {
    const estado = crearEstadoPagos({ resultados: [{ estado: 'rechazado', mp_status_detail: 'insufficient_amount' }] });
    const { result } = montar(useCrearPago, estado);

    const respuesta = await act(() => result.current.mutateAsync(cuerpo));

    expect(estado.creaciones).toEqual([cuerpo]);
    expect(respuesta).toMatchObject({ pedido_id: 58, estado: 'rechazado', mp_status_detail: 'insufficient_amount' });
  });

  it('escribe la respuesta en la caché de [pagos, 58] sin pedir GET /pagos/58', async () => {
    const { estado, cliente, result } = montar(useCrearPago, crearEstadoPagos({ resultados: [{ estado: 'pendiente', pago_id: 40 }] }));

    await act(() => result.current.mutateAsync(cuerpo));

    expect(cliente.getQueryData(pagoQueries.estado(58).queryKey)).toMatchObject({ pedido_id: 58, pago_id: 40, estado: 'pendiente' });
    expect(estado.consultas).toEqual([]);
  });

  it('un 502 llega como ApiError con status 502 y no toca la caché', async () => {
    const { cliente, result } = montar(useCrearPago, crearEstadoPagos({ resultados: [{ status: 502, detail: 'MercadoPago no respondió' }] }));

    await expect(act(() => result.current.mutateAsync(cuerpo))).rejects.toMatchObject({ status: 502 });

    expect(cliente.getQueryData(pagoQueries.estado(58).queryKey)).toBeUndefined();
  });
});
