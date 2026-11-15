import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { instalarMatchMedia, restablecerViewport } from './viewport';

// Los tests de arquitectura corren en entorno `node` (sin DOM): no hay nada que preparar.
const hayDom = typeof window !== 'undefined';

if (hayDom) {
  // jsdom define su propio AbortSignal, que el `Request` de Node rechaza: react-router (data router) crea un
  // `Request` con señal en cada navegación. Los tests no cancelan navegaciones, así que se descarta la señal.
  const RequestDeNode = globalThis.Request;
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
  instalarMatchMedia();
  restablecerViewport();
  const { useUiStore } = await import('@/shared/model');
  useUiStore.getState().reset();
});

afterEach(() => {
  if (!hayDom) return;
  cleanup();
  window.localStorage.clear();
});
