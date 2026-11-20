import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { instalarMatchMedia, restablecerViewport } from './viewport';
import { crearEstadoCatalogo, handlersCatalogo } from './msw/catalogo';
import { server } from './msw/server';

// Los tests de arquitectura corren en entorno `node` (sin DOM): no hay nada que preparar.
const hayDom = typeof window !== 'undefined';

// Red simulada en el borde (MSW): un pedido sin handler hace fallar el test.
if (hayDom) {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
}

// jsdom define su propio AbortSignal, que el `Request` de Node rechaza: react-router (data router) crea un
// `Request` con señal en cada navegación. Los tests no cancelan navegaciones, así que se descarta la señal.
const RequestDeNode = hayDom ? globalThis.Request : undefined;

function instalarRequestSinSenal(): void {
  if (RequestDeNode === undefined) return;
  vi.stubGlobal(
    'Request',
    class RequestSinSenal extends RequestDeNode {
      constructor(entrada: RequestInfo | URL, opciones?: RequestInit) {
        super(entrada, opciones === undefined ? opciones : { ...opciones, signal: undefined });
      }
    },
  );
}

beforeEach(async () => {
  if (!hayDom) return;
  // En cada test: un `vi.unstubAllGlobals()` de otro test no debe dejar al router sin el stub.
  instalarRequestSinSenal();
  // El catálogo es público y lo pide cualquier test que abra `/catalogo` (el destino de `/`): hay un catálogo base; cada test lo pisa con `server.use`.
  server.use(...handlersCatalogo(crearEstadoCatalogo()));
  instalarMatchMedia();
  // jsdom no implementa el desplazamiento de la ventana: las pantallas lo piden al cambiar de página.
  window.scrollTo = () => undefined;
  restablecerViewport();
  const { useUiStore } = await import('@/shared/model');
  useUiStore.getState().reset();
  const { useAuthStore } = await import('@/shared/auth');
  useAuthStore.getState().reset();
  const { useCartStore } = await import('@/entities/cart');
  useCartStore.getState().reset();
  const { usePaymentStore } = await import('@/entities/payment');
  usePaymentStore.getState().reset();
});

afterEach(async () => {
  if (!hayDom) return;
  cleanup();
  vi.useRealTimers();
  server.resetHandlers();
  const { reiniciarRenovacion } = await import('@/shared/api/renovacion');
  reiniciarRenovacion();
  window.localStorage.clear();
});
