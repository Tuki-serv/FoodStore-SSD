import axios from 'axios';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { aApiError, ApiError, DETALLE_GENERICO, DETALLE_SIN_RESPUESTA, esApiError, mensajeDeCampo } from '../api-error';

const URL_PRUEBA = 'http://localhost:8000/api/v1/prueba';

/** Provoca un error Axios real contra el handler dado (la red se simula en el borde con MSW). */
async function errorDe(respuesta: () => Response | Promise<Response>): Promise<unknown> {
  server.use(http.get(URL_PRUEBA, respuesta));
  return axios.get(URL_PRUEBA).then(
    () => {
      throw new Error('Se esperaba un error HTTP');
    },
    (error: unknown) => error,
  );
}

describe('aApiError', () => {
  it('toma status, code, detail y field del cuerpo del backend', async () => {
    const error = await errorDe(() =>
      HttpResponse.json({ detail: 'Stock insuficiente', code: 'INSUFFICIENT_STOCK', field: null }, { status: 409 }),
    );

    const api = aApiError(error);

    expect(api).toBeInstanceOf(ApiError);
    expect(api.status).toBe(409);
    expect(api.code).toBe('INSUFFICIENT_STOCK');
    expect(api.detail).toBe('Stock insuficiente');
    expect(api.field).toBeNull();
    expect(api.retryAfter).toBeUndefined();
  });

  it('conserva el campo de un error de validación 422', async () => {
    const error = await errorDe(() =>
      HttpResponse.json({ detail: 'Email inválido', code: 'VALIDATION_ERROR', field: 'email' }, { status: 422 }),
    );

    const api = aApiError(error);

    expect(api.status).toBe(422);
    expect(api.code).toBe('VALIDATION_ERROR');
    expect(api.field).toBe('email');
  });

  it('en un 429 toma la espera de Retry-After si es un entero positivo', async () => {
    const error = await errorDe(() =>
      HttpResponse.json(
        { detail: 'Demasiados intentos', code: 'RATE_LIMIT_EXCEEDED', field: null },
        { status: 429, headers: { 'Retry-After': '840' } },
      ),
    );

    const api = aApiError(error);

    expect(api.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(api.retryAfter).toBe(840);
  });

  it.each(['abc', '0', '-5', '1.5', ''])('en un 429 con Retry-After «%s» no informa espera', async (valor) => {
    const error = await errorDe(() =>
      HttpResponse.json(
        { detail: 'Demasiados intentos', code: 'RATE_LIMIT_EXCEEDED', field: null },
        { status: 429, headers: { 'Retry-After': valor } },
      ),
    );

    expect(aApiError(error).retryAfter).toBeUndefined();
  });

  it('sin respuesta del backend: status nulo y NETWORK_ERROR', async () => {
    const error = await errorDe(() => HttpResponse.error());

    const api = aApiError(error);

    expect(api.status).toBeNull();
    expect(api.code).toBe('NETWORK_ERROR');
    expect(api.detail).toBe(DETALLE_SIN_RESPUESTA);
    expect(api.field).toBeNull();
  });

  it('un 502 con cuerpo HTML usa HTTP_502 y un detail genérico sin el HTML', async () => {
    const error = await errorDe(
      () => new HttpResponse('<html><body>Bad gateway</body></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    const api = aApiError(error);

    expect(api.status).toBe(502);
    expect(api.code).toBe('HTTP_502');
    expect(api.detail).toBe(DETALLE_GENERICO);
    expect(api.detail).not.toContain('<html>');
  });

  it('un JSON que no tiene la forma {detail, code, field} también cae a HTTP_<status>', async () => {
    const error = await errorDe(() => HttpResponse.json({ message: 'boom' }, { status: 500 }));

    const api = aApiError(error);

    expect(api.code).toBe('HTTP_500');
    expect(api.detail).toBe(DETALLE_GENERICO);
  });

  it('un valor que no es un error de Axios es UNKNOWN_ERROR', () => {
    const api = aApiError(new TypeError('boom'));

    expect(api.status).toBeNull();
    expect(api.code).toBe('UNKNOWN_ERROR');
    expect(api.detail).toBe(DETALLE_GENERICO);
  });

  it('un ApiError ya normalizado se devuelve tal cual', async () => {
    const error = await errorDe(() => HttpResponse.json({ detail: 'x', code: 'DUPLICATE_VALUE', field: 'nombre' }, { status: 409 }));
    const api = aApiError(error);

    expect(aApiError(api)).toBe(api);
  });
});

describe('esApiError y mensajeDeCampo', () => {
  it('esApiError distingue ApiError de otros errores', () => {
    expect(esApiError(new ApiError({ status: 404, code: 'HTTP_404', detail: 'x', field: null }))).toBe(true);
    expect(esApiError(new Error('x'))).toBe(false);
    expect(esApiError({ status: 404, code: 'HTTP_404' })).toBe(false);
  });

  it('mensajeDeCampo devuelve el detail solo si el error es de ese campo', () => {
    const error = new ApiError({ status: 422, code: 'VALIDATION_ERROR', detail: 'Email inválido', field: 'email' });

    expect(mensajeDeCampo(error, 'email')).toBe('Email inválido');
    expect(mensajeDeCampo(error, 'password')).toBeUndefined();
    expect(mensajeDeCampo(new Error('x'), 'email')).toBeUndefined();
  });
});
